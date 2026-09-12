"use client";

import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import {
  chooseBestCandidate,
  cleanOCRText,
  createGrayscaleCanvas,
  cropCanvasToBounds,
  detectInkBounds,
  extractCanvasRegion,
  getLanguageFamily,
  getOCRAttempts,
  getOCRScore,
  getRecognitionLanguages,
  getScriptStats,
  isCjkLanguage,
  normalizeTextForTranslation,
  preprocessCanvas,
  preprocessForFullPageManga,
  recognizeWithLayout,
  mergeOCRLines,
  cleanGroupedOCRText,
  sortOCRLinesMangaOrder,
  removeBackgroundFromCanvas,
  reorderVerticalLines,
} from "@/components/ocrUtils";
import { detectComicText } from '@/components/comicTextDetector';
import type {
  OCRCandidate,
  OCRLine,
  SelectionRect,
  TranslationOverlay,
  UploadedImage,
} from "@/components/types";
import { translateFromBrowser } from "@/components/clientGoogleTranslate";
import { translateWithChromeBuiltIn } from "@/components/clientChromeTranslator";
import { LensCore } from '@rxliuli/chrome-lens-ocr/core';

const STORAGE_KEY = "manga-translations-v1";
const MIN_SELECTION_SIZE = 48;

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type PointerInteraction =
  | {
      mode: "create";
      startX: number;
      startY: number;
    }
  | {
      mode: "move";
      startX: number;
      startY: number;
      initialSelection: SelectionRect;
    }
  | {
      mode: "resize";
      handle: ResizeHandle;
      startX: number;
      startY: number;
      initialSelection: SelectionRect;
    };

type GGScanSegment = {
  text: string;
  box: { x: number; y: number; width: number; height: number };
  source_indices: number[];
};

export default function useMangaTranslator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  const [ocrText, setOcrText] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  const [pendingGGSegments, setPendingGGSegments] = useState<Record<string, GGScanSegment[]>>({});

  // OCR preview settings. The scan is intentionally separate from translation
  // so the raw recognition can be checked in the browser console first.
  const [ocrChunkHeight, setOcrChunkHeight] = useState(800);

  const [selection, setSelection] = useState<SelectionRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [displaySize, setDisplaySize] = useState({
    width: 0,
    height: 0,
  });

  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
  });

  const [isSelecting, setIsSelecting] = useState(false);

  const [sourceLanguage, setSourceLanguage] = useState("auto");

  const [targetLanguage, setTargetLanguage] = useState("vi");

  const [translatorMode, setTranslatorMode] = useState<
    "image" | "text" | "history" | "crop" | "remove-bg" | "donate"
  >("image");

  const [textSourceLanguage, setTextSourceLanguage] = useState("auto");

  const [textTargetLanguage, setTextTargetLanguage] = useState("vi");

  const [textInput, setTextInput] = useState("");

  const [textOutput, setTextOutput] = useState("");
  const [textTranslationError, setTextTranslationError] = useState<string | null>(null);
  const [imageToolStatus, setImageToolStatus] = useState("");
  const [removeBackgroundStrength, setRemoveBackgroundStrength] = useState(38);

  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [textTranslationProgress, setTextTranslationProgress] = useState({ completed: 0, total: 0 });

  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [draftSelection, setDraftSelection] = useState<SelectionRect | null>(
    null,
  );
  const [draftOcrText, setDraftOcrText] = useState("");
  const [editorSentence, setEditorSentence] = useState("");
  const [editorTranslation, setEditorTranslation] = useState("");
  const [isUpdatingOverlay, setIsUpdatingOverlay] = useState(false);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const generatedImageCountRef = useRef(0);

  // State cho fetch manga từ URL
  const [isFetchingManga, setIsFetchingManga] = useState(false);

  const [overlaysByImage, setOverlaysByImage] = useState<
    Record<string, TranslationOverlay[]>
  >(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error(error);

      return {};
    }
  });

  const currentImage = images[currentIndex];

  const currentOverlays = currentImage
    ? (overlaysByImage[currentImage.id] ?? [])
    : [];
  const activeOverlay = activeOverlayId
    ? (currentOverlays.find((overlay) => overlay.id === activeOverlayId) ??
      null)
    : null;
  const activeEditorRegion = activeOverlay ?? draftSelection;

  const updateDisplaySize = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    setDisplaySize({
      width: rect.width,
      height: rect.height,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlaysByImage));
  }, [overlaysByImage]);

  useEffect(() => {
    updateDisplaySize();

    const handleResize = () => {
      updateDisplaySize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [currentIndex, images.length]);

  useEffect(() => {
    let timeoutId: number | null = null;

    if (!currentImage) {
      timeoutId = window.setTimeout(() => {
        setActiveOverlayId(null);
        setDraftSelection(null);
        setDraftOcrText("");
        setEditorSentence("");
        setEditorTranslation("");
      }, 0);

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    if (!activeOverlayId) return;

    const overlay = (overlaysByImage[currentImage.id] ?? []).find(
      (item) => item.id === activeOverlayId,
    );

    if (!overlay) {
      timeoutId = window.setTimeout(() => {
        setActiveOverlayId(null);
        setEditorSentence("");
        setEditorTranslation("");
      }, 0);

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    timeoutId = window.setTimeout(() => {
      setEditorSentence(overlay.sentenceText);
      setEditorTranslation(overlay.translatedText);
    }, 0);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeOverlayId, currentImage, overlaysByImage]);

  const drawImage = (url: string) => {
    const img = new Image();

    img.src = url;

    img.onload = () => {
      imageRef.current = img;

      const canvas = canvasRef.current;

      if (!canvas) return;

      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width);

      setImageSize({
        width: img.width,
        height: img.height,
      });

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      requestAnimationFrame(() => {
        updateDisplaySize();
      });
    };
  };

  const loadImageElement = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout loading image`));
      }, 30000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load image`));
      };
      img.crossOrigin = "anonymous"; // Thêm dòng này để xử lý CORS
      img.src = url;
    });

  const translateText = async (
    text: string,
    target: string,
    source?: string,
    onChunk?: (translatedText: string, index: number, total: number, sourceText?: string) => void,
  ) => {
    try {
      const sourceMap: Record<string, string> = {
        eng: "en",
        jpn: "ja",
        kor: "ko",
        chi_sim: "zh-CN",
        spa: "es",
        fra: "fr",
        deu: "de",
        ita: "it",
        por: "pt",
        rus: "ru",
        vi: "vi",
        manga_vert: "ja",
      };

      const controller = new AbortController();
      // Nội dung chương dài được dịch theo nhiều đoạn ở server, nên có thể
      // cần lâu hơn 12 giây như trường hợp dịch một đoạn văn ngắn.
      const timeout = window.setTimeout(() => controller.abort(), 180000);
      let response: Response;

      // Ưu tiên gọi Google từ chính browser của người dùng. Nếu CORS, 429
      // hoặc trình duyệt chặn request thì mới rơi xuống route server hiện tại.
      try {
        const chromeTranslated = await translateWithChromeBuiltIn(
          text,
          source ? (sourceMap[source] ?? source) : "auto",
          target,
          onChunk,
        );
        return chromeTranslated
          .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
          .replace(/\s+$/g, "");
      } catch (chromeError) {
        console.info("Chrome Translator unavailable; using Google/server fallback:", chromeError);
      }

      try {
        const clientTranslated = await translateFromBrowser(
          text,
          source ? (sourceMap[source] ?? "auto") : "auto",
          target,
          onChunk,
        );
        return clientTranslated
          .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
          .replace(/\s+$/g, "");
      } catch (clientError) {
        console.info("Browser Google translation unavailable; using server fallback:", clientError);
      }

      try {
        response = await fetch("/api/translate-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            source: source ? (sourceMap[source] ?? "auto") : "auto",
            target,
          }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }

      if (!response.ok) {
        let message = `Translation request failed (${response.status})`;
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData.error) message = errorData.error;
        } catch {
          // Giữ message mặc định nếu response lỗi không phải JSON.
        }
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/x-ndjson") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const translatedChunks: string[] = [];
        const receivedIndexes = new Set<number>();
        let expectedTotal = 0;

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk = JSON.parse(line) as {
              text?: string;
              error?: string;
              index?: number;
              total?: number;
              sourceText?: string;
            };
            if (chunk.error) throw new Error(chunk.error);
            if (typeof chunk.index === "number") receivedIndexes.add(chunk.index);
            if (typeof chunk.total === "number" && chunk.total > expectedTotal) {
              expectedTotal = chunk.total;
            }
            const translatedChunk = (chunk.text || "").replace(/\s+$/g, "");
            const chunkIndex = chunk.index ?? translatedChunks.length;
            translatedChunks[chunkIndex] = translatedChunk;
            onChunk?.(translatedChunk, chunkIndex, chunk.total ?? 0, chunk.sourceText);
          }
          if (done) break;
        }

        if (buffer.trim()) {
          const chunk = JSON.parse(buffer) as { text?: string; error?: string; index?: number; total?: number; sourceText?: string };
          if (chunk.error) throw new Error(chunk.error);
          if (typeof chunk.index === "number") receivedIndexes.add(chunk.index);
          if (typeof chunk.total === "number" && chunk.total > expectedTotal) {
            expectedTotal = chunk.total;
          }
          const translatedChunk = (chunk.text || "").replace(/\s+$/g, "");
          const chunkIndex = chunk.index ?? translatedChunks.length;
          translatedChunks[chunkIndex] = translatedChunk;
          onChunk?.(translatedChunk, chunkIndex, chunk.total ?? 0, chunk.sourceText);
        }
        if (expectedTotal > 0 && receivedIndexes.size !== expectedTotal) {
          throw new Error(`Stream dịch bị thiếu đoạn (${receivedIndexes.size}/${expectedTotal})`);
        }
        return translatedChunks.join("\n\n");
      }

      const data = (await response.json()) as { translatedText?: string };
      return (data.translatedText || text)
        .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
        .replace(/\s+$/g, "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.warn("Translation request timed out");
      } else {
        console.error(error);
      }

      throw error;
    }
  };

  const createImageId = (file: File) =>
    [file.name, file.size, file.lastModified].join("__");

  const createOverlayId = (imageId: string, region: SelectionRect) =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : [imageId, region.x, region.y, region.width, region.height].join("_");

  const recognizeOriginalRegion = async (originalRegion: SelectionRect) => {
    const originalImage = imageRef.current;

    if (!originalImage) return null;

    const realX = Math.max(0, Math.round(originalRegion.x));
    const realY = Math.max(0, Math.round(originalRegion.y));
    const realWidth = Math.min(
      originalImage.width - realX,
      Math.round(originalRegion.width),
    );
    const realHeight = Math.min(
      originalImage.height - realY,
      Math.round(originalRegion.height),
    );

    if (realWidth < 20 || realHeight < 20) {
      return null;
    }

    const upscaleFactor =
      isCjkLanguage(sourceLanguage) ||
      sourceLanguage === "manga_vert" ||
      sourceLanguage === "auto"
        ? 3
        : 2;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = realWidth * upscaleFactor;
    tempCanvas.height = realHeight * upscaleFactor;

    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) return null;

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = "high";

    tempCtx.drawImage(
      originalImage,
      realX,
      realY,
      realWidth,
      realHeight,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height,
    );

    const processedCanvas = preprocessCanvas(tempCanvas);
    const grayscaleCanvas = createGrayscaleCanvas(tempCanvas);
    const inkBounds = detectInkBounds(grayscaleCanvas);
    const focusedRawCanvas = cropCanvasToBounds(tempCanvas, inkBounds);
    const focusedProcessedCanvas = cropCanvasToBounds(
      processedCanvas,
      inkBounds,
    );
    const focusedGrayscaleCanvas = cropCanvasToBounds(
      grayscaleCanvas,
      inkBounds,
    );

    const attempts = getRecognitionLanguages(sourceLanguage).flatMap(
      (language) =>
        getOCRAttempts(language).map((attempt) => ({
          ...attempt,
          label: `${language}:${attempt.label}`,
        })),
    );

    const candidates: OCRCandidate[] = [];

    for (const attempt of attempts) {
      const recognitionLanguage = attempt.label.split(":")[0];
      const recognitionFamily = getLanguageFamily(recognitionLanguage);

      const canvasForRecognition =
        attempt.canvasType === "processed"
          ? focusedProcessedCanvas
          : attempt.canvasType === "grayscale"
            ? focusedGrayscaleCanvas
            : focusedRawCanvas;

      const result = await (
        Tesseract as typeof Tesseract & {
          recognize: (
            image: HTMLCanvasElement,
            langs: string,
            options: Record<string, unknown>,
          ) => Promise<{
            data: {
              lines?: OCRLine[];
              text: string;
              confidence?: number;
            };
          }>;
        }
      ).recognize(canvasForRecognition, recognitionLanguage, {
        logger: () => undefined,
        tessedit_pageseg_mode: attempt.psm,
        preserve_interword_spaces: "1",
      });

      const orderedText = reorderVerticalLines(
        (result.data.lines as OCRLine[]) ?? [],
        recognitionFamily,
      );

      const cleanedText = cleanOCRText(orderedText || result.data.text);

      const textForTranslation = normalizeTextForTranslation(
        cleanedText,
        recognitionFamily,
      );

      const score = getOCRScore(
        textForTranslation,
        result.data.confidence ?? 0,
        recognitionLanguage,
      );
      const { japaneseRatio, koreanRatio, hanRatio } =
        getScriptStats(textForTranslation);

      const scriptRatio =
        recognitionFamily === "jpn"
          ? japaneseRatio
          : recognitionFamily === "kor"
            ? koreanRatio
            : recognitionFamily === "chi_sim"
              ? hanRatio
              : 1;

      candidates.push({
        cleanedText,
        textForTranslation,
        confidence: result.data.confidence ?? 0,
        score,
        label: attempt.label,
        scriptRatio,
        languageFamily: recognitionFamily,
      });
    }

    const bestCandidate = chooseBestCandidate(candidates, sourceLanguage);

    if (!bestCandidate) {
      return null;
    }

    if (
      isCjkLanguage(sourceLanguage) &&
      (bestCandidate.scriptRatio < 0.45 || bestCandidate.confidence < 20)
    ) {
      return null;
    }

    const textForTranslation = bestCandidate.textForTranslation;

    if (!textForTranslation) {
      return null;
    }

    const refinedRegion = inkBounds
      ? {
          x: realX + Math.round(inkBounds.x / upscaleFactor),
          y: realY + Math.round(inkBounds.y / upscaleFactor),
          width: Math.round(inkBounds.width / upscaleFactor),
          height: Math.round(inkBounds.height / upscaleFactor),
        }
      : {
          x: realX,
          y: realY,
          width: realWidth,
          height: realHeight,
        };

    return {
      cleanedText: bestCandidate.cleanedText,
      textForTranslation,
      region: refinedRegion,
    };
  };

  const runOCR = async (selectedArea: SelectionRect) => {
    try {
      if (selectedArea.width < 20 || selectedArea.height < 20) {
        return;
      }

      setIsProcessing(true);

      const originalImage = imageRef.current;
      const canvas = canvasRef.current;

      if (!originalImage || !canvas) return;

      const displayWidth = canvas.getBoundingClientRect().width || canvas.width;

      const displayHeight =
        canvas.getBoundingClientRect().height || canvas.height;

      const scaleX = originalImage.width / displayWidth;
      const scaleY = originalImage.height / displayHeight;

      const recognitionResult = await recognizeOriginalRegion({
        x: Math.max(0, Math.round(selectedArea.x * scaleX)),
        y: Math.max(0, Math.round(selectedArea.y * scaleY)),
        width: Math.round(selectedArea.width * scaleX),
        height: Math.round(selectedArea.height * scaleY),
      });

      if (!recognitionResult) {
        setOcrText("No text detected.");
        return;
      }

      if (currentImage) {
        setDraftSelection({
          x: recognitionResult.region.x,
          y: recognitionResult.region.y,
          width: recognitionResult.region.width,
          height: recognitionResult.region.height,
        });
        setDraftOcrText(recognitionResult.cleanedText);
        setActiveOverlayId(null);
        setEditorSentence(recognitionResult.textForTranslation);
        setEditorTranslation("");
      }

      setOcrText("");
    } catch (error) {
      console.error(error);

      setOcrText("OCR failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const legacyScanEntireImage = async () => {
    try {
      if (!currentImage || !imageRef.current) return;

      setIsProcessing(true);
      setActiveOverlayId(null);
      setDraftSelection(null);
      setDraftOcrText("");
      setEditorSentence("");
      setEditorTranslation("");

      const originalImage = imageRef.current;
      const tempCanvas = document.createElement("canvas");
      const scale = 1.85;

      tempCanvas.width = Math.max(1, Math.round(originalImage.width * scale));
      tempCanvas.height = Math.max(1, Math.round(originalImage.height * scale));

      const tempCtx = tempCanvas.getContext("2d");

      if (!tempCtx) return;

      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(
        originalImage,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
      );

      const processedCanvas = preprocessForFullPageManga(tempCanvas);
      const fullPageLanguage =
        sourceLanguage === "eng" ? "auto" : sourceLanguage;
      const recognitionLanguages =
        sourceLanguage === "eng"
          ? ["jpn_vert", "jpn", "chi_sim_vert", "chi_sim", "kor"]
          : getRecognitionLanguages(sourceLanguage);
      const attempts = recognitionLanguages.flatMap((language) => [
        {
          label: `${language}:sparse`,
          recognitionLanguage: language,
          psm: Tesseract.PSM.SPARSE_TEXT,
        },
        {
          label: `${language}:auto`,
          recognitionLanguage: language,
          psm: Tesseract.PSM.AUTO,
        },
      ]);

      const scanResults: Array<{
        label: string;
        sentenceText: string;
        lines: OCRLine[];
        blocks: Array<{
          text: string;
          confidence: number;
          bbox: {
            x0: number;
            y0: number;
            x1: number;
            y1: number;
          };
        }>;
        words: Array<{
          text: string;
          confidence: number;
          bbox: {
            x0: number;
            y0: number;
            x1: number;
            y1: number;
          };
        }>;
        recognitionFamily: string;
        confidence: number;
      }> = [];
      const ocrCandidates: OCRCandidate[] = [];

      for (const attempt of attempts) {
        const recognitionLanguage = attempt.recognitionLanguage;
        const recognitionFamily = getLanguageFamily(recognitionLanguage);
        const result = await (
          Tesseract as typeof Tesseract & {
            recognize: (
              image: HTMLCanvasElement,
              langs: string,
              options: Record<string, unknown>,
            ) => Promise<{
              data: {
                lines?: OCRLine[];
                blocks?: Array<{
                  text: string;
                  confidence: number;
                  bbox: {
                    x0: number;
                    y0: number;
                    x1: number;
                    y1: number;
                  };
                }> | null;
                words?: Array<{
                  text: string;
                  confidence: number;
                  bbox: {
                    x0: number;
                    y0: number;
                    x1: number;
                    y1: number;
                  };
                }>;
                text: string;
                confidence?: number;
              };
            }>;
          }
        ).recognize(processedCanvas, recognitionLanguage, {
          logger: () => undefined,
          tessedit_pageseg_mode: attempt.psm,
          preserve_interword_spaces: "1",
        });

        const lines = (result.data.lines as OCRLine[]) ?? [];
        const orderedText = reorderVerticalLines(lines, recognitionFamily);
        const cleanedText = cleanOCRText(orderedText || result.data.text);
        const sentenceText = normalizeTextForTranslation(
          cleanedText,
          recognitionFamily,
        );
        const score = getOCRScore(
          sentenceText,
          result.data.confidence ?? 0,
          recognitionLanguage,
        );
        const { japaneseRatio, koreanRatio, hanRatio } =
          getScriptStats(sentenceText);
        const scriptRatio =
          recognitionFamily === "jpn"
            ? japaneseRatio
            : recognitionFamily === "kor"
              ? koreanRatio
              : recognitionFamily === "chi_sim"
                ? hanRatio
                : 1;

        ocrCandidates.push({
          cleanedText,
          textForTranslation: sentenceText,
          confidence: result.data.confidence ?? 0,
          score,
          label: attempt.label,
          scriptRatio,
          languageFamily: recognitionFamily,
        });

        scanResults.push({
          label: attempt.label,
          sentenceText,
          lines,
          blocks: result.data.blocks ?? [],
          words: result.data.words ?? [],
          recognitionFamily,
          confidence: result.data.confidence ?? 0,
        });
      }

      const bestCandidate = chooseBestCandidate(
        ocrCandidates,
        fullPageLanguage,
      );
      const bestScan = bestCandidate
        ? (scanResults.find((item) => item.label === bestCandidate.label) ??
          null)
        : null;

      if (
        !bestScan ||
        !bestScan.sentenceText.trim() ||
        bestScan.sentenceText.trim().length < 2
      ) {
        setOcrText("Không tìm thấy chữ rõ");
        return;
      }

      const scaleDownFactor = scale * 1.9;

      const toOriginalRegion = (bbox: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      }) => {
        const width = Math.max(1, bbox.x1 - bbox.x0);
        const height = Math.max(1, bbox.y1 - bbox.y0);

        return {
          x: Math.max(0, Math.round(bbox.x0 / scaleDownFactor)),
          y: Math.max(0, Math.round(bbox.y0 / scaleDownFactor)),
          width: Math.min(
            originalImage.width,
            Math.round(width / scaleDownFactor),
          ),
          height: Math.min(
            originalImage.height,
            Math.round(height / scaleDownFactor),
          ),
        };
      };

      const blockCandidates = bestScan.blocks
        .map((block) => {
          const rawText = cleanOCRText(block.text ?? "");
          const sentenceText = normalizeTextForTranslation(
            rawText,
            bestScan.recognitionFamily,
          );
          const bbox = block.bbox;

          if (!bbox || !sentenceText) {
            return null;
          }

          const width = Math.max(1, bbox.x1 - bbox.x0);
          const height = Math.max(1, bbox.y1 - bbox.y0);

          if (
            width < processedCanvas.width * 0.012 ||
            height < processedCanvas.height * 0.009 ||
            sentenceText.length < 2
          ) {
            return null;
          }

          return {
            rawText,
            sentenceText,
            region: toOriginalRegion(bbox),
          };
        })
        .filter(
          (
            item,
          ): item is {
            rawText: string;
            sentenceText: string;
            region: SelectionRect;
          } => item !== null,
        );

      const groupedWordCandidates =
        blockCandidates.length > 0
          ? []
          : bestScan.words
              .filter((word) => {
                const text = cleanOCRText(word.text ?? "");
                if (text.length < 2) return false;

                const width = Math.max(1, word.bbox.x1 - word.bbox.x0);
                const height = Math.max(1, word.bbox.y1 - word.bbox.y0);

                return (
                  width >= processedCanvas.width * 0.008 &&
                  height >= processedCanvas.height * 0.007
                );
              })
              .sort((a, b) => {
                const rowDiff = (a.bbox.y0 ?? 0) - (b.bbox.y0 ?? 0);

                if (Math.abs(rowDiff) > 24) {
                  return rowDiff;
                }

                return (a.bbox.x0 ?? 0) - (b.bbox.x0 ?? 0);
              })
              .reduce<
                Array<{
                  rawText: string;
                  sentenceText: string;
                  region: SelectionRect;
                }>
              >((groups, word) => {
                const text = cleanOCRText(word.text ?? "");
                const region = toOriginalRegion(word.bbox);
                const last = groups[groups.length - 1];

                if (!last) {
                  groups.push({
                    rawText: text,
                    sentenceText: text,
                    region,
                  });
                  return groups;
                }

                const lastBottom = last.region.y + last.region.height;
                const verticalGap = Math.abs(region.y - last.region.y);
                const horizontalGap =
                  region.x - (last.region.x + last.region.width);
                const sameRow =
                  verticalGap < Math.max(20, last.region.height * 0.9);

                if (sameRow && horizontalGap > -18 && horizontalGap < 80) {
                  last.rawText = `${last.rawText} ${text}`.trim();
                  last.sentenceText = normalizeTextForTranslation(
                    last.rawText,
                    bestScan.recognitionFamily,
                  );
                  const right = Math.max(
                    last.region.x + last.region.width,
                    region.x + region.width,
                  );
                  const bottom = Math.max(lastBottom, region.y + region.height);
                  last.region = {
                    x: Math.min(last.region.x, region.x),
                    y: Math.min(last.region.y, region.y),
                    width: right - Math.min(last.region.x, region.x),
                    height: bottom - Math.min(last.region.y, region.y),
                  };
                } else {
                  groups.push({
                    rawText: text,
                    sentenceText: text,
                    region,
                  });
                }

                return groups;
              }, [])
              .filter((item) => item.sentenceText.trim().length >= 2);

      const lineCandidates =
        blockCandidates.length > 0 || groupedWordCandidates.length > 0
          ? []
          : bestScan.lines
              .map((line) => {
                const rawText = cleanOCRText(line.text ?? "");
                const sentenceText = normalizeTextForTranslation(
                  rawText,
                  bestScan.recognitionFamily,
                );
                const bbox = line.bbox;

                if (!bbox || !sentenceText) {
                  return null;
                }

                const width = Math.max(1, bbox.x1 - bbox.x0);
                const height = Math.max(1, bbox.y1 - bbox.y0);

                if (
                  width < processedCanvas.width * 0.012 ||
                  height < processedCanvas.height * 0.009 ||
                  sentenceText.length < 2
                ) {
                  return null;
                }

                return {
                  rawText,
                  sentenceText,
                  region: toOriginalRegion(bbox),
                };
              })
              .filter(
                (
                  item,
                ): item is {
                  rawText: string;
                  sentenceText: string;
                  region: SelectionRect;
                } => item !== null,
              );

      const candidates =
        blockCandidates.length > 0
          ? blockCandidates
          : groupedWordCandidates.length > 0
            ? groupedWordCandidates
            : lineCandidates;

      if (candidates.length === 0) {
        setOcrText("Không tìm thấy chữ rõ");
        return;
      }

      const translatedItems = await Promise.all(
        candidates.map(async (item) => ({
          ...item,
          translatedText: await translateText(
            item.sentenceText,
            targetLanguage,
            sourceLanguage,
          ),
        })),
      );

      const nextOverlays: TranslationOverlay[] = translatedItems.map(
        (item) => ({
          id: createOverlayId(currentImage.id, item.region),
          x: item.region.x,
          y: item.region.y,
          width: item.region.width,
          height: item.region.height,
          ocrText: item.rawText,
          sentenceText: item.sentenceText,
          translatedText: item.translatedText,
        }),
      );

      setOverlaysByImage((prev) => ({
        ...prev,
        [currentImage.id]: [...(prev[currentImage.id] ?? []), ...nextOverlays],
      }));

      if (nextOverlays[0]) {
        setActiveOverlayId(nextOverlays[0].id);
        setEditorSentence(nextOverlays[0].sentenceText);
        setEditorTranslation(nextOverlays[0].translatedText);
      }

      setOcrText(
        `Full image scan complete. Added ${nextOverlays.length} translated text regions.`,
      );
    } catch (error) {
      console.error(error);
      setOcrText("Full image scan failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectPage = (index: number) => {
    setCurrentIndex(index);
    drawImage(images[index].url);
    setActiveOverlayId(null);
    setDraftSelection(null);
    setDraftOcrText("");
    setOcrText("");
    setEditorSentence("");
    setEditorTranslation("");
    setSelection({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  };

  const loadImages = (uploadedFiles: FileList | File[]) => {
    const fileArray = Array.from(uploadedFiles);

    const nextImages = fileArray.map((file) => ({
      id: createImageId(file),
      url: URL.createObjectURL(file),
    }));

    if (nextImages.length === 0) return;

    setImages((prev) => {
      const existingIds = new Set(prev.map((image) => image.id));

      const uniqueNewImages = nextImages.filter(
        (image) => !existingIds.has(image.id),
      );

      if (prev.length === 0 && uniqueNewImages[0]) {
        setCurrentIndex(0);
        drawImage(uniqueNewImages[0].url);
      }

      return [...prev, ...uniqueNewImages];
    });
  };

  const deletePage = (index: number) => {
    const targetImage = images[index];

    if (!targetImage) return;

    URL.revokeObjectURL(targetImage.url);

    const nextImages = images.filter((_, current) => current !== index);

    setImages(nextImages);
    setOverlaysByImage((prev) => {
      const nextOverlays = { ...prev };
      delete nextOverlays[targetImage.id];
      return nextOverlays;
    });

    if (nextImages.length === 0) {
      setCurrentIndex(0);
      setActiveOverlayId(null);
      setDraftSelection(null);
      setDraftOcrText("");
      setOcrText("");
      setEditorSentence("");
      setEditorTranslation("");
      setSelection({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
      return;
    }

    const nextIndex = Math.min(
      currentIndex > index ? currentIndex - 1 : currentIndex,
      nextImages.length - 1,
    );

    setCurrentIndex(nextIndex);
    drawImage(nextImages[nextIndex].url);
  };

  const movePage = (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= images.length ||
      toIndex >= images.length
    ) {
      return;
    }

    const nextImages = [...images];
    const [movedImage] = nextImages.splice(fromIndex, 1);
    nextImages.splice(toIndex, 0, movedImage);

    setImages(nextImages);

    if (currentIndex === fromIndex) {
      setCurrentIndex(toIndex);
    } else if (currentIndex > fromIndex && currentIndex <= toIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (currentIndex < fromIndex && currentIndex >= toIndex) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const mergeImages = async () => {
    if (images.length < 2) {
      setOcrText("Cần ít nhất 2 ảnh để ghép.");
      return;
    }

    try {
      setIsProcessing(true);
      setOcrText("Đang sắp xếp và ghép ảnh...");

      // ===== SẮP XẾP ẢNH THEO ĐÚNG THỨ TỰ =====
      const sortedImages = [...images].sort((a, b) => {
        // Lấy số thứ tự từ id (ưu tiên số cuối cùng)
        const getNumber = (str: string) => {
          const matches = str.match(/(\d+)/g);
          if (matches && matches.length > 0) {
            return parseInt(matches[matches.length - 1]);
          }
          return 0;
        };

        const numA = getNumber(a.id);
        const numB = getNumber(b.id);

        // So sánh số
        if (numA !== numB) {
          return numA - numB;
        }

        // Fallback: so sánh theo index trong mảng gốc
        return images.indexOf(a) - images.indexOf(b);
      });

      // Log để debug
      console.log("Thứ tự ảnh sau khi sắp xếp:");
      sortedImages.forEach((img, i) => {
        console.log(`${i + 1}: ${img.id}`);
      });

      // ===== GHÉP TỪNG BATCH =====
      const BATCH_SIZE = 25;
      const imageBatches = [];
      for (let i = 0; i < sortedImages.length; i += BATCH_SIZE) {
        imageBatches.push(sortedImages.slice(i, i + BATCH_SIZE));
      }

      const mergedImages: UploadedImage[] = [];

      for (let batchIndex = 0; batchIndex < imageBatches.length; batchIndex++) {
        const batch = imageBatches[batchIndex];
        const startPage = batchIndex * BATCH_SIZE + 1;
        const endPage = Math.min(
          (batchIndex + 1) * BATCH_SIZE,
          sortedImages.length,
        );

        setOcrText(
          `Đang ghép trang ${startPage} → ${endPage} (batch ${batchIndex + 1}/${imageBatches.length})...`,
        );

        // Tải ảnh trong batch (giữ đúng thứ tự)
        const loadedImages: HTMLImageElement[] = [];
        for (const image of batch) {
          try {
            const img = await loadImageElement(image.url);
            loadedImages.push(img);
          } catch (err) {
            console.warn(`Bỏ qua ảnh lỗi: ${image.id}`, err);
          }
        }

        if (loadedImages.length < 2) continue;

        // Tính kích thước ảnh ghép
        const maxWidth = 1200;
        const mergedWidth = Math.min(
          maxWidth,
          Math.max(...loadedImages.map((img) => Math.min(img.width, maxWidth))),
        );

        const mergedHeight = loadedImages.reduce((total, img) => {
          const scale = Math.min(1, maxWidth / img.width);
          return total + Math.round(img.height * scale);
        }, 0);

        const mergedCanvas = document.createElement("canvas");
        mergedCanvas.width = mergedWidth;
        mergedCanvas.height = mergedHeight;

        const ctx = mergedCanvas.getContext("2d");
        if (!ctx) continue;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, mergedWidth, mergedHeight);

        let offsetY = 0;
        for (const img of loadedImages) {
          const scale = Math.min(1, maxWidth / img.width);
          const drawWidth = Math.round(img.width * scale);
          const drawHeight = Math.round(img.height * scale);
          ctx.drawImage(img, 0, offsetY, drawWidth, drawHeight);
          offsetY += drawHeight;
        }

        let mergedBlob = await new Promise<Blob | null>((resolve) => {
          mergedCanvas.toBlob(resolve, "image/png");
        });

        if (!mergedBlob || mergedBlob.size > 5 * 1024 * 1024) {
          mergedBlob = await new Promise<Blob | null>((resolve) => {
            mergedCanvas.toBlob(resolve, "image/jpeg", 0.8);
          });
        }

        if (!mergedBlob) continue;

        // Đặt tên có số trang rõ ràng
        const mergedImage: UploadedImage = {
          id: `merged_${String(batchIndex + 1).padStart(2, "0")}_pages_${startPage}-${endPage}`,
          url: URL.createObjectURL(mergedBlob),
        };

        mergedImages.push(mergedImage);
      }

      if (mergedImages.length === 0) {
        setOcrText("Không thể ghép ảnh nào.");
        return;
      }

      // ===== THAY THẾ ẢNH GỐC BẰNG ẢNH GHÉP =====
      // Xóa tất cả ảnh gốc, chỉ giữ ảnh ghép
      setImages(mergedImages);
      setCurrentIndex(0);
      drawImage(mergedImages[0].url);

      setOcrText(
        `Đã ghép ${sortedImages.length} ảnh thành ${mergedImages.length} trang.`,
      );
    } catch (error) {
      console.error("Merge error:", error);
      setOcrText(
        "Không thể ghép ảnh: " +
          (error instanceof Error ? error.message : "Lỗi không xác định"),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return;
    }

    loadImages(uploadedFiles);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;

    if (!droppedFiles || droppedFiles.length === 0) {
      return;
    }

    loadImages(droppedFiles);
  };

  const handleTranslateText = async (textOverride?: string) => {
    const textToTranslate = textOverride ?? textInput;
    if (!textToTranslate.trim()) return;
    let latestProgressiveText = textToTranslate;

    try {
      setIsTranslatingText(true);
      setTextTranslationError(null);
      setTextTranslationProgress({ completed: 0, total: 0 });
      setTextOutput(textToTranslate);
      const translatedBySource = new Map<string, string>();

      const translated = await translateText(
        textToTranslate,
        textTargetLanguage,
        textSourceLanguage,
        (chunk, index, total, sourceChunk) => {
          setTextTranslationProgress((current) => ({
            completed: Math.max(current.completed, index + 1),
            total: total || current.total,
          }));
          if (sourceChunk) translatedBySource.set(sourceChunk, chunk);
          let progressiveText = textToTranslate;
          for (const [sourceText, translatedText] of translatedBySource) {
            progressiveText = progressiveText.split(sourceText).join(translatedText);
          }
          latestProgressiveText = progressiveText;
          setTextOutput(progressiveText);
        },
      );

      // Không dùng danh sách chunk làm kết quả cuối: nếu provider trả thiếu
      // một phần thì join() sẽ ghi đè mất phần gốc chưa dịch.
      setTextOutput(
        latestProgressiveText !== textToTranslate
          ? latestProgressiveText
          : translated,
      );
    } catch (error) {
      console.error(error);
      // Giữ nguyên các đoạn đã dịch và phần gốc chưa dịch khi stream bị ngắt.
      setTextOutput(latestProgressiveText);
      setTextTranslationError(error instanceof Error ? error.message : "Dịch văn bản thất bại.");
    } finally {
      setIsTranslatingText(false);
    }
  };

  const appendGeneratedImage = async (
    canvas: HTMLCanvasElement,
    prefix: string,
    statusMessage: string,
  ) => {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      setImageToolStatus("Could not generate the new image.");
      return;
    }

    generatedImageCountRef.current += 1;

    const nextImage: UploadedImage = {
      id: [
        prefix,
        generatedImageCountRef.current,
        currentImage?.id ?? "generated",
      ].join("__"),
      url: URL.createObjectURL(blob),
    };

    setImages((prev) => {
      const nextImages = [...prev, nextImage];
      setCurrentIndex(nextImages.length - 1);
      drawImage(nextImage.url);
      return nextImages;
    });

    clearSelection();
    setImageToolStatus(statusMessage);
  };

  const cropCurrentImage = async () => {
    try {
      if (!currentImage || !imageRef.current || !canvasRef.current) {
        return;
      }

      if (
        selection.width < MIN_SELECTION_SIZE ||
        selection.height < MIN_SELECTION_SIZE
      ) {
        setImageToolStatus("Select an area first to crop.");
        return;
      }

      const canvas = canvasRef.current;
      const originalImage = imageRef.current;
      const displayWidth = canvas.getBoundingClientRect().width || canvas.width;
      const displayHeight =
        canvas.getBoundingClientRect().height || canvas.height;

      const scaleX = originalImage.width / displayWidth;
      const scaleY = originalImage.height / displayHeight;

      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = originalImage.width;
      sourceCanvas.height = originalImage.height;

      const sourceCtx = sourceCanvas.getContext("2d");

      if (!sourceCtx) return;

      sourceCtx.drawImage(
        originalImage,
        0,
        0,
        originalImage.width,
        originalImage.height,
      );

      const croppedCanvas = extractCanvasRegion(sourceCanvas, {
        x: selection.x * scaleX,
        y: selection.y * scaleY,
        width: selection.width * scaleX,
        height: selection.height * scaleY,
      });

      await appendGeneratedImage(
        croppedCanvas,
        "cropped",
        "Cropped image created as a new page.",
      );
    } catch (error) {
      console.error(error);
      setImageToolStatus("Failed to crop image.");
    }
  };

  const removeBackgroundFromCurrentImage = async () => {
    try {
      if (!currentImage || !imageRef.current) {
        return;
      }

      setIsProcessing(true);

      const originalImage = imageRef.current;
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = originalImage.width;
      sourceCanvas.height = originalImage.height;

      const sourceCtx = sourceCanvas.getContext("2d");

      if (!sourceCtx) return;

      sourceCtx.drawImage(
        originalImage,
        0,
        0,
        originalImage.width,
        originalImage.height,
      );

      const transparentCanvas = removeBackgroundFromCanvas(sourceCanvas, {
        strength: removeBackgroundStrength,
      });

      await appendGeneratedImage(
        transparentCanvas,
        "bg-removed",
        "Background removed and saved as a new page.",
      );
    } catch (error) {
      console.error(error);
      setImageToolStatus("Failed to remove background.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCurrentImage = async () => {
    try {
      if (!currentImage) return;

      const link = document.createElement("a");
      link.href = currentImage.url;
      link.download = `${currentImage.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      setImageToolStatus("Failed to download current image.");
    }
  };

  const clampSelection = (
    nextSelection: SelectionRect,
    bounds: { width: number; height: number },
  ) => {
    const width = Math.max(
      MIN_SELECTION_SIZE,
      Math.min(nextSelection.width, bounds.width),
    );
    const height = Math.max(
      MIN_SELECTION_SIZE,
      Math.min(nextSelection.height, bounds.height),
    );
    const x = Math.max(0, Math.min(nextSelection.x, bounds.width - width));
    const y = Math.max(0, Math.min(nextSelection.y, bounds.height - height));

    return { x, y, width, height };
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
      bounds: {
        width: rect.width,
        height: rect.height,
      },
    };
  };

  const scanEntireImage = async () => {
    try {
      if (!currentImage || !imageRef.current) return;

      const originalImage = imageRef.current;
      const chunkHeight = Math.max(400, Math.min(6000, Math.round(ocrChunkHeight)));
      const overlap = Math.min(120, Math.round(chunkHeight * 0.08));
      const recognitionLanguages = getRecognitionLanguages(sourceLanguage);
      const chunks: Array<{
        chunk: number;
        y: number;
        height: number;
        language: string;
        confidence: number;
        text: string;
        lines: Array<{ text: string; bbox?: OCRLine['bbox'] }>;
      }> = [];

      setIsProcessing(true);
      setOcrText(`Đang quét OCR theo vùng cao ${chunkHeight}px...`);
      console.groupCollapsed(
        `[Readora OCR] ${currentImage.id} | source=${sourceLanguage} | chunkHeight=${chunkHeight}px`,
      );
      console.info('OCR model: Tesseract.js multi-pass (sparse + auto + single-block, grouped by bbox)');

      // Detect the whole page once. Chunking is only for scheduling OCR work;
      // running the 1024px ONNX detector once per chunk made long pages slow.
      let pageDetections: Awaited<ReturnType<typeof detectComicText>> = [];
      try {
        const detectionCanvas = document.createElement('canvas');
        detectionCanvas.width = originalImage.width;
        detectionCanvas.height = originalImage.height;
        detectionCanvas.getContext('2d')?.drawImage(originalImage, 0, 0);
        pageDetections = await detectComicText(detectionCanvas);
        console.info(`[ComicTextDetector] page: ${pageDetections.length} boxes`);
      } catch (detectorError) {
        console.warn('[ComicTextDetector] page detection failed; using Tesseract fallback', detectorError);
      }

      for (let y = 0, chunkIndex = 1; y < originalImage.height; chunkIndex += 1) {
        const sourceHeight = Math.min(chunkHeight, originalImage.height - y);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = originalImage.width;
        sourceCanvas.height = sourceHeight;
        const sourceContext = sourceCanvas.getContext('2d');
        if (!sourceContext) break;
        sourceContext.drawImage(
          originalImage,
          0,
          y,
          originalImage.width,
          sourceHeight,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
        );

        const preparedCanvas = preprocessForFullPageManga(sourceCanvas);
        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = Math.round(sourceCanvas.width * 1.9);
        rawCanvas.height = Math.round(sourceCanvas.height * 1.9);
        const rawContext = rawCanvas.getContext('2d');
        if (!rawContext) break;
        rawContext.imageSmoothingEnabled = true;
        rawContext.imageSmoothingQuality = 'high';
        rawContext.drawImage(sourceCanvas, 0, 0, rawCanvas.width, rawCanvas.height);
        const binaryCanvas = preprocessCanvas(rawCanvas);
        const candidates: OCRCandidate[] = [];
        const resultByLabel = new Map<string, { lines: OCRLine[]; confidence: number }>();
        let usedComicDetector = false;

        // ComicTextDetector finds speech/text regions first. OCR each crop as
        // one block so neighbouring panels cannot be merged together.
        try {
          const detectedBoxes = pageDetections
            .filter((box) => box.y < y + sourceHeight && box.y + box.height > y)
            .map((box) => ({ ...box, y: box.y - y }));
          console.info(`[ComicTextDetector] chunk ${chunkIndex}: ${detectedBoxes.length} boxes`);
          console.table(detectedBoxes);
          const detectorLanguage = recognitionLanguages[0] ?? sourceLanguage;
          const detectorLines: OCRLine[] = [];
          let detectorConfidence = 0;
          for (const box of detectedBoxes.slice(0, 8)) {
            const padding = 10;
            const crop = extractCanvasRegion(sourceCanvas, {
              x: Math.max(0, box.x - padding),
              y: Math.max(0, box.y - padding),
              width: Math.min(sourceCanvas.width - Math.max(0, box.x - padding), box.width + padding * 2),
              height: Math.min(sourceCanvas.height - Math.max(0, box.y - padding), box.height + padding * 2),
            });
            const enlarged = document.createElement('canvas');
            enlarged.width = crop.width * 3;
            enlarged.height = crop.height * 3;
            enlarged.getContext('2d')?.drawImage(crop, 0, 0, enlarged.width, enlarged.height);
            const result = await recognizeWithLayout(enlarged, detectorLanguage, Tesseract.PSM.SINGLE_BLOCK);
            const text = cleanGroupedOCRText(result.data.text ?? '');
            if (!text) continue;
            const confidence = result.data.confidence ?? 0;
            detectorConfidence += confidence;
            detectorLines.push({
              text,
              bbox: {
                x0: box.x * 1.9,
                y0: box.y * 1.9,
                x1: (box.x + box.width) * 1.9,
                y1: (box.y + box.height) * 1.9,
              },
            });
          }
          if (detectorLines.length > 0) {
            usedComicDetector = true;
            const detectorText = cleanGroupedOCRText(
              detectorLines.map((line) => line.text).join('\n'),
            );
            candidates.push({
              cleanedText: detectorText,
              textForTranslation: detectorText,
              confidence: detectorConfidence / detectorLines.length,
              score: detectorConfidence / detectorLines.length + Math.min(detectorText.length, 600) * 0.08,
              label: `${detectorLanguage}:detector`,
              scriptRatio: 1,
              languageFamily: getLanguageFamily(detectorLanguage),
            });
            resultByLabel.set(`${detectorLanguage}:detector`, {
              lines: detectorLines,
              confidence: detectorConfidence / detectorLines.length,
            });
          }
        } catch (detectorError) {
          console.warn('[ComicTextDetector] unavailable; using Tesseract fallback', detectorError);
        }

        if (!usedComicDetector) for (const language of recognitionLanguages) {
          for (const [variant, canvas] of [
            ['raw', rawCanvas],
            ['processed', preparedCanvas],
            ['binary', binaryCanvas],
          ] as const) {
            for (const [mode, pageSegMode] of [
              ['sparse', Tesseract.PSM.SPARSE_TEXT],
              ['auto', Tesseract.PSM.AUTO],
              ['block', Tesseract.PSM.SINGLE_BLOCK],
            ] as const) {
            const result = await recognizeWithLayout(
              canvas,
              language,
              pageSegMode,
            );

            // Tesseract.js v7 may omit `lines`; blocks/words still contain boxes.
            const lines = (result.data.blocks ?? []).flatMap((block) =>
              block.paragraphs?.flatMap((paragraph) => paragraph.lines ?? []) ??
              [{ text: block.text ?? '', bbox: block.bbox }],
            ).filter((line) => line.text.trim());
            const fallbackLines = lines.length > 0
              ? lines
              : (result.data.blocks ?? []).flatMap((block) =>
                  block.paragraphs?.flatMap((paragraph) =>
                    paragraph.lines?.flatMap((line) => line.words ?? []) ?? [],
                  ) ?? [],
                ).filter((word) => word.text.trim());
            const groupedLines = mergeOCRLines(fallbackLines);
            const linesForRecognition = sortOCRLinesMangaOrder(
              groupedLines.length > 0 ? groupedLines : fallbackLines,
            ).map((line) => ({
              ...line,
              text: cleanGroupedOCRText(line.text),
            }));
            const family = getLanguageFamily(language);
            const rawText = reorderVerticalLines(linesForRecognition, family) || result.data.text;
            const cleanedText = cleanOCRText(rawText);
            const textForTranslation = normalizeTextForTranslation(cleanedText, family);
            if (!textForTranslation) continue;
            const confidence = result.data.confidence ?? 0;
            const { japaneseRatio, koreanRatio, hanRatio } = getScriptStats(textForTranslation);
            const scriptRatio = family === 'jpn' ? japaneseRatio : family === 'kor' ? koreanRatio : family === 'chi_sim' ? hanRatio : 1;
            const label = `${language}:${variant}:${mode}`;
            candidates.push({
              cleanedText,
              textForTranslation,
              confidence,
              // A high confidence result can still contain only one bubble.
              // Add a small coverage bonus so the full-page candidate is not
              // discarded merely because it recognized fewer characters.
              score:
                getOCRScore(textForTranslation, confidence, language) +
                Math.min(textForTranslation.length, 600) * 0.08,
              label,
              scriptRatio,
              languageFamily: family,
            });
            resultByLabel.set(label, { lines: linesForRecognition, confidence });
            }
          }
        }

        const best = chooseBestCandidate(candidates, sourceLanguage);
        if (best) {
          const scanResult = resultByLabel.get(best.label);
          const variantScale = best.label.endsWith(':raw') ? 1.9 : 1.9;
          const lines = (scanResult?.lines ?? []).map((line) => ({
            ...line,
            bbox: line.bbox
              ? {
                  x0: line.bbox.x0 / variantScale,
                  y0: line.bbox.y0 / variantScale + y,
                  x1: line.bbox.x1 / variantScale,
                  y1: line.bbox.y1 / variantScale + y,
                }
              : undefined,
          }));
          const item = {
            chunk: chunkIndex,
            y,
            height: sourceHeight,
            language: best.label.split(':')[0],
            confidence: best.confidence,
            text: best.cleanedText,
            lines,
          };
          chunks.push(item);
          console.group(`[OCR chunk ${chunkIndex}] y=${y}-${y + sourceHeight}`);
          console.info('language:', item.language, 'confidence:', item.confidence);
          console.info('text:', item.text || '(empty)');
          console.table(lines.map((line) => ({ text: line.text, ...line.bbox })));
          console.groupEnd();
        } else {
          console.info(`[OCR chunk ${chunkIndex}] y=${y}-${y + sourceHeight}: no text`);
        }

        setOcrText(`Đã quét ${Math.min(originalImage.height, y + sourceHeight)}/${originalImage.height}px — tìm thấy ${chunks.length} vùng có chữ.`);
        if (y + sourceHeight >= originalImage.height) break;
        y += Math.max(1, sourceHeight - overlap);
      }

      console.info('[Readora OCR] complete', chunks);
      try {
        await fetch('/api/ocr-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId: currentImage.id,
            sourceLanguage,
            chunkHeight,
            chunks,
          }),
        });
      } catch (logError) {
        console.error('[Readora OCR] could not send server log', logError);
      }
      console.groupEnd();
      setOcrText(
        chunks.length
          ? `OCR xong: ${chunks.length} vùng. Kết quả thô đã được ghi trong Console (F12). Chưa dịch.`
          : 'OCR xong nhưng chưa tìm thấy chữ. Kết quả chi tiết đã ghi trong Console (F12).',
      );
    } catch (error) {
      console.error('[Readora OCR] failed', error);
      setOcrText('OCR thất bại. Xem lỗi trong Console (F12).');
    } finally {
      setIsProcessing(false);
    }
  };

  const testRapidOCR = async (useComicDetector = false) => {
    if (!currentImage) return;
    const totalStarted = performance.now();
    try {
      setIsProcessing(true);
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh'));
        reader.readAsDataURL(blob);
      });
      let detectorBoxes: Awaited<ReturnType<typeof detectComicText>> = [];
      const detectorStarted = performance.now();
      if (useComicDetector && imageRef.current) {
        const isolated = Boolean((navigator as Navigator & { crossOriginIsolated?: boolean }).crossOriginIsolated);
        if (!isolated) {
          console.warn('[ComicTextDetector] browser is not cross-origin isolated; skipping detector immediately');
        } else {
        try {
          const detectionCanvas = document.createElement('canvas');
          detectionCanvas.width = imageRef.current.naturalWidth || imageRef.current.width || 1;
          detectionCanvas.height = imageRef.current.naturalHeight || imageRef.current.height || 1;
          detectionCanvas.getContext('2d')?.drawImage(imageRef.current, 0, 0);
          detectorBoxes = await Promise.race([
            detectComicText(detectionCanvas),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout 15s')), 15_000)),
          ]);
        } catch (detectorError) {
          console.warn('[ComicTextDetector] skipped:', detectorError);
        }
        }
      }
      const detectorMs = Math.round(performance.now() - detectorStarted);
      const requestStarted = performance.now();
      const result = await fetch('/api/rapid-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, boxes: detectorBoxes }),
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || `RapidOCR lỗi (${result.status})`);
      const requestMs = Math.round(performance.now() - requestStarted);
      const totalMs = Math.round(performance.now() - totalStarted);
      const rapidRows = (data.results ?? []) as Array<{
        text: string;
        raw_text?: string;
        confidence: number;
        bbox: Array<[number, number]>;
      }>;
      const words = rapidRows.filter((item) => item.confidence >= 0.7);
      // Do not merge by Y: words from separate manga panels often share the
      // same row and would otherwise become one giant, incorrect bounding box.
      const mergedRows = words.slice().sort((a, b) => {
        const yDiff = a.bbox[0][1] - b.bbox[0][1];
        return Math.abs(yDiff) > 50 ? yDiff : b.bbox[0][0] - a.bbox[0][0];
      });
      console.group(`[RapidOCR] ${currentImage.id}`);
      console.info('timings:', {
        detector_ms: useComicDetector ? detectorMs : 0,
        api_round_trip_ms: requestMs,
        rapidocr_ms: data.elapsed_ms,
        engine_ready_ms: data.timings?.engine_ready_ms,
        recognition_ms: data.timings?.recognition_ms,
        total_ms: totalMs,
      });
      console.info('count:', mergedRows.length);
      console.table(mergedRows.map((item) => ({
        text: item.text,
        confidence: item.confidence,
        bbox: JSON.stringify(item.bbox),
      })));
      console.groupEnd();
      setOcrText(`RapidOCR xong: ${mergedRows.length} dòng trong ${totalMs}ms (OCR ${data.elapsed_ms}ms). Xem Console (F12).`);
    } catch (error) {
      console.error('[RapidOCR] failed:', error);
      setOcrText(`RapidOCR thất bại: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const testRapidOCRWithComicDetector = () => testRapidOCR(true);
  const scanWithGGLens = async () => {
    if (!currentImage || !imageRef.current) return;
    const started = performance.now();
    try {
      setIsProcessing(true);
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const mime = (['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/x-icon'] as string[]).includes(blob.type)
        ? blob.type
        : 'image/jpeg';
      const data = new Uint8Array(await blob.arrayBuffer());
      const image = imageRef.current;
      const lens = new LensCore();
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      const lensMime = mime as Parameters<LensCore['scanByData']>[1];
      const scanLensImage = async (bytes: Uint8Array, width: number, height: number, yOffset: number) => {
        const chunk = await lens.scanByData(bytes, lensMime, [width, height]);
        return {
          language: chunk.language,
          segments: chunk.segments.map((segment) => ({
          ...segment,
          boundingBox: {
            ...segment.boundingBox,
            pixelCoords: { ...segment.boundingBox.pixelCoords, y: segment.boundingBox.pixelCoords.y + yOffset },
          },
          })),
        };
      };
      let segments = [] as Awaited<ReturnType<typeof scanLensImage>>['segments'];
      let detectedLanguage = '';
      if (sourceHeight > 1000 || sourceWidth > 1000) {
        const scale = Math.min(1, 1000 / sourceWidth);
        const chunkHeight = Math.max(200, Math.floor(1000 / scale));
        const overlap = Math.min(40, Math.floor(chunkHeight * 0.05));
        const chunkStep = Math.max(1, chunkHeight - overlap);
        const totalChunks = Math.ceil(Math.max(1, sourceHeight - overlap) / chunkStep);
        let chunkNumber = 0;
        for (let y = 0; y < sourceHeight; y += Math.max(1, chunkHeight - overlap)) {
          chunkNumber += 1;
          setOcrText(`GG Lens: đang quét đoạn ${chunkNumber}/${totalChunks}...`);
          const height = Math.min(chunkHeight, sourceHeight - y);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          canvas.getContext('2d')?.drawImage(image, 0, y, sourceWidth, height, 0, 0, canvas.width, canvas.height);
          const chunkBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
          if (!chunkBlob) continue;
          const chunkResult = await scanLensImage(new Uint8Array(await chunkBlob.arrayBuffer()), sourceWidth, height, y);
          segments.push(...chunkResult.segments);
          if (!detectedLanguage) detectedLanguage = chunkResult.language;
          if (y + height >= sourceHeight) break;
        }
      } else {
        const single = await lens.scanByData(data, lensMime, [sourceWidth, sourceHeight]);
        segments = single.segments;
        detectedLanguage = single.language;
      }
      const result = { language: detectedLanguage, segments };
      const cleanGGText = (text: string) => text
        .replace(/[Υ]/g, 'Y').replace(/[Μ]/g, 'M').replace(/[Α]/g, 'A')
        .replace(/[Β]/g, 'B').replace(/[Ε]/g, 'E').replace(/[Ο]/g, 'O')
        .replace(/[Ρ]/g, 'P').replace(/[Τ]/g, 'T').replace(/[Χ]/g, 'X')
        .replace(/\u03a5/g, 'Y').replace(/\u039c/g, 'M').replace(/\u0391/g, 'A')
        .replace(/\u0392/g, 'B').replace(/\u0395/g, 'E').replace(/\u039f/g, 'O')
        .replace(/\u03a1/g, 'P').replace(/\u03a4/g, 'T').replace(/\u03a7/g, 'X')
        .replace(/\bYOY(\.\.\.)?/gi, 'YOU$1')
        .replace(/\s+/g, ' ').trim();
      const cleanedSegments = result.segments.map((segment, index) => ({
        index,
        text: cleanGGText(segment.text),
        box: segment.boundingBox.pixelCoords,
      })).sort((a, b) => {
        const yDiff = a.box.y - b.box.y;
        return Math.abs(yDiff) > 12 ? yDiff : b.box.x - a.box.x;
      });
      const groupedSegments: Array<{ text: string; box: typeof cleanedSegments[number]['box']; source_indices: number[] }> = [];
      for (const segment of cleanedSegments) {
        const segmentRight = segment.box.x + segment.box.width;
        const segmentBottom = segment.box.y + segment.box.height;
        const candidate = groupedSegments
          .map((group, index) => ({ group, index }))
          .filter(({ group }) => {
            const groupRight = group.box.x + group.box.width;
            const groupBottom = group.box.y + group.box.height;
            const overlapWidth = Math.max(0, Math.min(groupRight, segmentRight) - Math.max(group.box.x, segment.box.x));
            const overlapRatio = overlapWidth / Math.max(1, Math.min(group.box.width, segment.box.width));
            const centerDistance = Math.abs((group.box.x + group.box.width / 2) - (segment.box.x + segment.box.width / 2));
            const verticalGap = Math.max(group.box.y - segmentBottom, segment.box.y - groupBottom, 0);
            return verticalGap <= Math.max(70, segment.box.height * 4) && (overlapRatio >= 0.15 || centerDistance <= Math.max(80, group.box.width * 0.35));
          })
          .sort((a, b) => Math.abs(a.group.box.x - segment.box.x) - Math.abs(b.group.box.x - segment.box.x))[0];
        if (candidate) {
          const group = candidate.group;
          const groupRight = group.box.x + group.box.width;
          const groupBottom = group.box.y + group.box.height;
          const left = Math.min(group.box.x, segment.box.x);
          const top = Math.min(group.box.y, segment.box.y);
          const right = Math.max(groupRight, segmentRight);
          const bottom = Math.max(groupBottom, segmentBottom);
          group.text = /-$/.test(group.text) ? `${group.text.slice(0, -1)}${segment.text}` : `${group.text} ${segment.text}`;
          group.text = group.text.replace(/\s+/g, ' ').trim();
          group.box = { x: left, y: top, width: right - left, height: bottom - top };
          group.source_indices.push(segment.index);
        } else {
          groupedSegments.push({ text: segment.text, box: segment.box, source_indices: [segment.index] });
        }
      }
      const scanSegments = groupedSegments.filter(
        (segment) =>
          segment.text.trim().length >= 2 &&
          /[\p{L}\p{N}]/u.test(segment.text),
      );
      setPendingGGSegments((previous) => ({ ...previous, [currentImage.id]: scanSegments }));
      console.info('[GG Lens OCR] scan-only result saved:', scanSegments.length);
      setOcrText(`GG Lens xong: đã quét ${scanSegments.length} vùng trong ${Math.round(performance.now() - started)}ms. Bấm Dịch để dịch.`);
      return;

      const translatedSegments = await Promise.all(
        groupedSegments
          .filter((segment) => segment.text.trim().length >= 2)
          .map(async (segment) => ({
            ...segment,
            translatedText: await translateText(segment.text, targetLanguage, sourceLanguage),
          })),
      );
      const nextOverlays: TranslationOverlay[] = translatedSegments.map((segment) => ({
        id: createOverlayId(currentImage.id, {
          x: segment.box.x,
          y: segment.box.y,
          width: segment.box.width,
          height: segment.box.height,
        }),
        x: segment.box.x,
        y: segment.box.y,
        width: segment.box.width,
        height: segment.box.height,
        ocrText: segment.text,
        sentenceText: segment.text,
        translatedText: segment.translatedText,
      }));
      setOverlaysByImage((previous) => ({
        ...previous,
        [currentImage.id]: [...(previous[currentImage.id] ?? []), ...nextOverlays],
      }));
      setActiveOverlayId(null);
      setEditorSentence('');
      setEditorTranslation('');
      console.group(`[GG Lens OCR] ${currentImage.id}`);
      console.info('language:', result.language, 'elapsed_ms:', Math.round(performance.now() - started), 'segments:', groupedSegments.length);
      console.table(groupedSegments.map((segment) => ({
        text: segment.text,
        source_indices: segment.source_indices.join(','),
        bbox: JSON.stringify(segment.box),
      })));
      console.groupEnd();
      setOcrText(`GG Lens xong: đã dịch và ghi đè ${nextOverlays.length} vùng trong ${Math.round(performance.now() - started)}ms.`);
    } catch (error) {
      console.error('[GG Lens OCR] failed:', error);
      setOcrText(`GG Lens thất bại: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const translateGGResults = async () => {
    if (!currentImage) return;
    const segments = (pendingGGSegments[currentImage.id] ?? []).filter(
      (segment) => /[\p{L}\p{N}]/u.test(segment.text),
    );
    if (segments.length === 0) {
      setOcrText('Chưa có kết quả GG Lens. Hãy bấm GG Lens trước.');
      return;
    }

    const started = performance.now();
    let translatedCount = 0;
    let failedCount = 0;
    try {
      setIsProcessing(true);
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        setOcrText(
          `Đang dịch vùng ${index + 1}/${segments.length} — đã ghi đè ${translatedCount} vùng...`,
        );

        try {
          const translatedText = await translateText(
            segment.text,
            targetLanguage,
            sourceLanguage,
          );
          const sourceWidth = imageRef.current?.naturalWidth || imageSize.width;
          const sourceHeight = imageRef.current?.naturalHeight || imageSize.height;
          const paddingX = Math.min(56, Math.max(10, segment.box.width * 0.15));
          const paddingY = Math.min(22, Math.max(5, segment.box.height * 0.3));
          const expandedBox = {
            x: Math.max(0, segment.box.x - paddingX),
            y: Math.max(0, segment.box.y - paddingY),
            width: Math.min(
              sourceWidth || segment.box.width + paddingX * 2,
              segment.box.width + paddingX * 2,
            ),
            height: Math.min(
              sourceHeight || segment.box.height + paddingY * 2,
              segment.box.height + paddingY * 2,
            ),
          };
          expandedBox.width = Math.min(
            expandedBox.width,
            (sourceWidth || expandedBox.x + expandedBox.width) - expandedBox.x,
          );
          expandedBox.height = Math.min(
            expandedBox.height,
            (sourceHeight || expandedBox.y + expandedBox.height) - expandedBox.y,
          );
          const nextOverlay: TranslationOverlay = {
            id: createOverlayId(currentImage.id, expandedBox),
            x: expandedBox.x,
            y: expandedBox.y,
            width: expandedBox.width,
            height: expandedBox.height,
            ocrText: segment.text,
            sentenceText: segment.text,
            translatedText,
          };

          // Ghi đè ngay sau khi từng vùng dịch xong, không chờ cả ảnh hoàn tất.
          setOverlaysByImage((previous) => ({
            ...previous,
            [currentImage.id]: [
              ...(previous[currentImage.id] ?? []).filter(
                (overlay) => overlay.id !== nextOverlay.id,
              ),
              nextOverlay,
            ],
          }));
          translatedCount += 1;
          setActiveOverlayId(null);
          setEditorSentence('');
          setEditorTranslation('');
        } catch (error) {
          failedCount += 1;
          console.error('[GG Lens translation] region failed:', {
            index,
            text: segment.text,
            error,
          });
        }
      }

      setOcrText(
        `Đã dịch và ghi đè ${translatedCount}/${segments.length} vùng trong ${Math.round(
          performance.now() - started,
        )}ms${failedCount > 0 ? `; bỏ qua ${failedCount} vùng lỗi.` : '.'}`,
      );
    } catch (error) {
      console.error('[GG Lens translation] failed:', error);
      setOcrText(`Dịch thất bại: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const capturePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Một số trình duyệt mobile không hỗ trợ pointer capture đầy đủ.
    }
  };

  const updateResizeSelection = (
    handle: ResizeHandle,
    initialSelection: SelectionRect,
    deltaX: number,
    deltaY: number,
    bounds: { width: number; height: number },
  ) => {
    let { x, y, width, height } = initialSelection;
    const right = initialSelection.x + initialSelection.width;
    const bottom = initialSelection.y + initialSelection.height;

    if (handle.includes("e")) {
      width = Math.max(
        MIN_SELECTION_SIZE,
        Math.min(
          right + deltaX - initialSelection.x,
          bounds.width - initialSelection.x,
        ),
      );
    }

    if (handle.includes("s")) {
      height = Math.max(
        MIN_SELECTION_SIZE,
        Math.min(
          bottom + deltaY - initialSelection.y,
          bounds.height - initialSelection.y,
        ),
      );
    }

    if (handle.includes("w")) {
      const nextX = Math.max(
        0,
        Math.min(initialSelection.x + deltaX, right - MIN_SELECTION_SIZE),
      );
      x = nextX;
      width = right - nextX;
    }

    if (handle.includes("n")) {
      const nextY = Math.max(
        0,
        Math.min(initialSelection.y + deltaY, bottom - MIN_SELECTION_SIZE),
      );
      y = nextY;
      height = bottom - nextY;
    }

    return clampSelection({ x, y, width, height }, bounds);
  };

  const handleMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isProcessing) return;

    const point = getCanvasPoint(e);

    if (!point) return;

    capturePointer(e);

    interactionRef.current = {
      mode: "create",
      startX: point.x,
      startY: point.y,
    };

    setSelection({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;

    if (!interaction) return;

    const point = getCanvasPoint(e);

    if (!point) return;

    if (interaction.mode === "create") {
      setSelection({
        x: point.x < interaction.startX ? point.x : interaction.startX,
        y: point.y < interaction.startY ? point.y : interaction.startY,
        width: Math.abs(point.x - interaction.startX),
        height: Math.abs(point.y - interaction.startY),
      });

      return;
    }

    if (interaction.mode === "move") {
      setSelection(
        clampSelection(
          {
            ...interaction.initialSelection,
            x: interaction.initialSelection.x + (point.x - interaction.startX),
            y: interaction.initialSelection.y + (point.y - interaction.startY),
          },
          point.bounds,
        ),
      );

      return;
    }

    setSelection(
      updateResizeSelection(
        interaction.handle,
        interaction.initialSelection,
        point.x - interaction.startX,
        point.y - interaction.startY,
        point.bounds,
      ),
    );
  };

  const handleMouseUp = () => {
    const interaction = interactionRef.current;

    interactionRef.current = null;
    setIsSelecting(false);

    if (!interaction) return;

    if (interaction.mode !== "create") {
      return;
    }

    if (
      selection.width < MIN_SELECTION_SIZE ||
      selection.height < MIN_SELECTION_SIZE
    ) {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const defaultSize = Math.max(
        MIN_SELECTION_SIZE * 2,
        Math.min(rect.width, rect.height) * 0.28,
      );

      setSelection({
        x: Math.max(
          0,
          Math.min(selection.x - defaultSize / 2, rect.width - defaultSize),
        ),
        y: Math.max(
          0,
          Math.min(selection.y - defaultSize / 2, rect.height - defaultSize),
        ),
        width: defaultSize,
        height: defaultSize,
      });
    }
  };

  const startMoveSelection = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (isProcessing || selection.width === 0) return;

    const point = getCanvasPoint(e);

    if (!point) return;

    capturePointer(e);

    interactionRef.current = {
      mode: "move",
      startX: point.x,
      startY: point.y,
      initialSelection: selection,
    };
    setIsSelecting(true);
  };

  const startResizeSelection = (
    handle: ResizeHandle,
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    e.stopPropagation();

    if (isProcessing || selection.width === 0) return;

    const point = getCanvasPoint(e);

    if (!point) return;

    capturePointer(e);

    interactionRef.current = {
      mode: "resize",
      handle,
      startX: point.x,
      startY: point.y,
      initialSelection: selection,
    };
    setIsSelecting(true);
  };

  const clearSelection = () => {
    interactionRef.current = null;
    setIsSelecting(false);
    setSelection({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  };

  const scanSelection = async () => {
    if (
      selection.width < MIN_SELECTION_SIZE ||
      selection.height < MIN_SELECTION_SIZE
    ) {
      setOcrText("Selection is too small. Resize the scan area and try again.");
      return;
    }

    const selectionToScan = selection;
    await runOCR(selectionToScan);
    clearSelection();
  };

  const selectOverlay = (overlayId: string) => {
    const overlay = currentOverlays.find((item) => item.id === overlayId);

    if (!overlay) return;

    setDraftSelection(null);
    setDraftOcrText("");
    setActiveOverlayId(overlayId);
    setEditorSentence(overlay.sentenceText);
    setEditorTranslation(overlay.translatedText);
  };

  const closeOverlayEditor = () => {
    setActiveOverlayId(null);
    setDraftSelection(null);
    setDraftOcrText("");
    setEditorSentence("");
    setEditorTranslation("");
  };

  const applyOverlaySentence = async () => {
    if (!currentImage || !editorSentence.trim()) {
      return;
    }

    try {
      setIsUpdatingOverlay(true);

      const nextSentence = editorSentence.trim();
      const translatedText = await translateText(
        nextSentence,
        targetLanguage,
        sourceLanguage,
      );

      if (activeOverlayId) {
        setOverlaysByImage((prev) => ({
          ...prev,
          [currentImage.id]: (prev[currentImage.id] ?? []).map((overlay) =>
            overlay.id === activeOverlayId
              ? {
                  ...overlay,
                  sentenceText: nextSentence,
                  translatedText,
                }
              : overlay,
          ),
        }));
      } else if (draftSelection) {
        const newOverlay: TranslationOverlay = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : [
                  currentImage.id,
                  draftSelection.x,
                  draftSelection.y,
                  draftSelection.width,
                  draftSelection.height,
                ].join("_"),
          x: draftSelection.x,
          y: draftSelection.y,
          width: draftSelection.width,
          height: draftSelection.height,
          ocrText: draftOcrText,
          sentenceText: nextSentence,
          translatedText,
        };

        setOverlaysByImage((prev) => ({
          ...prev,
          [currentImage.id]: [...(prev[currentImage.id] ?? []), newOverlay],
        }));

        setActiveOverlayId(newOverlay.id);
        setDraftSelection(null);
        setDraftOcrText("");
        setEditorTranslation(translatedText);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdatingOverlay(false);
    }
  };

  const saveEditedTranslation = () => {
    if (!currentImage || !activeOverlayId || !editorTranslation.trim()) {
      return;
    }

    const nextSentence = editorSentence.trim();
    const nextTranslation = editorTranslation.trim();

    setOverlaysByImage((prev) => ({
      ...prev,
      [currentImage.id]: (prev[currentImage.id] ?? []).map((overlay) =>
        overlay.id === activeOverlayId
          ? {
              ...overlay,
              sentenceText: nextSentence || overlay.sentenceText,
              translatedText: nextTranslation,
            }
          : overlay,
      ),
    }));
  };

  const deleteOverlay = (overlayId: string) => {
    if (!currentImage) return;

    if (activeOverlayId === overlayId) {
      setActiveOverlayId(null);
      setEditorSentence("");
      setEditorTranslation("");
    }

    setOverlaysByImage((prev) => ({
      ...prev,
      [currentImage.id]: (prev[currentImage.id] ?? []).filter(
        (overlay) => overlay.id !== overlayId,
      ),
    }));
  };

  const getOverlayStyle = (overlay: TranslationOverlay) => {
    if (!imageSize.width || !imageSize.height) {
      return null;
    }

    const scaleX = displaySize.width / imageSize.width;
    const scaleY = displaySize.height / imageSize.height;

    const scaledWidth = overlay.width * scaleX;
    const scaledHeight = overlay.height * scaleY;
    const translatedLength = overlay.translatedText.trim().length || 1;
    const horizontalPadding = Math.min(34, Math.max(15, scaledWidth * 0.2));
    const verticalPadding = Math.min(26, Math.max(12, scaledHeight * 0.44));

    const widthBasedFontSize =
      (scaledWidth + horizontalPadding * 2) /
      Math.max(5, translatedLength * 0.32);

    const heightBasedFontSize = (scaledHeight + verticalPadding * 2) * 0.42;

    const fontSize = Math.max(
      12,
      Math.min(46, widthBasedFontSize, heightBasedFontSize),
    );

    return {
      left: Math.max(0, overlay.x * scaleX - horizontalPadding),
      top: Math.max(0, overlay.y * scaleY - verticalPadding),
      width: scaledWidth + horizontalPadding * 2,
      height: scaledHeight + verticalPadding * 2,
      fontSize: `${fontSize}px`,
      fontFamily:
        '"Comic Sans MS", "Comic Neue", "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif',
      fontWeight: 600,
      lineHeight: 1.12,
      letterSpacing: "0.01em",
    };
  };

  const getOverlayEditorStyle = (region: SelectionRect) => {
    if (!imageSize.width || !imageSize.height || !displaySize.width) {
      return null;
    }

    const scaleX = displaySize.width / imageSize.width;
    const scaleY = displaySize.height / imageSize.height;
    const overlayStyle = {
      left: region.x * scaleX,
      top: region.y * scaleY,
      width: region.width * scaleX,
      height: region.height * scaleY,
    };

    const panelWidth = Math.min(280, Math.max(220, displaySize.width * 0.32));
    const gap = 14;
    const fitsRight =
      overlayStyle.left + overlayStyle.width + gap + panelWidth <=
      displaySize.width;

    const left = fitsRight
      ? overlayStyle.left + overlayStyle.width + gap
      : Math.max(12, overlayStyle.left - panelWidth - gap);

    const top = Math.max(
      12,
      Math.min(overlayStyle.top, displaySize.height - 190),
    );

    return {
      left,
      top,
      width: panelWidth,
    };
  };

  // Hàm fetch manga từ URL
  const fetchMangaFromUrl = async (url: string) => {
    try {
      setIsFetchingManga(true);
      const response = await fetch("/api/fetch-manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (data.success && data.images && data.images.length > 0) {
        // Đánh số thứ tự rõ ràng từ 1 đến N
        const sortedImages = data.images.map(
          (imgUrl: string, index: number) => ({
            id: `page_${String(index + 1).padStart(3, "0")}`,
            url: imgUrl,
          }),
        );

        setImages(sortedImages);
        setCurrentIndex(0);
        drawImage(sortedImages[0].url);
        setOcrText(`Đã lấy ${sortedImages.length} ảnh từ URL.`);
      } else {
        setOcrText(data.error || "Không lấy được ảnh.");
      }
    } catch (error) {
      console.error(error);
      setOcrText("Lỗi kết nối server.");
    } finally {
      setIsFetchingManga(false);
    }
  };

  // RETURN DUY NHẤT
  return {
    activeOverlay,
    activeOverlayId,
    activeEditorRegion,
    applyOverlaySentence,
    canvasRef,
    closeOverlayEditor,
    currentIndex,
    currentOverlays,
    deletePage,
    deleteOverlay,
    downloadCurrentImage,
    editorSentence,
    editorTranslation,
    getOverlayStyle,
    getOverlayEditorStyle,
    handleDrop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleUpload,
    hoveredOverlayId,
    images,
    imageToolStatus,
    isDragging,
    isProcessing,
    ocrChunkHeight,
    setOcrChunkHeight,
    isSelecting,
    isUpdatingOverlay,
    mergeImages,
    movePage,
    ocrText,
    clearSelection,
    scanEntireImage,
    testRapidOCR,
    testRapidOCRWithComicDetector,
    scanWithGGLens,
    translateGGResults,
    scanSelection,
    saveEditedTranslation,
    startMoveSelection,
    startResizeSelection,
    textInput,
    textOutput,
    textTranslationError,
    setTextTranslationError,
    textTranslationProgress,
    setTextOutput,
    textSourceLanguage,
    textTargetLanguage,
    isTranslatingText,
    handleTranslateText,
    cropCurrentImage,
    removeBackgroundFromCurrentImage,
    removeBackgroundStrength,
    selectPage,
    selection,
    selectOverlay,
    setHoveredOverlayId,
    setIsDragging,
    setEditorSentence,
    setEditorTranslation,
    setSourceLanguage,
    setTargetLanguage,
    setTextInput,
    setTextSourceLanguage,
    setTextTargetLanguage,
    setRemoveBackgroundStrength,
    translatorMode,
    setTranslatorMode,
    sourceLanguage,
    targetLanguage,
    setTheme,
    theme,
    isFetchingManga,
    fetchMangaFromUrl,
    drawImage,
    setImages,
    setCurrentIndex,
  };
}
