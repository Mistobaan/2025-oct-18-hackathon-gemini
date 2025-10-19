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

export type GetAudioContextOptions = AudioContextOptions & { id?: string };

const contextRegistry = new Map<string, AudioContext>();

export const audioContext: (
  options?: GetAudioContextOptions,
) => Promise<AudioContext> = (() => {
  if (typeof window === 'undefined') {
    return async () => {
      throw new Error('audioContext can only be used in a browser environment');
    };
  }

  const didInteract = new Promise<void>((resolve) => {
    const handleInteraction = () => {
      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      resolve();
    };

    window.addEventListener('pointerdown', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
  });

  return async (options?: GetAudioContextOptions) => {
    try {
      const a = new Audio();
      a.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      await a.play();

      if (options?.id) {
        const existing = contextRegistry.get(options.id);
        if (existing) {
          return existing;
        }
      }

      const ctx = new AudioContext(options);
      if (options?.id) {
        contextRegistry.set(options.id, ctx);
      }
      return ctx;
    } catch (error) {
      await didInteract;

      if (options?.id) {
        const existing = contextRegistry.get(options.id);
        if (existing) {
          return existing;
        }
      }

      const ctx = new AudioContext(options);
      if (options?.id) {
        contextRegistry.set(options.id, ctx);
      }
      return ctx;
    }
  };
})();

export function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
