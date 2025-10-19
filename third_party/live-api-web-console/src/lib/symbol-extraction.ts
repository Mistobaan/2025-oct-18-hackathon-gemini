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

export type SymbolBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
};

export type SymbolExtractionOptions = {
  maxSymbols?: number;
  padding?: number;
  minArea?: number;
  minDimension?: number;
};

export type SymbolExtractionResult = {
  boundingBoxes: SymbolBoundingBox[];
  symbolDataUrls: string[];
};

const DEFAULT_MAX_SYMBOLS = 12;
const DEFAULT_PADDING = 4;

function computeOtsuThreshold(histogram: Uint32Array, totalPixels: number): number {
  let sum = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let weightBackground = 0;
  let weightForeground = 0;

  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < histogram.length; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) {
      continue;
    }

    weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) {
      break;
    }

    sumB += t * histogram[t];
    const meanBackground = sumB / weightBackground;
    const meanForeground = (sum - sumB) / weightForeground;
    const betweenClassVariance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (betweenClassVariance > maxVariance) {
      maxVariance = betweenClassVariance;
      threshold = t;
    }
  }

  return threshold;
}

function segmentSymbols(
  imageData: ImageData,
  { maxSymbols = DEFAULT_MAX_SYMBOLS, padding = DEFAULT_PADDING, minArea, minDimension }: SymbolExtractionOptions = {}
): SymbolBoundingBox[] {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  if (!totalPixels) {
    return [];
  }

  const grayscale = new Uint8ClampedArray(totalPixels);
  const histogram = new Uint32Array(256);

  for (let i = 0; i < totalPixels; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const value = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    grayscale[i] = value;
    histogram[value] += 1;
  }

  const threshold = computeOtsuThreshold(histogram, totalPixels);
  const mask = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i += 1) {
    mask[i] = grayscale[i] < threshold ? 1 : 0;
  }

  const visited = new Uint8Array(totalPixels);
  const boxes: SymbolBoundingBox[] = [];

  const computedMinArea =
    typeof minArea === "number" && minArea > 0 ? minArea : Math.max(80, Math.floor(totalPixels / 5000));
  const computedMinDimension = typeof minDimension === "number" && minDimension > 0 ? minDimension : 6;

  const stack: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] === 0 || visited[index]) {
        continue;
      }

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;

      stack.push(index);
      visited[index] = 1;

      while (stack.length) {
        const current = stack.pop() as number;
        const currentX = current % width;
        const currentY = Math.floor(current / width);

        area += 1;
        if (currentX < minX) minX = currentX;
        if (currentX > maxX) maxX = currentX;
        if (currentY < minY) minY = currentY;
        if (currentY > maxY) maxY = currentY;

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const neighborIndex = ny * width + nx;
          if (mask[neighborIndex] === 0 || visited[neighborIndex]) {
            continue;
          }
          visited[neighborIndex] = 1;
          stack.push(neighborIndex);
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;

      if (area < computedMinArea || boxWidth < computedMinDimension || boxHeight < computedMinDimension) {
        continue;
      }

      const expandedPadding = Math.max(0, padding);
      const paddedX = Math.max(0, minX - expandedPadding);
      const paddedY = Math.max(0, minY - expandedPadding);
      const paddedWidth = Math.min(width - paddedX, boxWidth + expandedPadding * 2);
      const paddedHeight = Math.min(height - paddedY, boxHeight + expandedPadding * 2);

      boxes.push({
        x: paddedX,
        y: paddedY,
        width: paddedWidth,
        height: paddedHeight,
        area,
      });
    }
  }

  boxes.sort((a, b) => {
    if (a.y === b.y) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  if (maxSymbols && boxes.length > maxSymbols) {
    return boxes.slice(0, maxSymbols);
  }

  return boxes;
}

function cropSymbolFromCanvas(canvas: HTMLCanvasElement, box: SymbolBoundingBox): string {
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(box.width));
  cropCanvas.height = Math.max(1, Math.round(box.height));
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  ctx.drawImage(
    canvas,
    box.x,
    box.y,
    box.width,
    box.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  );

  return cropCanvas.toDataURL("image/png");
}

export function extractSymbolsFromVideo(
  video: HTMLVideoElement,
  options: SymbolExtractionOptions = {}
): SymbolExtractionResult {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) {
    return { boundingBoxes: [], symbolDataUrls: [] };
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = videoWidth;
  captureCanvas.height = videoHeight;
  const ctx = captureCanvas.getContext("2d");

  if (!ctx) {
    return { boundingBoxes: [], symbolDataUrls: [] };
  }

  ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
  const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);

  const boxes = segmentSymbols(imageData, options);
  const symbolDataUrls = boxes.map((box) => cropSymbolFromCanvas(captureCanvas, box)).filter(Boolean);

  return { boundingBoxes: boxes, symbolDataUrls };
}

export { segmentSymbols };
