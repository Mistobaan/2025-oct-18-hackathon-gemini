'use client';

import { useCallback, useEffect, useState } from 'react';
import DrawingCanvas from '@/components/drawing-canvas';
import LatexCanvas from '@/components/latex-canvas';
import { useGeminiLive } from '@/hooks/use-gemini-live';

export default function Home() {
  const [latex, setLatex] = useState('');
  const { analysis, loading, error, runAnalysis, reset } = useGeminiLive();

  const handleLatexRecognized = useCallback(
    (nextLatex: string) => {
      setLatex(nextLatex);
      if (!nextLatex.trim()) {
        reset();
        return;
      }
      if (nextLatex !== latex) {
        reset();
      }
    },
    [latex, reset],
  );

  useEffect(() => {
    if (!latex.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      runAnalysis(latex);
    }, 900);

    return () => {
      clearTimeout(timer);
    };
  }, [latex, runAnalysis]);

  return (
    <main className="flex h-full min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      <section className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-3 pt-8 sm:px-10">
          <LatexCanvas latex={latex} analysis={analysis} loading={loading} error={error} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-8 pt-3 sm:px-10">
          <DrawingCanvas onLatexRecognized={handleLatexRecognized} />
        </div>
      </section>
    </main>
  );
}
