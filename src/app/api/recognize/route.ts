import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { strokes } = body;

    if (!strokes || !Array.isArray(strokes) || strokes.length === 0) {
      return NextResponse.json({ error: 'Invalid strokes data' }, { status: 400 });
    }

    // In the future, this is where we will send the strokes to the Gemini API
    console.log('Received strokes on the backend:', JSON.stringify(strokes, null, 2));

    // For now, return a dummy LaTeX response
    const dummyLatex = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';

    return NextResponse.json({ latex: dummyLatex });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}