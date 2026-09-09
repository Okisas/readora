import { NextRequest, NextResponse } from "next/server";
import { translateGoogleWeb, translateLibreFirst } from "@/lib/googleTranslate";

export const runtime = "nodejs";

// Một request lớn hơn giúp tránh biến một chương dài thành hàng chục request.
// Kết quả vẫn được stream theo từng batch để UI render dần.
const MAX_CHUNK_LENGTH = 1000;
const CHUNK_DELAY_MS = 800;
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

    for (let index = 0; index < value.length;) {
      const end = Math.min(index + MAX_CHUNK_LENGTH, value.length);
      const boundary = end < value.length ? value.lastIndexOf(" ", end) : end;
      const splitAt = boundary > index + 80 ? boundary : end;
      chunks.push(value.slice(index, splitAt).trim());
      index = splitAt;
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
  try {
    return await translateLibreFirst(text, source, target);
  } catch (error) {
    const status = (error as { status?: number; statusCode?: number }).status ??
      (error as { statusCode?: number }).statusCode;
    if (status !== 429) {
      console.warn(`Google translation unavailable${status ? ` (${status})` : ""}; keeping original chunk`);
    }
    return {
      text,
      provider: status === 429 ? "rate-limited" : "original",
      error: status === 429
        ? "Google Translate đang giới hạn IP. Vui lòng thử lại sau khoảng 1 phút."
        : "Không dịch được đoạn văn này.",
    };
  }
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
    const encoder = new TextEncoder();
    const firstResult = await translateChunk(
      chunks[0],
      String(source),
      String(target),
    );

    // Không mở stream 200 nếu provider đã thất bại ngay từ request đầu tiên.
    if (!['google-translate-web', 'libretranslate'].includes(firstResult.provider)) {
      const status = firstResult.provider === "rate-limited" ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "Google Translate đang giới hạn IP. Vui lòng thử lại sau khoảng 1 phút."
              : "Google Translate không trả về bản dịch.",
          provider: firstResult.provider,
        },
        { status },
      );
    }

    // Gửi NDJSON từng chunk để client có thể render ngay khi một đoạn xong.
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let index = 0; index < chunks.length; index += 1) {
            const result = index === 0
              ? firstResult
              : await translateChunk(chunks[index], String(source), String(target));
            if (!["google-translate-web", "libretranslate"].includes(result.provider)) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    error: "error" in result
                      ? result.error
                      : "Không dịch được đoạn văn này.",
                    provider: result.provider,
                    sourceText: chunks[index],
                    index,
                    total: chunks.length,
                  }) + "\n",
                ),
              );
              controller.close();
              return;
            }
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  ...result,
                  sourceText: chunks[index],
                  index,
                  total: chunks.length,
                }) + "\n",
              ),
            );

            // LibreTranslate đã tạo bản đầy đủ trước. Google chỉ sửa lại
            // cùng chunk; nếu Google bị chặn thì giữ nguyên bản Libre.
            if (result.provider === "libretranslate") {
              try {
                const refined = await translateGoogleWeb(
                  chunks[index],
                  String(source),
                  String(target),
                );
                if (refined.text !== result.text) {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({
                        ...refined,
                        sourceText: chunks[index],
                        index,
                        total: chunks.length,
                      }) + "\n",
                    ),
                  );
                }
              } catch (error) {
                console.warn(`Google refinement unavailable for chunk ${index}; keeping LibreTranslate`, error);
              }
            }
            if (index < chunks.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Text translation error:", error);
    return NextResponse.json(
      { error: "Không thể dịch văn bản lúc này" },
      { status: 502 },
    );
  }
}
