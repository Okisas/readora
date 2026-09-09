import { translate } from "@vitalets/google-translate-api";
import { translateViaGoogleWeb } from "@/lib/googleTranslateWeb";
import { findTranslation, rememberTranslation } from "@/lib/translationMemory";

const TRANSLATION_TIMEOUT_MS = 10000;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
let rateLimitedUntil = 0;
const LANGUAGE_ALIASES: Record<string, string> = {
  eng: "en", jpn: "ja", kor: "ko", chi_sim: "zh-CN", "zh-CN": "zh-Hans",
  zh: "zh-Hans", spa: "es", fra: "fr", deu: "de", ita: "it", por: "pt",
  rus: "ru", manga_vert: "ja",
};

const normalizeLanguage = (language: string) => LANGUAGE_ALIASES[language] ?? language;

export async function googleTranslate(text: string, from = "auto", to = "vi") {
  const value = text.trim();
  const resolvedFrom = normalizeLanguage(from);
  const resolvedTo = normalizeLanguage(to);
  if (!value || resolvedFrom === resolvedTo) return text;
  if (Date.now() < rateLimitedUntil) {
    const error = new Error("Google Translate is temporarily rate limited");
    Object.assign(error, { status: 429, statusCode: 429 });
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
  try {
    try {
      const result = await translate(value, {
        from: resolvedFrom,
        to: resolvedTo,
        fetchOptions: { signal: controller.signal },
      });
      return result.text.trim() || text;
    } catch (error) {
      const status = (error as { status?: number; statusCode?: number }).status ??
        (error as { statusCode?: number }).statusCode;
      if (status === 429) rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function translateLibre(text: string, from = "auto", to = "vi") {
  const source = normalizeLanguage(from);
  const target = normalizeLanguage(to);
  const baseUrl = process.env.LIBRETRANSLATE_URL?.trim() || "http://127.0.0.1:5000";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text, source, target, format: "text",
      ...(process.env.LIBRETRANSLATE_API_KEY ? { api_key: process.env.LIBRETRANSLATE_API_KEY } : {}),
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`LibreTranslate request failed (${response.status})`);
  const data = (await response.json()) as { translatedText?: string };
  const translatedText = data.translatedText?.trim();
  if (!translatedText || translatedText.normalize("NFKC") === text.trim().normalize("NFKC")) {
    throw new Error("LibreTranslate trả về bản dịch rỗng hoặc nguyên văn");
  }
  await rememberTranslation({ text, translatedText, source, target, provider: "libretranslate" });
  return { text: translatedText, provider: "libretranslate" as const };
}

export async function translateGoogleWeb(text: string, from = "auto", to = "vi") {
  const source = normalizeLanguage(from);
  const target = normalizeLanguage(to);
  const translatedText = (await translateViaGoogleWeb(text, from, to)).trim();
  if (!translatedText || translatedText.normalize("NFKC") === text.trim().normalize("NFKC")) {
    throw new Error("Google Translate trả về bản dịch rỗng hoặc nguyên văn");
  }
  await rememberTranslation({ text, translatedText, source, target, provider: "google-translate-web" });
  return { text: translatedText, provider: "google-translate-web" as const };
}

// LibreTranslate tạo bản đầy đủ trước; Google chỉ là fallback.
export async function translateWithFallback(text: string, from = "auto", to = "vi") {
  const source = normalizeLanguage(from);
  const target = normalizeLanguage(to);
  const remembered = await findTranslation(text, source, target);
  if (remembered) return { text: remembered, provider: "google-translate-web" as const };
  try {
    return await translateLibre(text, from, to);
  } catch (libreError) {
    console.warn("LibreTranslate unavailable; trying Google Web:", libreError);
    return await translateGoogleWeb(text, from, to);
  }
}

export async function translateLibreFirst(text: string, from = "auto", to = "vi") {
  try {
    return await translateLibre(text, from, to);
  } catch (libreError) {
    console.warn("LibreTranslate unavailable; using Google Web for this chunk:", libreError);
    return await translateGoogleWeb(text, from, to);
  }
}
