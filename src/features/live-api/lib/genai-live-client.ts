/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Content,
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
} from '@google/genai';
import { LiveClientOptions, StreamingLog } from '../types';
import { base64ToArrayBuffer } from './utils';
import { TypedEventEmitter } from './typed-event-emitter';

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (error: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation,
  ) => void;
  turncomplete: () => void;
}

export class GenAILiveClient extends TypedEventEmitter<LiveClientEventTypes> {
  protected client: GoogleGenAI;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  private _session: Session | null = null;

  private _model: string | null = null;

  protected config: LiveConnectConfig | null = null;

  constructor(options: LiveClientOptions) {
    super();
    this.client = new GoogleGenAI(options);
    this.send = this.send.bind(this);
    this.onopen = this.onopen.bind(this);
    this.onerror = this.onerror.bind(this);
    this.onclose = this.onclose.bind(this);
    this.onmessage = this.onmessage.bind(this);
  }

  public get status() {
    return this._status;
  }

  public get session() {
    return this._session;
  }

  public get model() {
    return this._model;
  }

  public getConfig() {
    return this.config ? { ...this.config } : null;
  }

  protected log(type: string, message: StreamingLog['message']) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit('log', log);
  }

  async connect(model: string, config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    this.config = config;
    this._model = model;

    const callbacks: LiveCallbacks = {
      onopen: this.onopen,
      onmessage: this.onmessage,
      onerror: this.onerror,
      onclose: this.onclose,
    };

    try {
      this._session = await this.client.live.connect({
        model,
        config,
        callbacks,
      });
    } catch (error) {
      console.error('Error connecting to GenAI Live:', error);
      this._status = 'disconnected';
      return false;
    }

    this._status = 'connected';
    return true;
  }

  public disconnect() {
    if (!this.session) {
      return false;
    }
    this.session.close();
    this._session = null;
    this._status = 'disconnected';

    this.log('client.close', 'Disconnected');
    return true;
  }

  protected onopen() {
    this.log('client.open', 'Connected');
    this.emit('open');
  }

  protected onerror(e: ErrorEvent) {
    this.log('server.error', e.message);
    this.emit('error', e);
  }

  protected onclose(e: CloseEvent) {
    this.log(
      'server.close',
      `disconnected ${e.reason ? `with reason: ${e.reason}` : ''}`,
    );
    this.emit('close', e);
  }

  protected async onmessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.log('server.send', 'setupComplete');
      this.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emit('toolcall', message.toolCall);
      return;
    }
    if (message.toolCallCancellation) {
      this.log('server.toolCallCancellation', message);
      this.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      if ('interrupted' in serverContent) {
        this.log('server.content', 'interrupted');
        this.emit('interrupted');
        return;
      }
      if ('turnComplete' in serverContent) {
        this.log('server.content', 'turnComplete');
        this.emit('turncomplete');
      }

      if ('modelTurn' in serverContent) {
        let parts: Part[] = serverContent.modelTurn?.parts ?? [];

        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType?.startsWith('audio/pcm'),
        );
        const base64s = audioParts
          .map((p) => p.inlineData?.data)
          .filter((value): value is string => Boolean(value));

        const otherParts = parts.filter((part) => !audioParts.includes(part));

        base64s.forEach((b64) => {
          const data = base64ToArrayBuffer(b64);
          this.emit('audio', data);
          this.log('server.audio', `buffer (${data.byteLength})`);
        });

        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: { modelTurn: Content } = { modelTurn: { parts } };
        this.emit('content', content);
        this.log('server.content', message);
      }
    } else {
      console.log('received unmatched message', message);
    }
  }

  sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    let hasAudio = false;
    let hasVideo = false;
    for (const ch of chunks) {
      this.session?.sendRealtimeInput({ media: ch });
      if (ch.mimeType.includes('audio')) {
        hasAudio = true;
      }
      if (ch.mimeType.includes('image')) {
        hasVideo = true;
      }
      if (hasAudio && hasVideo) {
        break;
      }
    }
    const message = hasAudio
      ? hasVideo
        ? 'audio + video'
        : 'audio'
      : hasVideo
        ? 'video'
        : 'unknown';
    this.log('client.realtimeInput', message);
  }

  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (toolResponse.functionResponses && toolResponse.functionResponses.length) {
      this.session?.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log('client.toolResponse', toolResponse);
    }
  }

  send(parts: Part | Part[], turnComplete: boolean = true) {
    this.session?.sendClientContent({ turns: parts, turnComplete });
    this.log('client.send', {
      turns: Array.isArray(parts) ? parts : [parts],
      turnComplete,
    });
  }
}
