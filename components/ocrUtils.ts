import Tesseract from "tesseract.js";
import type {
  InkBounds,
  OCRAttempt,
  OCRCandidate,
  OCRLine,
} from "@/components/types";

export const preprocessCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const processedCanvas = document.createElement("canvas");

  processedCanvas.width = sourceCanvas.width;
  processedCanvas.height = sourceCanvas.height;

  const ctx = processedCanvas.getContext("2d");

  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(
    0,
    0,
    processedCanvas.width,
    processedCanvas.height,
  );

  const data = imageData.data;
  let brightnessTotal = 0;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    brightnessTotal += gray;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  const averageBrightness =
    brightnessTotal / (processedCanvas.width * processedCanvas.height);

  const threshold = Math.max(110, Math.min(190, averageBrightness));

  for (let i = 0; i < data.length; i += 4) {
    const contrasted = (data[i] - threshold) * 1.6 + 128;
    const value = contrasted > 132 ? 255 : 0;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  return processedCanvas;
};

export const createGrayscaleCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const processedCanvas = document.createElement("canvas");

  processedCanvas.width = sourceCanvas.width;
  processedCanvas.height = sourceCanvas.height;

  const ctx = processedCanvas.getContext("2d");

  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(
    0,
    0,
    processedCanvas.width,
    processedCanvas.height,
  );

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.15 + 128));

    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
  }

  ctx.putImageData(imageData, 0, 0);

  return processedCanvas;
};

export const detectInkBounds = (
  sourceCanvas: HTMLCanvasElement,
): InkBounds | null => {
  const ctx = sourceCanvas.getContext("2d");

  if (!ctx) return null;

  const { width, height } = sourceCanvas;

  if (!width || !height) return null;

  const imageData = ctx.getImageData(0, 0, width, height);

  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = data[index];

      if (value < 215) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return null;
  }

  const paddingX = Math.max(12, Math.round((maxX - minX + 1) * 0.12));
  const paddingY = Math.max(12, Math.round((maxY - minY + 1) * 0.12));

  const x = Math.max(0, minX - paddingX);
  const y = Math.max(0, minY - paddingY);
  const croppedWidth = Math.min(width - x, maxX - minX + 1 + paddingX * 2);
  const croppedHeight = Math.min(height - y, maxY - minY + 1 + paddingY * 2);

  if (croppedWidth < width * 0.18 || croppedHeight < height * 0.18) {
    return null;
  }

  return {
    x,
    y,
    width: croppedWidth,
    height: croppedHeight,
  };
};

export const cropCanvasToBounds = (
  sourceCanvas: HTMLCanvasElement,
  bounds: InkBounds | null,
) => {
  if (!bounds) return sourceCanvas;

  const croppedCanvas = document.createElement("canvas");

  croppedCanvas.width = bounds.width;
  croppedCanvas.height = bounds.height;

  const ctx = croppedCanvas.getContext("2d");

  if (!ctx) return sourceCanvas;

  ctx.drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  return croppedCanvas;
};

export const normalizeTextForTranslation = (text: string, language: string) => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  if (language === "jpn") {
    return lines
      .join("")
      .replace(/\s+/g, "")
      .replace(/([。、「」！？])\1+/g, "$1")
      .trim();
  }

  if (language === "chi_sim") {
    return lines.join("").replace(/\s+/g, "").trim();
  }

  return lines
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

export const isCjkLanguage = (language: string) =>
  ["jpn", "kor", "chi_sim"].includes(language);

export const getLanguageFamily = (language: string) => {
  if (language.startsWith("jpn")) return "jpn";
  if (language.startsWith("chi_sim")) {
    return "chi_sim";
  }
  if (language.startsWith("kor")) return "kor";

  return language;
};

export const getRecognitionLanguages = (language: string) => {
  if (language === "auto") {
    return ["jpn_vert", "jpn", "chi_sim_vert", "chi_sim", "kor", "eng"];
  }

  if (language === "jpn") {
    return ["jpn_vert", "jpn"];
  }

  if (language === "chi_sim") {
    return ["chi_sim_vert", "chi_sim"];
  }

  return [language];
};

export const cleanOCRText = (text: string) =>
  text.replace(/\n+/g, "\n").replace(/[|]/g, "I").trim();

export const reorderVerticalLines = (lines: OCRLine[], language: string) => {
  const normalizedLines = lines
    .map((line) => ({
      text: line.text.trim(),
      x: line.bbox?.x0 ?? 0,
      y: line.bbox?.y0 ?? 0,
    }))
    .filter((line) => line.text);

  if (normalizedLines.length === 0) {
    return "";
  }

  const averageLineLength =
    normalizedLines.reduce((total, line) => total + line.text.length, 0) /
    normalizedLines.length;

  const shouldTreatAsVertical =
    isCjkLanguage(language) &&
    normalizedLines.length > 1 &&
    averageLineLength <= 12;

  if (!shouldTreatAsVertical) {
    return normalizedLines.map((line) => line.text).join("\n");
  }

  return normalizedLines
    .sort((a, b) => {
      if (Math.abs(a.x - b.x) > 12) {
        return a.x - b.x;
      }

      return a.y - b.y;
    })
    .map((line) => line.text)
    .join("\n");
};

export const getOCRAttempts = (language: string): OCRAttempt[] => {
  const family = getLanguageFamily(language);

  if (family === "jpn") {
    return [
      {
        label: "raw-vert",
        psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
        canvasType: "raw",
      },
      {
        label: "gray-vert",
        psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
        canvasType: "grayscale",
      },
      {
        label: "raw-line",
        psm: Tesseract.PSM.SINGLE_LINE,
        canvasType: "raw",
      },
      {
        label: "gray-auto",
        psm: Tesseract.PSM.AUTO,
        canvasType: "grayscale",
      },
    ];
  }

  if (family === "chi_sim") {
    return [
      {
        label: "raw-vert",
        psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
        canvasType: "raw",
      },
      {
        label: "gray-vert",
        psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
        canvasType: "grayscale",
      },
      {
        label: "gray-auto",
        psm: Tesseract.PSM.AUTO,
        canvasType: "grayscale",
      },
      {
        label: "raw-line",
        psm: Tesseract.PSM.SINGLE_LINE,
        canvasType: "raw",
      },
    ];
  }

  if (family === "kor") {
    return [
      {
        label: "raw-line",
        psm: Tesseract.PSM.SINGLE_LINE,
        canvasType: "raw",
      },
      {
        label: "gray-auto",
        psm: Tesseract.PSM.AUTO,
        canvasType: "grayscale",
      },
      {
        label: "gray-block",
        psm: Tesseract.PSM.SINGLE_BLOCK,
        canvasType: "grayscale",
      },
      {
        label: "processed-auto",
        psm: Tesseract.PSM.AUTO,
        canvasType: "processed",
      },
    ];
  }

  return [
    {
      label: "default-raw-line",
      psm: Tesseract.PSM.SINGLE_LINE,
      canvasType: "raw",
    },
    {
      label: "default-processed-block",
      psm: Tesseract.PSM.SINGLE_BLOCK,
      canvasType: "processed",
    },
  ];
};

export const getScriptStats = (text: string) => {
  const compactText = text.replace(/\s+/g, "");
  const total = compactText.length || 1;

  const latinCount = compactText.match(/[A-Za-z]/g)?.length ?? 0;
  const japaneseCount =
    compactText.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g)?.length ??
    0;
  const koreanCount =
    compactText.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g)?.length ??
    0;
  const hanCount =
    compactText.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g)?.length ?? 0;

  return {
    total,
    latinRatio: latinCount / total,
    japaneseRatio: japaneseCount / total,
    koreanRatio: koreanCount / total,
    hanRatio: hanCount / total,
  };
};

export const getOCRScore = (
  text: string,
  confidence: number,
  language: string,
) => {
  const family = getLanguageFamily(language);
  const compactText = text.replace(/\s+/g, "");

  if (!compactText) {
    return -Infinity;
  }

  const { latinRatio, japaneseRatio, koreanRatio, hanRatio } =
    getScriptStats(compactText);

  const symbolRatio =
    (compactText.match(
      /[^A-Za-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g,
    )?.length ?? 0) / compactText.length;

  if (family === "jpn") {
    const verticalBonus = language.includes("_vert") ? 18 : 0;

    return (
      confidence +
      japaneseRatio * 80 -
      latinRatio * 65 -
      symbolRatio * 45 +
      verticalBonus
    );
  }

  if (family === "kor") {
    return confidence + koreanRatio * 80 - latinRatio * 65 - symbolRatio * 45;
  }

  if (family === "chi_sim") {
    return confidence + hanRatio * 80 - latinRatio * 65 - symbolRatio * 45;
  }

  return confidence - latinRatio * 5;
};

export const chooseBestCandidate = (
  candidates: OCRCandidate[],
  selectedLanguage: string,
) => {
  const validCandidates = candidates
    .filter((candidate) => candidate.textForTranslation)
    .sort((a, b) => b.score - a.score);

  if (validCandidates.length === 0) {
    return null;
  }

  if (selectedLanguage !== "auto") {
    return validCandidates[0];
  }

  const bestCjkCandidate = validCandidates
    .filter((candidate) =>
      ["jpn", "kor", "chi_sim"].includes(candidate.languageFamily),
    )
    .sort((a, b) => b.score - a.score)[0];

  const bestEnglishCandidate = validCandidates
    .filter((candidate) => candidate.languageFamily === "eng")
    .sort((a, b) => b.score - a.score)[0];

  if (!bestEnglishCandidate) {
    return bestCjkCandidate ?? validCandidates[0];
  }

  if (!bestCjkCandidate) {
    return bestEnglishCandidate;
  }

  if (
    bestCjkCandidate.scriptRatio >= 0.45 &&
    bestCjkCandidate.confidence >= 20
  ) {
    return bestCjkCandidate;
  }

  if (
    bestCjkCandidate.scriptRatio >= 0.3 &&
    bestCjkCandidate.score + 12 >= bestEnglishCandidate.score
  ) {
    return bestCjkCandidate;
  }

  return bestEnglishCandidate.score > bestCjkCandidate.score + 18
    ? bestEnglishCandidate
    : bestCjkCandidate;
};

// === THÊM ĐOẠN NÀY VÀO CUỐI FILE ocrUtils.ts ===
export const preprocessForFullPageManga = (
  sourceCanvas: HTMLCanvasElement,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const scale = 1.9;
  canvas.width = Math.floor(sourceCanvas.width * scale);
  canvas.height = Math.floor(sourceCanvas.height * scale);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    gray = (gray - 85) * 2.5 + 85;
    gray = Math.max(0, Math.min(255, gray));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const extractCanvasRegion = (
  sourceCanvas: HTMLCanvasElement,
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) => {
  const safeX = Math.max(0, Math.round(bounds.x));
  const safeY = Math.max(0, Math.round(bounds.y));
  const safeWidth = Math.max(1, Math.round(bounds.width));
  const safeHeight = Math.max(1, Math.round(bounds.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(safeWidth, sourceCanvas.width - safeX);
  canvas.height = Math.min(safeHeight, sourceCanvas.height - safeY);

  const ctx = canvas.getContext("2d");

  if (!ctx) return sourceCanvas;

  ctx.drawImage(
    sourceCanvas,
    safeX,
    safeY,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas;
};

const colorDistance = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
) =>
  Math.sqrt(
    (r1 - r2) * (r1 - r2) +
      (g1 - g2) * (g1 - g2) +
      (b1 - b2) * (b1 - b2),
  );

export const removeBackgroundFromCanvas = (
  sourceCanvas: HTMLCanvasElement,
  options?: {
    strength?: number;
  },
) => {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  const borderPixels: Array<[number, number, number]> = [];

  const pushSampleColor = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    borderPixels.push([
      data[index],
      data[index + 1],
      data[index + 2],
    ]);
  };

  const sampleRadius = Math.max(
    1,
    Math.min(12, Math.floor(Math.min(width, height) * 0.04)),
  );

  const pushCornerBlock = (startX: number, startY: number) => {
    for (let y = startY; y < startY + sampleRadius; y += 1) {
      for (let x = startX; x < startX + sampleRadius; x += 1) {
        pushSampleColor(
          Math.min(width - 1, x),
          Math.min(height - 1, y),
        );
      }
    }
  };

  pushCornerBlock(0, 0);
  pushCornerBlock(Math.max(0, width - sampleRadius), 0);
  pushCornerBlock(0, Math.max(0, height - sampleRadius));
  pushCornerBlock(
    Math.max(0, width - sampleRadius),
    Math.max(0, height - sampleRadius),
  );

  const averageBorder = borderPixels.reduce(
    (acc, [r, g, b]) => {
      acc.r += r;
      acc.g += g;
      acc.b += b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  const count = Math.max(1, borderPixels.length);
  const normalizedStrength = Math.max(
    0,
    Math.min(1, (options?.strength ?? 50) / 100),
  );
  const backgroundR = averageBorder.r / count;
  const backgroundG = averageBorder.g / count;
  const backgroundB = averageBorder.b / count;

  const backgroundDistances = borderPixels.map(([r, g, b]) =>
    colorDistance(r, g, b, backgroundR, backgroundG, backgroundB),
  );
  const backgroundDistanceMean =
    backgroundDistances.reduce((sum, value) => sum + value, 0) / count;
  const backgroundDistanceVariance =
    backgroundDistances.reduce((sum, value) => {
      const delta = value - backgroundDistanceMean;
      return sum + delta * delta;
    }, 0) / count;
  const backgroundDistanceStd = Math.sqrt(
    backgroundDistanceVariance,
  );
  const hardThreshold = Math.max(
    18,
    Math.min(
      84,
      backgroundDistanceMean +
        backgroundDistanceStd * (1.1 + normalizedStrength * 1.2) +
        normalizedStrength * 10,
    ),
  );
  const softThreshold = Math.min(
    112,
    hardThreshold +
      Math.max(
        8,
        backgroundDistanceStd *
          (0.45 + normalizedStrength * 0.75),
      ) +
      normalizedStrength * 8,
  );

  const isBackgroundLike = (pixelIndex: number) => {
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const alpha = data[pixelIndex + 3];

    if (alpha === 0) return true;

    const brightness = (r + g + b) / 3;
    const distance = colorDistance(
      r,
      g,
      b,
      backgroundR,
      backgroundG,
      backgroundB,
    );
    const saturation =
      Math.max(r, g, b) - Math.min(r, g, b);

    if (distance <= hardThreshold) {
      return true;
    }

    return (
      brightness >
        248 - normalizedStrength * 12 &&
      saturation <
        20 + normalizedStrength * 18 &&
      distance <= softThreshold
    );
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pointIndex = y * width + x;

    if (visited[pointIndex]) return;

    const pixelIndex = pointIndex * 4;

    if (!isBackgroundLike(pixelIndex)) return;

    visited[pointIndex] = 1;
    queue[queueEnd] = pointIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const pointIndex = queue[queueStart];
    queueStart += 1;
    const x = pointIndex % width;
    const y = Math.floor(pointIndex / width);
    const pixelIndex = pointIndex * 4;

    data[pixelIndex + 3] = 0;

    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
    enqueue(x + 1, y + 1);
    enqueue(x - 1, y - 1);
    enqueue(x + 1, y - 1);
    enqueue(x - 1, y + 1);
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    const distance = colorDistance(
      data[i],
      data[i + 1],
      data[i + 2],
      backgroundR,
      backgroundG,
      backgroundB,
    );
    const brightness =
      (data[i] + data[i + 1] + data[i + 2]) / 3;
    const saturation =
      Math.max(data[i], data[i + 1], data[i + 2]) -
      Math.min(data[i], data[i + 1], data[i + 2]);

    if (distance <= hardThreshold) {
      data[i + 3] = 0;
      continue;
    }

    if (
      distance < softThreshold &&
      brightness >
        238 - normalizedStrength * 18 &&
      saturation <
        24 + normalizedStrength * 26
    ) {
      const fadeRatio =
        (distance - hardThreshold) /
        Math.max(1, softThreshold - hardThreshold);
      data[i + 3] = Math.round(
        Math.max(0, Math.min(255, 255 * fadeRatio)),
      );
    } else if (
      brightness >
        248 - normalizedStrength * 12 &&
      saturation <
        18 + normalizedStrength * 16 &&
      distance <
        softThreshold + 4 + normalizedStrength * 10
    ) {
      data[i + 3] = Math.min(
        data[i + 3],
        Math.round(220 - normalizedStrength * 80),
      );
    }
  }

  const resultData = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pointIndex = y * width + x;
      const pixelIndex = pointIndex * 4;

      if (data[pixelIndex + 3] === 0) {
        continue;
      }

      let transparentNeighbors = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;

          const neighborIndex =
            ((y + offsetY) * width + (x + offsetX)) * 4;

          if (data[neighborIndex + 3] === 0) {
            transparentNeighbors += 1;
          }
        }
      }

      if (
        transparentNeighbors >=
        Math.max(5, 7 - Math.round(normalizedStrength * 2))
      ) {
        resultData[pixelIndex + 3] = Math.min(
          resultData[pixelIndex + 3],
          Math.round(208 - normalizedStrength * 56),
        );
      } else if (
        transparentNeighbors >=
        Math.max(7, 8 - Math.round(normalizedStrength))
      ) {
        resultData[pixelIndex + 3] = 0;
      }
    }
  }

  imageData.data.set(resultData);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};
