// app/api/auto-translate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractTextWithPositions } from "@/components/ocrUtils";

export const runtime = "nodejs";

const translateLanguageMap: Record<string, string> = {
  auto: "auto",
  eng: "en",
  jpn: "ja",
  manga_vert: "ja",
  kor: "ko",
  chi_sim: "zh-CN",
  vi: "vi",
};

const toTranslateLanguage = (language: string | undefined, fallback: string) =>
  translateLanguageMap[language ?? ""] ?? language ?? fallback;

const fetchWithTimeout = async (url: string, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, sourceLanguage, targetLanguage } =
      await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Ảnh không hợp lệ" }, { status: 400 });
    }

    // 1. OCR lấy text + vị trí
    const ocrResult = await extractTextWithPositions(
      imageBase64,
      sourceLanguage || "eng",
    );

    if (!ocrResult || ocrResult.lines.length === 0) {
      return NextResponse.json(
        {
          error: "Không tìm thấy chữ trong ảnh",
        },
        { status: 404 },
      );
    }

    const source = toTranslateLanguage(sourceLanguage, "auto");
    const target = toTranslateLanguage(targetLanguage, "vi");

    // 2. Dịch từng dòng. Keep requests concurrent, but use valid Google
    // language codes and a timeout so one stalled request cannot hang the UI.
    const translatedLines = await Promise.all(
      ocrResult.lines.map(async (line: any) => {
        const text = line.text.trim();
        if (!text) return { ...line, translatedText: "" };

        try {
          const translateResponse = await fetchWithTimeout(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`,
          );
          if (!translateResponse.ok) {
            throw new Error(`Translation request failed (${translateResponse.status})`);
          }
          const data = await translateResponse.json();
          const translated =
            data[0]?.map((item: any) => item[0]).join("") || text;

          return { ...line, translatedText: translated };
        } catch (err) {
          console.error("Dịch lỗi:", text, err);
          return { ...line, translatedText: text };
        }
      }),
    );

    // 3. Tạo ảnh mới với chữ đã dịch (dùng canvas)
    // Lưu ý: Cần cài đặt canvas: npm install canvas
    const { createCanvas, loadImage } = await import("canvas");

    const imageBuffer = Buffer.from(imageBase64.split(",")[1], "base64");
    const img = await loadImage(imageBuffer);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    // Vẽ ảnh gốc
    ctx.drawImage(img, 0, 0);

    // Vẽ chữ dịch lên từng vị trí
    for (const line of translatedLines) {
      if (!line.translatedText) continue;

      const { x0, y0, x1, y1 } = line.bbox;
      const width = x1 - x0;
      const height = y1 - y0;

      // Che chữ cũ bằng màu trắng
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x0, y0, width, height);

      // Viết chữ mới
      const fontSize = Math.min(
        (width / line.translatedText.length) * 1.8,
        height * 0.7,
      );
      ctx.font = `${Math.max(10, fontSize)}px Arial, "Noto Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000000";

      // Wrap text nếu dài
      const words = line.translatedText.split(" ");
      let lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > width * 0.9 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = y0 + (height - totalHeight) / 2;

      lines.forEach((lineText, i) => {
        ctx.fillText(
          lineText,
          x0 + width / 2,
          startY + i * lineHeight + fontSize / 2,
        );
      });
    }

    const outputBuffer = canvas.toBuffer("image/png");
    const outputBase64 = `data:image/png;base64,${outputBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      imageWithTranslation: outputBase64,
      originalTexts: translatedLines.map((l) => l.text),
      translatedTexts: translatedLines.map((l) => l.translatedText),
      count: translatedLines.filter((l) => l.translatedText).length,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error:
          "Lỗi xử lý: " +
          (error instanceof Error ? error.message : "Không xác định"),
      },
      { status: 500 },
    );
  }
}
