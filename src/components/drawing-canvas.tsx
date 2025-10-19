'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import katex from 'katex';

// Define the structure for a single stroke
interface Stroke {
  points: { x: number; y: number }[];
}

const parseLatexVariables = (latex: string): string[] => {
  if (!latex) return [];
  // This is a simplified parser. A more robust solution would be needed for complex equations.
  const variableRegex = /[a-zA-Z]/g;
  const matches = latex.match(variableRegex);
  return matches ? [...new Set(matches)] : [];
};

const KatexOutput: React.FC<{ latex: string; highlightedTerm: string }> = ({ latex, highlightedTerm }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const highlightedLatex = useMemo(() => {
    if (!latex) return '';
    const variables = parseLatexVariables(latex);
    const lastWord = highlightedTerm.split(' ').pop()?.toLowerCase() ?? '';

    if (!lastWord || !variables.includes(lastWord)) {
      return latex;
    }

    // This regex ensures we only match the exact variable, avoiding substrings.
    const regex = new RegExp(`\\b${lastWord}\\b`, 'g');
    return latex.replace(regex, `\\color{red}{${lastWord}}`);
  }, [latex, highlightedTerm]);

  useEffect(() => {
    if (containerRef.current) {
      try {
        // Clear previous render
        containerRef.current.innerHTML = '';
        katex.render(highlightedLatex, containerRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (error) {
        console.error('Error rendering LaTeX:', error);
        containerRef.current.innerText = 'Error rendering equation.';
      }
    }
  }, [highlightedLatex]);

  return <div ref={containerRef} className="text-2xl p-4 min-h-[64px]" />;
};


const DrawingCanvas: React.FC<{ transcript: string; onLatexRecognized: (latex: string) => void }> = ({ transcript, onLatexRecognized }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>({ points: [] });
  const [recognizedLatex, setRecognizedLatex] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext('2d') : null;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setRecognizedLatex('');
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing(true);
    setCurrentStroke({ points: [{ x: offsetX, y: offsetY }] });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;

    const ctx = getCanvasContext();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(currentStroke.points[currentStroke.points.length - 1].x, currentStroke.points[currentStroke.points.length - 1].y);
      ctx.lineTo(offsetX, offsetY);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const newPoints = [...currentStroke.points, { x: offsetX, y: offsetY }];
    setCurrentStroke({ points: newPoints });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.points.length > 1) {
      setStrokes(prevStrokes => [...prevStrokes, currentStroke]);
    }
    setCurrentStroke({ points: [] });
  };

  const handleRecognize = async () => {
    if (strokes.length === 0) return;
    setIsLoading(true);
    setRecognizedLatex('');
    try {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strokes }),
      });
      const data = await response.json();
      if (response.ok) {
        setRecognizedLatex(data.latex);
        onLatexRecognized(data.latex); // Pass the latex up to the parent
      } else {
        console.error('Recognition API error:', data.error);
        setRecognizedLatex('Error: Could not recognize equation.');
      }
    } catch (error) {
      console.error('Failed to fetch from recognition API:', error);
      setRecognizedLatex('Error: Request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearCanvas = () => {
    const ctx = getCanvasContext();
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setStrokes([]);
    setCurrentStroke({ points: [] });
    setRecognizedLatex('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 800;
      canvas.height = 400;
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border border-gray-400 rounded-lg bg-white"
      />
      <div className="flex gap-4">
        <button onClick={handleRecognize} disabled={isLoading || strokes.length === 0} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400">
          {isLoading ? 'Recognizing...' : 'Recognize Equation'}
        </button>
        <button onClick={clearCanvas} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
          Clear
        </button>
      </div>
      <div className="w-full mt-4 p-4 border border-gray-300 rounded-lg bg-gray-50 min-h-[80px]">
        <h2 className="text-lg font-semibold mb-2 text-center">Recognized Equation</h2>
        <KatexOutput latex={recognizedLatex} highlightedTerm={transcript} />
      </div>
    </div>
  );
};

export default DrawingCanvas;