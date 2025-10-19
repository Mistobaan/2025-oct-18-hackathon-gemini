'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type LiveAnalysisPanelProps = {
  latex: string;
  analysis: string;
  loading: boolean;
  error?: string | null;
  onRunAnalysis: () => void;
};

const LiveAnalysisPanel: React.FC<LiveAnalysisPanelProps> = ({ latex, analysis, loading, error, onRunAnalysis }) => {
  const disabled = !latex.trim() || loading;
  return (
    <section className="mt-6 w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl backdrop-blur">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-sky-400">Gemini Live</p>
          <h2 className="text-2xl font-semibold text-slate-100">Math Context Analysis</h2>
        </div>
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold uppercase tracking-[0.25em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
            disabled
              ? 'cursor-not-allowed bg-slate-800 text-slate-500'
              : 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/40 hover:bg-sky-400'
          )}
        >
          {loading ? 'Analyzing…' : 'Analyze Current Tab'}
        </button>
      </header>
      <div className="mt-4 text-sm text-slate-300">
        <p className="mb-2 text-slate-400">
          {latex.trim()
            ? 'Recognized LaTeX has been sent along with the captured page context. Gemini Live responds with guidance below.'
            : 'Draw an equation below to enable Gemini Live analysis.'}
        </p>
        {error && <p className="rounded-md border border-red-600/40 bg-red-500/10 p-3 text-red-200">{error}</p>}
        <article className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 text-base text-slate-100">
          {analysis ? (
            <>{analysis.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index} className="mb-3 last:mb-0 leading-7">
                {paragraph}
              </p>
            ))}</>
          ) : (
            <p className="text-slate-500">Gemini Live feedback will appear here once you run the analysis.</p>
          )}
        </article>
      </div>
    </section>
  );
};

export default LiveAnalysisPanel;
