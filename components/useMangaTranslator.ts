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
  removeBackgroundFromCanvas,
  reorderVerticalLines,
} from "@/components/ocrUtils";
import type {
  GoogleTranslateResponse,
  OCRCandidate,
  OCRLine,
  SelectionRect,
  TranslationOverlay,
  UploadedImage,
} from "@/components/types";

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

export default function useMangaTranslator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  const [ocrText, setOcrText] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

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

  const [sourceLanguage, setSourceLanguage] = useState("eng");

  const [targetLanguage, setTargetLanguage] = useState("vi");

  const [translatorMode, setTranslatorMode] = useState<
    "image" | "text" | "crop" | "remove-bg" | "donate"
  >("image");

  const [textSourceLanguage, setTextSourceLanguage] = useState("eng");

  const [textTargetLanguage, setTextTargetLanguage] = useState("vi");

  const [textInput, setTextInput] = useState("");

  const [textOutput, setTextOutput] = useState("");
  const [imageToolStatus, setImageToolStatus] = useState("");
  const [removeBackgroundStrength, setRemoveBackgroundStrength] = useState(38);

  const [isTranslatingText, setIsTranslatingText] = useState(false);

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
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });

  const translateText = async (
    text: string,
    target: string,
    source?: string,
  ) => {
    try {
      const sourceMap: Record<string, string> = {
        eng: "en",
        jpn: "ja",
        kor: "ko",
        chi_sim: "zh-CN",
        vi: "vi",
        manga_vert: "ja",
      };

      const response = await fetch(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
          (source ? (sourceMap[source] ?? "auto") : "auto") +
          "&tl=" +
          target +
          "&dt=t&q=" +
          encodeURIComponent(text),
      );

      const data = (await response.json()) as GoogleTranslateResponse;

      return data[0].map((item) => item[0]).join("");
    } catch (error) {
      console.error(error);

      return text;
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

  const scanEntireImage = async () => {
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
    if (images.length < 2) return;

    try {
      setIsProcessing(true);

      const loadedImages = await Promise.all(
        images.map((image) => loadImageElement(image.url)),
      );

      const mergedWidth = Math.max(...loadedImages.map((image) => image.width));
      const mergedHeight = loadedImages.reduce(
        (total, image) => total + image.height,
        0,
      );

      const mergedCanvas = document.createElement("canvas");
      mergedCanvas.width = mergedWidth;
      mergedCanvas.height = mergedHeight;

      const ctx = mergedCanvas.getContext("2d");

      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, mergedWidth, mergedHeight);

      let offsetY = 0;

      for (const image of loadedImages) {
        ctx.drawImage(image, 0, offsetY);
        offsetY += image.height;
      }

      const mergedBlob = await new Promise<Blob | null>((resolve) => {
        mergedCanvas.toBlob(resolve, "image/png");
      });

      if (!mergedBlob) return;

      const mergedImage: UploadedImage = {
        id: [
          "merged",
          Date.now(),
          images.map((image) => image.id).join("__"),
        ].join("__"),
        url: URL.createObjectURL(mergedBlob),
      };

      const nextImages = [...images, mergedImage];
      setImages(nextImages);
      setCurrentIndex(nextImages.length - 1);
      drawImage(mergedImage.url);
      setOcrText("Merged image created from the current Uploaded Pages order.");
    } catch (error) {
      console.error(error);
      setOcrText("Failed to merge images.");
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

  const handleTranslateText = async () => {
    if (!textInput.trim()) return;

    try {
      setIsTranslatingText(true);

      const translated = await translateText(
        textInput,
        textTargetLanguage,
        textSourceLanguage,
      );

      setTextOutput(translated);
    } catch (error) {
      console.error(error);
      setTextOutput("Translation failed.");
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

  const getCanvasPoint = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isProcessing) return;

    const point = getCanvasPoint(e);

    if (!point) return;

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const startMoveSelection = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (isProcessing || selection.width === 0) return;

    const point = getCanvasPoint(e);

    if (!point) return;

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
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    e.stopPropagation();

    if (isProcessing || selection.width === 0) return;

    const point = getCanvasPoint(e);

    if (!point) return;

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

    const widthBasedFontSize =
      scaledWidth / Math.max(6, translatedLength * 0.62);

    const heightBasedFontSize = scaledHeight * 0.16;

    const fontSize = Math.max(
      10,
      Math.min(20, widthBasedFontSize, heightBasedFontSize),
    );

    return {
      left: overlay.x * scaleX,
      top: overlay.y * scaleY,
      width: scaledWidth,
      height: scaledHeight,
      fontSize: `${fontSize}px`,
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
    isSelecting,
    isUpdatingOverlay,
    mergeImages,
    movePage,
    ocrText,
    clearSelection,
    scanEntireImage,
    scanSelection,
    saveEditedTranslation,
    startMoveSelection,
    startResizeSelection,
    textInput,
    textOutput,
    textSourceLanguage,
    textTargetLanguage,
    isTranslatingText,
    handleTranslateText,
    cropCurrentImage,
    downloadCurrentImage,
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
  };
}
