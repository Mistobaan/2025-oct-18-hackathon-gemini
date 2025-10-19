'use client';

import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';

import ControlTray from '@/features/live-api/components/control-tray';
import { LiveAPIProvider } from '@/features/live-api/context/live-api-context';
import type { LiveClientOptions } from '@/features/live-api/types';

type GeminiLiveConsoleProps = {
  apiKey?: string;
  className?: string;
};

export function GeminiLiveConsole({ apiKey, className }: GeminiLiveConsoleProps) {
  const resolvedApiKey = apiKey ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const options = useMemo<LiveClientOptions | null>(() => {
    if (!resolvedApiKey) {
      return null;
    }
    return { apiKey: resolvedApiKey };
  }, [resolvedApiKey]);

  if (!options) {
    return (
      <div
        className={clsx(
          'flex w-full max-w-2xl flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center text-slate-300',
          className,
        )}
      >
        <h2 className="text-lg font-semibold text-slate-100">Gemini Live API key required</h2>
        <p className="text-sm text-slate-400">
          Set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_GEMINI_API_KEY</code> in your environment
          to enable real-time audio and video streaming.
        </p>
      </div>
    );
  }

  return (
    <LiveAPIProvider options={options}>
      <div
        className={clsx(
          'flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg backdrop-blur',
          className,
        )}
      >
        <div className="flex w-full flex-col items-center gap-6">
          <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black/60">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={clsx(
                'aspect-video w-full object-cover transition-opacity duration-200',
                videoStream ? 'opacity-100' : 'opacity-30',
              )}
            />
            {!videoStream && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                Video preview appears here once streaming is active.
              </div>
            )}
          </div>
          <ControlTray
            videoRef={videoRef}
            supportsVideo
            onVideoStreamChange={setVideoStream}
          />
        </div>
      </div>
    </LiveAPIProvider>
  );
}
