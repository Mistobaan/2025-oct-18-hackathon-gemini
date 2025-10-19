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
import { useEffect, useMemo, useRef } from 'react';

export type AudioPulseProps = {
  active: boolean;
  volume: number;
  hover?: boolean;
};

const clampVolume = (value: number, max: number) => Math.min(max, Math.max(0, value));

export function AudioPulse({ active, volume, hover = false }: AudioPulseProps) {
  const barsRef = useRef<HTMLDivElement[]>([]);
  const heights = useMemo(
    () => [clampVolume(4 + volume * 60, 24), clampVolume(4 + volume * 400, 28), clampVolume(4 + volume * 60, 24)],
    [volume],
  );

  useEffect(() => {
    barsRef.current.forEach((bar, index) => {
      if (!bar) return;
      bar.style.height = `${heights[index]}px`;
      bar.style.opacity = active ? '1' : '0.45';
    });
  }, [active, heights]);

  return (
    <div
      className={clsx(
        'flex items-end gap-1 rounded-full px-2 py-1 transition-colors duration-150',
        active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/80 text-slate-400',
        hover && 'ring-2 ring-emerald-400/60',
      )}
    >
      {heights.map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) {
              barsRef.current[index] = el;
            }
          }}
          className="w-1 rounded-full bg-current transition-all duration-150 ease-out"
          style={{ height: `${heights[index]}px`, opacity: active ? 1 : 0.45 }}
        />
      ))}
    </div>
  );
}
