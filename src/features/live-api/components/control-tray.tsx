'use client';

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

import clsx from 'clsx';
import {
  memo,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Mic, MicOff, Monitor, MonitorOff, Pause, Play, Video, VideoOff } from 'lucide-react';

import { useLiveAPIContext } from '../context/live-api-context';
import { UseMediaStreamResult } from '../hooks/use-media-stream-mux';
import { useScreenCapture } from '../hooks/use-screen-capture';
import { useWebcam } from '../hooks/use-webcam';
import { AudioRecorder } from '../lib/audio-recorder';
import { AudioPulse } from './audio-pulse';

export type ControlTrayProps = {
  videoRef: RefObject<HTMLVideoElement>;
  children?: ReactNode;
  supportsVideo: boolean;
  onVideoStreamChange?: (stream: MediaStream | null) => void;
};

type MediaStreamButtonProps = {
  isStreaming: boolean;
  onIcon: ReactNode;
  offIcon: ReactNode;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  disabled?: boolean;
};

const baseButtonClasses =
  'flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';

const MediaStreamButton = memo(function MediaStreamButton({
  isStreaming,
  onIcon,
  offIcon,
  start,
  stop,
  disabled,
}: MediaStreamButtonProps) {
  return (
    <button
      type="button"
      className={clsx(baseButtonClasses, isStreaming && 'bg-emerald-500/20 text-emerald-300')}
      onClick={async () => {
        if (disabled) return;
        if (isStreaming) {
          await stop();
        } else {
          await start();
        }
      }}
      disabled={disabled}
    >
      {isStreaming ? onIcon : offIcon}
    </button>
  );
});

function ControlTray({
  videoRef,
  children,
  onVideoStreamChange = () => {},
  supportsVideo,
}: ControlTrayProps) {
  const videoStreams = [useWebcam(), useScreenCapture()];
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);
  const [webcam, screenCapture] = videoStreams;
  const [inputVolume, setInputVolume] = useState(0);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect, volume } = useLiveAPIContext();

  const handleVolume = useCallback((value: number) => {
    setInputVolume(value);
  }, []);

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };

    if (connected && !muted) {
      audioRecorder
        .on('data', onData)
        .on('volume', handleVolume)
        .start()
        .catch((error) => {
          console.error('Audio recording failed', error);
        });
    } else {
      audioRecorder.stop();
    }

    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', handleVolume);
      audioRecorder.stop();
    };
  }, [audioRecorder, client, connected, handleVolume, muted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeVideoStream;
    }

    let timeoutId: number | undefined;

    const sendVideoFrame = () => {
      const video = videoRef.current;
      const canvas = renderCanvasRef.current;

      if (!video || !canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      canvas.width = video.videoWidth * 0.25;
      canvas.height = video.videoHeight * 0.25;
      if (canvas.width + canvas.height > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 1.0);
        const data = base64.slice(base64.indexOf(',') + 1);
        client.sendRealtimeInput([{ mimeType: 'image/jpeg', data }]);
      }

      if (connected) {
        timeoutId = window.setTimeout(sendVideoFrame, 200);
      }
    };

    if (connected && activeVideoStream) {
      requestAnimationFrame(sendVideoFrame);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [connected, activeVideoStream, client, videoRef]);

  const changeStreams = (next?: UseMediaStreamResult) => async () => {
    if (next) {
      const mediaStream = await next.start();
      setActiveVideoStream(mediaStream);
      onVideoStreamChange(mediaStream);
    } else {
      setActiveVideoStream(null);
      onVideoStreamChange(null);
    }

    videoStreams.filter((streamHook) => streamHook !== next).forEach((streamHook) => {
      streamHook.stop();
    });
  };

  const micBackground = muted
    ? 'bg-rose-500/20 text-rose-200'
    : inputVolume > 0.1
    ? 'bg-emerald-500/30 text-emerald-200'
    : 'bg-slate-900/70 text-slate-200';

  return (
    <section className="flex w-full flex-col items-center gap-4">
      <canvas className="hidden" ref={renderCanvasRef} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className={clsx(baseButtonClasses, micBackground)}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2">
          <AudioPulse volume={volume} active={connected} />
          <span className="text-xs text-slate-300">Model audio</span>
        </div>

        {supportsVideo && (
          <>
            <MediaStreamButton
              isStreaming={screenCapture.isStreaming}
              start={() => changeStreams(screenCapture)()}
              stop={() => changeStreams()()}
              onIcon={<MonitorOff className="h-5 w-5" />}
              offIcon={<Monitor className="h-5 w-5" />}
              disabled={!connected}
            />
            <MediaStreamButton
              isStreaming={webcam.isStreaming}
              start={() => changeStreams(webcam)()}
              stop={() => changeStreams()()}
              onIcon={<VideoOff className="h-5 w-5" />}
              offIcon={<Video className="h-5 w-5" />}
              disabled={!connected}
            />
          </>
        )}

        {children}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          ref={connectButtonRef}
          className={clsx(
            'flex h-14 w-14 items-center justify-center rounded-full border border-slate-700 text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
            connected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-900/80',
          )}
          onClick={connected ? disconnect : connect}
        >
          {connected ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
        <div className="flex flex-col text-sm">
          <span className="font-medium text-slate-200">{connected ? 'Streaming' : 'Disconnected'}</span>
          <span className="text-xs text-slate-400">Gemini Live</span>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
