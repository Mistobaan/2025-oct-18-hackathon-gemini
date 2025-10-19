'use client';

import React, { useState, useEffect } from 'react';
import { useGeminiLive } from '@/hooks/use-gemini-live';

// A simple component to display the live transcript and connection status.
const SpeechRecognition: React.FC<{ onTranscriptUpdate: (transcript: string) => void; disabled: boolean }> = ({ onTranscriptUpdate, disabled }) => {
  const [apiKey, setApiKey] = useState<string>(''); // In a real app, use a secure way to handle API keys.
  const { connected, connect, disconnect, transcript } = useGeminiLive({ apiKey });

  useEffect(() => {
    onTranscriptUpdate(transcript);
  }, [transcript, onTranscriptUpdate]);

  const handleToggleConnection = () => {
    if (connected) {
      disconnect();
    } else {
      // For now, we'll use a dummy API key.
      // In a real app, you would get this from a secure source.
      if (!apiKey) {
        const key = window.prompt("Please enter your Gemini API key:");
        if (key) {
          setApiKey(key);
          connect({}); // Pass an empty config for now
        }
      } else {
        connect({});
      }
    }
  };

  return (
    <div className={`p-4 rounded-lg w-full ${disabled ? 'bg-gray-200' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-semibold ${disabled ? 'text-gray-400' : ''}`}>Speech Recognition</h2>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : disabled ? 'bg-gray-400' : 'bg-red-500'}`}></span>
          <span className={disabled ? 'text-gray-400' : ''}>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleToggleConnection}
          disabled={disabled}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {connected ? 'Stop Listening' : 'Start Listening'}
        </button>
      </div>
      <div className="mt-4 p-2 border border-gray-200 rounded min-h-[50px] bg-white">
        <p className="text-gray-700">{transcript || '...'}</p>
      </div>
    </div>
  );
};

export default SpeechRecognition;