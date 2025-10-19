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

type InlineDataPart = {
  inline_data: {
    data: string;
    mime_type: string;
  };
};

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

function toGenerativePart(base64Data: string, mimeType: string): InlineDataPart {
  return {
    inline_data: {
      data: base64Data,
      mime_type: mimeType,
    },
  };
}

function normalizeLatex(text: string): string {
  return text.replace(/```latex/gi, "").replace(/```/g, "").trim();
}

function readTextFromResponse(response: unknown): string {
  if (!response) {
    return "";
  }

  if (typeof response === "string") {
    return response;
  }

  if (typeof response === "object" && response !== null && "result" in response) {
    const nested = readTextFromResponse((response as any).result);
    if (nested) {
      return nested;
    }
  }

  if (
    typeof response === "object" &&
    response !== null &&
    "text" in response &&
    typeof (response as any).text === "function"
  ) {
    try {
      const value = (response as any).text();
      if (typeof value === "string") {
        return value;
      }
    } catch (error) {
      console.warn("Failed to read text() from model response", error);
    }
  }

  const candidates = (response as any).candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        const text = parts
          .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
          .join("")
          .trim();
        if (text) {
          return text;
        }
      }
    }
  }

  if (
    typeof response === "object" &&
    response !== null &&
    "text" in response &&
    typeof (response as any).text === "string"
  ) {
    return (response as any).text as string;
  }

  return "";
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  imagePart: InlineDataPart
): Promise<any> {
  const endpoint = new URL(
    `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    "https://generativelanguage.googleapis.com"
  );
  endpoint.searchParams.set("key", apiKey);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, imagePart],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const errorMessage =
      (errorPayload && (errorPayload.error?.message || JSON.stringify(errorPayload))) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

export function createLatexRecognizer({
  apiKey,
  model = DEFAULT_MODEL,
  prompt = DEFAULT_PROMPT,
}: LatexRecognizerOptions): RecognizeLatexFn {
  return async (dataUrl: string): Promise<string> => {
    const { base64Data, mimeType } = parseDataUrl(dataUrl);
    const imagePart = toGenerativePart(base64Data, mimeType);

    const result = await callGemini(apiKey, model, prompt, imagePart);
    const rawText = readTextFromResponse(result);

    return normalizeLatex(rawText);
  };
}
