'use client';

import { useState, useMemo } from 'react';
import DrawingCanvas from '@/components/drawing-canvas';
import SpeechRecognition from '@/components/speech-recognition';

const Step: React.FC<{ number: number; title: string; active: boolean; children: React.ReactNode }> = ({ number, title, active, children }) => (
  <div className={`p-4 border rounded-lg ${active ? 'border-blue-500' : 'border-gray-300'}`}>
    <h2 className={`text-xl font-bold ${active ? 'text-blue-600' : 'text-gray-500'}`}>Step {number}: {title}</h2>
    <div className="mt-4">{children}</div>
  </div>
);

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [latex, setLatex] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecognized, setIsRecognized] = useState(false);

  const handleLatexRecognized = (recognizedLatex: string) => {
    setLatex(recognizedLatex);
    setIsRecognized(true);
  };

  const handleGenerateVideo = async () => {
    if (!latex) {
      alert("Please recognize an equation first.");
      return;
    }
    setIsGenerating(true);
    setVideoUrl(null);
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex, explanations: transcript }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate video.');
      }

      const videoBlob = await response.blob();
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);
    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentStep = useMemo(() => {
    if (!isRecognized) return 1;
    if (!transcript) return 2;
    return 3;
  }, [isRecognized, transcript]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 gap-8 bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Multimodal MCP</h1>
        <p className="text-xl text-muted-foreground mt-2">
          Draw, Recognize, Speak, and Animate your Math.
        </p>
      </div>
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-8">
          <Step number={1} title="Draw & Recognize" active={currentStep === 1}>
            <DrawingCanvas transcript={transcript} onLatexRecognized={handleLatexRecognized} />
          </Step>
          <Step number={2} title="Explain the Equation" active={currentStep === 2}>
            <SpeechRecognition onTranscriptUpdate={setTranscript} disabled={!isRecognized} />
          </Step>
        </div>
        <div className="flex flex-col gap-8">
          <Step number={3} title="Generate Video" active={currentStep === 3}>
            <button
              onClick={handleGenerateVideo}
              disabled={isGenerating || !transcript}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-lg font-semibold"
            >
              {isGenerating ? 'Generating Video...' : 'Generate Video Explanation'}
            </button>
            <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center mt-4">
              {videoUrl ? (
                <video src={videoUrl} controls autoPlay className="w-full h-full rounded-lg" />
              ) : (
                <p className="text-white">
                  {isGenerating ? 'Rendering...' : 'Video will appear here'}
                </p>
              )}
            </div>
          </Step>
        </div>
      </div>
    </main>
  );
}