'use client';

import { useCallback, useState } from 'react';
import DrawingCanvas from '@/components/drawing-canvas';
import LatexCanvas from '@/components/latex-canvas';
import LiveAnalysisPanel from '@/components/live-analysis-panel';
import { useGeminiLive } from '@/hooks/use-gemini-live';

export default function Home() {
  const [latex, setLatex] = useState('');
  const { analysis, loading, error, runAnalysis, reset } = useGeminiLive();

  const handleLatexRecognized = useCallback(
    (nextLatex: string) => {
      setLatex(nextLatex);
      if (!nextLatex.trim()) {
        reset();
      }
    },
    [reset],
  );

  const handleRunAnalysis = useCallback(async () => {
    await runAnalysis(latex);
  }, [latex, runAnalysis]);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="relative z-10 flex flex-col items-center gap-3 px-6 pb-4 pt-10 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-sky-400">Gemini Live Math Console</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Sketch Equations · Watch LaTeX React</h1>
        <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
          Draw an equation below. The top canvas mirrors the recognized LaTeX while Gemini Live reviews your entire tab to offer insight.
        </p>
      </header>
      <section className="flex flex-1 flex-col gap-10 px-6 pb-14">
        <div className="flex min-h-[320px] flex-col">
          <LatexCanvas latex={latex} />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)]">
          <DrawingCanvas onLatexRecognized={handleLatexRecognized} />
          <LiveAnalysisPanel
            latex={latex}
            analysis={analysis}
            loading={loading}
            error={error}
            onRunAnalysis={handleRunAnalysis}
          />
        </div>
      </section>
    </main>
  );
}
