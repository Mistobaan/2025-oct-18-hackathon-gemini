import { NextResponse } from 'next/server';
import { GoogleGenAI, type Part } from '@google/genai';
import sharp from 'sharp';

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

class InvalidImageError extends Error { }

type ParsedImage = {
  base64Data: string;
  mimeType: string;
};

function fileToGenerativePart(base64Data: string, mimeType: string): Part {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

function parseImageDataUrl(image: string): ParsedImage {
  const match = /^data:([^;]+);base64,(.+)$/.exec(image);
  if (!match) {
    throw new InvalidImageError('Invalid image data');
  }

  const [, mimeType, base64Data] = match;

  if (!mimeType.startsWith('image/')) {
    throw new InvalidImageError('Unsupported image type');
  }

  if (!base64Data) {
    throw new InvalidImageError('Invalid image payload');
  }

  return { base64Data, mimeType };
}

function mimeTypeFromSharpFormat(format?: string, fallback?: string) {
  if (!format) {
    return fallback;
  }

  switch (format) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'avif':
      return 'image/avif';
    case 'tiff':
      return 'image/tiff';
    case 'heif':
      return 'image/heif';
    default:
      return fallback;
  }
}

async function ensureImageMaxSize(base64Data: string, mimeType: string, maxDimension = 384): Promise<ParsedImage> {
  const inputBuffer = Buffer.from(base64Data, 'base64');

  let metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch {
    throw new InvalidImageError('Unable to read image data');
  }

  const { width, height } = metadata;

  if (!width || !height) {
    throw new InvalidImageError('Unable to determine image size');
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { base64Data, mimeType };
  }

  const { data, info } = await sharp(inputBuffer)
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    base64Data: data.toString('base64'),
    mimeType: mimeTypeFromSharpFormat(info.format, mimeType) ?? mimeType,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    const parsedImage = parseImageDataUrl(image);
    const resizedImage = await ensureImageMaxSize(parsedImage.base64Data, parsedImage.mimeType);
    const imagePart = fileToGenerativePart(resizedImage.base64Data, resizedImage.mimeType);

    const prompt = 'Recognize the mathematical equation in this image and return only the LaTeX representation of it. Do not include any other text or explanations.';

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, imagePart],
        },
      ],
    });

    const text = response.text ?? '';

    // Clean up the response to ensure it's valid LaTeX
    const latex = text.replace(/```latex/g, '').replace(/```/g, '').trim();

    return NextResponse.json({ latex });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
