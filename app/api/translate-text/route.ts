import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_CHUNK_LENGTH = 450;

const splitIntoChunks = (text: string) => {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const value = paragraph.trim();
    if (!value) continue;

    if (value.length <= MAX_CHUNK_LENGTH) {
      const candidate = current ? `${current}\n\n${value}` : value;
      if (candidate.length <= MAX_CHUNK_LENGTH) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = value;
      }
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    for (let index = 0; index < value.length; index += MAX_CHUNK_LENGTH) {
      chunks.push(value.slice(index, index + MAX_CHUNK_LENGTH));
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const translateChunk = async (
  text: string,
  source: string,
  target: string,
) => {
  const translateUrl =
    "https://translate.google.com/translate_a/single?client=gtx&sl=" +
    encodeURIComponent(source) +
    "&tl=" +
    encodeURIComponent(target) +
    "&dt=t&q=" +
    encodeURIComponent(text);

  try {
    const response = await fetch(translateUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as Array<
        Array<[string | null, string | null]>
      >;
      const translatedText = Array.isArray(data[0])
        ? data[0].map((item) => item?.[0] || "").join("")
        : "";
      if (translatedText) return { text: translatedText, provider: "google" };
    }
  } catch (error) {
    console.warn("Google translation unavailable:", error);
  }

  try {
    const fallbackUrl =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=" +
      encodeURIComponent(`${source}|${target}`);
    const response = await fetch(fallbackUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as {
        responseData?: { translatedText?: string };
        responseStatus?: number;
      };
      const translatedText = data.responseData?.translatedText?.trim();
      if (translatedText && data.responseStatus === 200) {
        return { text: translatedText, provider: "mymemory" };
      }
    }
  } catch (error) {
    console.warn("Fallback translation unavailable:", error);
  }

  return { text, provider: "original" };
};

export async function POST(request: NextRequest) {
  try {
    const { text, source = "auto", target = "vi" } = await request.json();

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Văn bản dịch không hợp lệ" },
        { status: 400 },
      );
    }

    const chunks = splitIntoChunks(text);
    const translatedChunks: string[] = [];
    const providers = new Set<string>();

    // Dịch tuần tự để tránh bị dịch vụ miễn phí giới hạn request liên tiếp.
    for (const chunk of chunks) {
      const result = await translateChunk(
        chunk,
        String(source),
        String(target),
      );
      translatedChunks.push(result.text);
      providers.add(result.provider);
    }

    return NextResponse.json({
      translatedText: translatedChunks.join("\n\n"),
      provider: Array.from(providers).join("+") || "original",
    });
  } catch (error) {
    console.error("Text translation error:", error);
    return NextResponse.json(
      { error: "Không thể dịch văn bản lúc này" },
      { status: 502 },
    );
  }
}
