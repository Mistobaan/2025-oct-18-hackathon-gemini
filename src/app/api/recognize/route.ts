import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function fileToGenerativePart(image: string, mimeType: string): Part {
  return {
    inlineData: {
      data: image.split(',')[1],
      mimeType,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = fileToGenerativePart(image, 'image/png');

    const prompt = 'Recognize the mathematical equation in this image and return only the LaTeX representation of it. Do not include any other text or explanations.';

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up the response to ensure it's valid LaTeX
    const latex = text.replace(/```latex/g, '').replace(/```/g, '').trim();

    return NextResponse.json({ latex });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}