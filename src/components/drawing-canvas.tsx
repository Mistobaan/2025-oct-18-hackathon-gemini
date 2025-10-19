'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

type PointerEvent = React.PointerEvent<HTMLCanvasElement>;

const CANVAS_BACKGROUND = '#0f172a';
const STROKE_COLOR = '#f1f5f9';

type DrawingCanvasProps = {
  onLatexRecognized: (latex: string) => void;
  onSnapshotCaptured?: (dataUrl: string) => void;
};

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ onLatexRecognized, onSnapshotCaptured }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recognitionTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSerialized = useRef('');

  const withContext = useCallback(
    (fn: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      fn(ctx, canvas);
    },
    [],
  );

  const resizeCanvas = useCallback(() => {
    withContext((ctx, canvas) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = STROKE_COLOR;
      ctx.fillStyle = CANVAS_BACKGROUND;
      ctx.fillRect(0, 0, rect.width, rect.height);
    });
  }, [withContext]);

  useEffect(() => {
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resizeCanvas()) : null;
    if (observer && canvasRef.current) {
      observer.observe(canvasRef.current);
    }
    resizeCanvas();
    return () => {
      observer?.disconnect();
    };
  }, [resizeCanvas]);

  const scheduleRecognition = useCallback(() => {
    if (!canvasRef.current || !hasDrawing) return;
    if (recognitionTimer.current) {
      clearTimeout(recognitionTimer.current);
    }
    recognitionTimer.current = setTimeout(async () => {
      const imageDataUrl = canvasRef.current?.toDataURL('image/png');
      if (!imageDataUrl) return;
      if (onSnapshotCaptured) {
        onSnapshotCaptured(imageDataUrl);
      }
      if (imageDataUrl === lastSerialized.current) {
        return;
      }
      lastSerialized.current = imageDataUrl;
      try {
        setIsRecognizing(true);
        const response = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageDataUrl }),
        });
        const data = await response.json();
        if (response.ok) {
          onLatexRecognized(data.latex ?? '');
        } else {
          console.error('Recognition API error:', data.error);
          onLatexRecognized('');
        }
      } catch (error) {
        console.error('Failed to recognize equation', error);
        onLatexRecognized('');
      } finally {
        setIsRecognizing(false);
      }
    }, 600);
  }, [hasDrawing, onLatexRecognized, onSnapshotCaptured]);

  const beginStroke = useCallback(
    (event: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      withContext((ctx) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
      });
      drawing.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [withContext],
  );

  const continueStroke = useCallback(
    (event: PointerEvent) => {
      if (!drawing.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      withContext((ctx) => {
        ctx.lineTo(x, y);
        ctx.stroke();
      });
      setHasDrawing(true);
    },
    [withContext],
  );

  const endStroke = useCallback(
    (event: PointerEvent) => {
      if (!drawing.current) return;
      drawing.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      scheduleRecognition();
    },
    [scheduleRecognition],
  );

  const clearCanvas = useCallback(() => {
    withContext((ctx, canvas) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const { width, height } = canvas;
      canvas.width = width;
      canvas.height = height;
    });
    resizeCanvas();
    setHasDrawing(false);
    lastSerialized.current = '';
    onLatexRecognized('');
  }, [onLatexRecognized, resizeCanvas, withContext]);

  useEffect(() => {
    return () => {
      if (recognitionTimer.current) {
        clearTimeout(recognitionTimer.current);
      }
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.9)]">
        <canvas
          ref={canvasRef}
          className="size-full cursor-crosshair touch-none"
          onPointerDown={beginStroke}
          onPointerMove={continueStroke}
          onPointerUp={endStroke}
          onPointerLeave={(event) => {
            if (!drawing.current) return;
            endStroke(event);
          }}
          onPointerCancel={endStroke}
        />
        {isRecognizing && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/70 py-3 text-center text-xs uppercase tracking-[0.28em] text-slate-200">
            Recognizing…
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-slate-400">
        <span className="text-[0.65rem] sm:text-[0.7rem]">
          {hasDrawing ? 'Release to recognize automatically.' : 'Draw your equation below.'}
        </span>
        <button
          type="button"
          onClick={clearCanvas}
          className="rounded-full border border-slate-600 px-4 py-2 text-[0.65rem] font-semibold tracking-[0.3em] text-slate-100 transition hover:bg-slate-800"
        >
          Clear Canvas
        </button>
      </div>
    </div>
  );
};

export default DrawingCanvas;