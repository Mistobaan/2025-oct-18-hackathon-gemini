/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GoogleGenAI, type Part } from "@google/genai";

export type RecognizeLatexFn = (dataUrl: string) => Promise<string>;

export type LatexRecognizerOptions = {
  apiKey: string;
  model?: string;
  prompt?: string;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_PROMPT =
  "Return only the LaTeX representation of the isolated mathematical symbol in this cropped image.";

class InvalidImageError extends Error {}

function parseDataUrl(dataUrl: string): { base64Data: string; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new InvalidImageError("Invalid image data");
  }

  const [, mimeType, base64Data] = match;
  if (!mimeType.startsWith("image/")) {
    throw new InvalidImageError("Unsupported image type");
  }

  if (!base64Data) {
    throw new InvalidImageError("Missing image payload");
  }

  return { base64Data, mimeType };
}

function toGenerativePart(base64Data: string, mimeType: string): Part {
  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

function normalizeLatex(text: string): string {
  return text.replace(/```latex/gi, "").replace(/```/g, "").trim();
}

export function createLatexRecognizer({
  apiKey,
  model = DEFAULT_MODEL,
  prompt = DEFAULT_PROMPT,
}: LatexRecognizerOptions): RecognizeLatexFn {
  const client = new GoogleGenAI({ apiKey });

  return async (dataUrl: string): Promise<string> => {
    const { base64Data, mimeType } = parseDataUrl(dataUrl);
    const imagePart = toGenerativePart(base64Data, mimeType);

    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, imagePart],
        },
      ],
    });

    return normalizeLatex(response.text ?? "");
  };
}
