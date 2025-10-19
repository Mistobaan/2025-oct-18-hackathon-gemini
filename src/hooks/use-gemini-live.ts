'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

export type LiveAnalysisState = {
  analysis: string;
  loading: boolean;
  error: string | null;
  snapshot: TabSnapshot | null;
  runAnalysis: (latex: string) => Promise<void>;
  reset: () => void;
};

export type TabSnapshot = {
  title: string;
  url: string;
  html: string;
  scrollPosition: number;
};

const STREAM_FALLBACK_MESSAGE = 'Gemini Live is preparing insights…';

const createSnapshot = (): TabSnapshot => {
  if (typeof document === 'undefined') {
    return { title: '', url: '', html: '', scrollPosition: 0 };
  }
  return {
    title: document.title,
    url: window.location.href,
    html: new XMLSerializer().serializeToString(document.documentElement),
    scrollPosition: window.scrollY,
  };
};

export function useGeminiLive(): LiveAnalysisState {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TabSnapshot | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setAnalysis('');
    setError(null);
    setSnapshot(null);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const runAnalysis = useCallback(async (latex: string) => {
    if (!latex.trim()) {
      setError('No LaTeX provided for analysis.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setAnalysis('');

    const tabSnapshot = createSnapshot();
    setSnapshot(tabSnapshot);

    try {
      const response = await fetch('/api/live/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, snapshot: tabSnapshot }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to run Gemini Live analysis.');
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const { analysis: result } = await response.json();
        setAnalysis(result ?? '');
        return;
      }

      if (!response.body) {
        setAnalysis('Gemini Live did not return any content.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assembled = '';
      setAnalysis(STREAM_FALLBACK_MESSAGE);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assembled += chunk;
        setAnalysis(assembled);
      }

      if (!assembled.trim()) {
        setAnalysis('Gemini Live did not return any content.');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      console.error('Gemini Live analysis error', err);
      setError((err as Error).message ?? 'Unknown error');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  return useMemo(
    () => ({ analysis, loading, error, snapshot, runAnalysis, reset }),
    [analysis, loading, error, snapshot, runAnalysis, reset],
  );
}
