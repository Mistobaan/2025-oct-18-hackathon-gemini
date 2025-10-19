'use client';

import { useEffect, useMemo, useRef } from 'react';

const CANVAS_BACKGROUND = '#020617';
const TEXT_COLOR = '#e2e8f0';

const fallbackMessage = 'LaTeX output will appear here…';

const wrapLatex = (latex: string) => (latex && latex.trim().length > 0 ? latex : fallbackMessage);

export type LatexCanvasProps = {
  latex: string;
  analysis?: string;
  loading?: boolean;
  error?: string | null;
};

const LatexCanvas: React.FC<LatexCanvasProps> = ({ latex, analysis = '', loading = false, error = null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayLatex = useMemo(() => wrapLatex(latex), [latex]);
  const analysisParagraphs = useMemo(
    () =>
      analysis
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [analysis],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = CANVAS_BACKGROUND;
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = `48px 'STIX Two Math', 'Times New Roman', serif`;
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(14,165,233,0.35)';
      ctx.shadowBlur = 18;

      const maxWidth = rect.width - 96;
      const lineHeight = 56;
      const words = displayLatex.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';
      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      if (currentLine) {
        lines.push(currentLine);
      }

      const startY = Math.max((rect.height - lines.length * lineHeight) / 2, 48);
      lines.forEach((line, index) => {
        ctx.fillText(line, 48, startY + index * lineHeight);
      });
    };

    resize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [displayLatex]);

  return (
    <div className="relative flex h-full w-full flex-1">
      <canvas
        ref={canvasRef}
        className="h-full w-full flex-1 rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_40px_120px_-60px_rgba(56,189,248,0.35)]"
      />
      <div className="pointer-events-none absolute left-10 top-8 text-xs uppercase tracking-[0.35em] text-sky-400/70">
        Gemini Live · LaTeX Preview
      </div>
      {loading && !error && (
        <div className="pointer-events-none absolute bottom-8 right-8 rounded-xl border border-sky-500/40 bg-slate-950/80 px-5 py-3 text-xs uppercase tracking-[0.3em] text-sky-200 shadow-lg">
          Analyzing current tab…
        </div>
      )}
      {error && (
        <div className="pointer-events-auto absolute bottom-8 right-8 max-w-md rounded-xl border border-red-500/40 bg-red-500/15 px-5 py-4 text-sm leading-6 text-red-100 shadow-xl">
          {error}
        </div>
      )}
      {!loading && !error && analysisParagraphs.length > 0 && (
        <div className="pointer-events-auto absolute bottom-8 right-8 max-w-md space-y-3 rounded-2xl border border-slate-800/70 bg-slate-950/85 p-5 text-sm leading-7 text-slate-100 shadow-2xl backdrop-blur">
          {analysisParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default LatexCanvas;
