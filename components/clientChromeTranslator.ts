type ChromeTranslator = {
  translate: (text: string) => Promise<string>;
};

type ChromeTranslatorApi = {
  availability: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<ChromeTranslator>;
};

type ChromeLanguageDetector = {
  detect: (text: string) => Promise<Array<{ detectedLanguage: string; confidence: number }>>;
};

const CHUNK_LENGTH = 1000;
const CHUNK_DELAY_MS = 40;
const MODEL_SETUP_TIMEOUT_MS = 15000;

const getApi = () => (globalThis as typeof globalThis & {
  Translator?: ChromeTranslatorApi;
}).Translator;

const normalizeLanguage = (language: string) => {
  if (language === "zh-CN" || language === "zh-Hans" || language === "chi_sim") return "zh";
  if (language === "jpn") return "ja";
  if (language === "kor") return "ko";
  if (language === "eng") return "en";
  return language;
};

const detectSourceLanguage = async (text: string, source: string) => {
  if (source && source !== "auto") return normalizeLanguage(source);

  const detector = (globalThis as typeof globalThis & {
    LanguageDetector?: { create: () => Promise<ChromeLanguageDetector> };
  }).LanguageDetector;
  if (detector) {
    const languageDetector = await detector.create();
    const result = await languageDetector.detect(text.slice(0, 2000));
    const detected = result[0]?.detectedLanguage;
    if (detected) return normalizeLanguage(detected);
  }

  if (/[぀-ヿ]/.test(text)) return "ja";
  if (/[一-鿿]/.test(text)) return "zh";
  return "en";
};

const splitText = (text: string) => {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += CHUNK_LENGTH) {
    chunks.push(text.slice(index, index + CHUNK_LENGTH));
  }
  return chunks.filter(Boolean);
};

export async function translateWithChromeBuiltIn(
  text: string,
  source: string,
  target: string,
  onChunk?: (text: string, index: number, total: number, sourceText: string) => void,
) {
  const api = getApi();
  if (!api) throw new Error("Chrome Translator API không khả dụng");

  const sourceLanguage = await detectSourceLanguage(text, source);
  const targetLanguage = normalizeLanguage(target);
  if (!sourceLanguage || sourceLanguage === targetLanguage) return text;

  const availability = await api.availability({ sourceLanguage, targetLanguage });
  if (availability === "unavailable") {
    throw new Error(`Chrome chưa hỗ trợ dịch ${sourceLanguage} → ${targetLanguage}`);
  }

  const translator = await Promise.race([
    api.create({ sourceLanguage, targetLanguage }),
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Chrome đang tải model dịch; sẽ dùng fallback server")),
        MODEL_SETUP_TIMEOUT_MS,
      );
    }),
  ]);
  const chunks = splitText(text);
  const translated: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const result = (await translator.translate(chunks[index])).trim();
    if (!result || result === chunks[index].trim()) {
      throw new Error("Chrome Translator trả về bản dịch rỗng hoặc không thay đổi");
    }
    translated.push(result);
    onChunk?.(result, index, chunks.length, chunks[index]);
    if (index < chunks.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, CHUNK_DELAY_MS));
    }
  }

  return translated.join("\n\n");
}
