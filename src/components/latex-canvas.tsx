'use client';

import { useEffect, useMemo, useRef } from 'react';

const CANVAS_BACKGROUND = '#020617';
const TEXT_COLOR = '#e2e8f0';

const fallbackMessage = 'LaTeX output will appear here…';

const wrapLatex = (latex: string) => (latex && latex.trim().length > 0 ? latex : fallbackMessage);

export type LatexCanvasProps = {
  latex: string;
};

const LatexCanvas: React.FC<LatexCanvasProps> = ({ latex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayLatex = useMemo(() => wrapLatex(latex), [latex]);

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
    <div className="relative w-full flex-1">
      <canvas ref={canvasRef} className="h-full w-full rounded-xl border border-slate-800 bg-slate-950 shadow-2xl" />
      <div className="pointer-events-none absolute left-8 top-6 text-xs uppercase tracking-[0.35em] text-sky-400/70">
        Gemini Live · LaTeX Preview
      </div>
    </div>
  );
};

export default LatexCanvas;
