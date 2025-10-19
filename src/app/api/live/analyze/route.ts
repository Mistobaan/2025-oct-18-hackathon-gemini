import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODEL = 'gemini-2.5-flash';

function buildPrompt(latex: string, snapshot?: { title?: string; url?: string; html?: string; scrollPosition?: number }) {
  const lines = [
    'You are a Gemini Live session that reviews handwritten mathematical equations.',
    'Analyze the recognized LaTeX equation, explain the math, and infer the user intent based on the captured page context.',
    'Point out potential mistakes, simplifications, or steps the user may need next.',
    'Return the answer as markdown with clear headings and bullet points.',
    '',
    `Recognized LaTeX: ${latex}`,
  ];

  if (snapshot) {
    lines.push('', 'Captured page context (HTML snippet):');
    const snippet = (snapshot.html ?? '').slice(0, 12000);
    lines.push(snippet);
    if (snapshot.url) {
      lines.push('', `Page URL: ${snapshot.url}`);
    }
    if (typeof snapshot.scrollPosition === 'number') {
      lines.push(`Scroll position: ${snapshot.scrollPosition}`);
    }
  }

  return lines.join('\n');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { latex, snapshot } = body as { latex?: string; snapshot?: { title?: string; url?: string; html?: string; scrollPosition?: number } };

    if (!latex || typeof latex !== 'string') {
      return NextResponse.json({ error: 'Missing LaTeX to analyze.' }, { status: 400 });
    }

    const prompt = buildPrompt(latex, snapshot);
    const response = await genAI.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const analysis = response.text?.trim() ?? '';
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Failed to process Gemini Live analysis request', error);
    return NextResponse.json({ error: 'Unable to process Gemini Live analysis request.' }, { status: 500 });
  }
}
