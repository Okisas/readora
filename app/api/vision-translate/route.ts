// app/api/vision-translate/route.ts
import { NextRequest, NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import { Translate } from "@google-cloud/translate/build/src/v2/index.js";
import { createCanvas, loadImage } from "canvas";

// Khởi tạo clients
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Khởi tạo Translate client
const translateClient = new Translate({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, sourceLanguage, targetLanguage } =
      await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Ảnh không hợp lệ" }, { status: 400 });
    }

    // 1. OCR bằng Google Cloud Vision
    const [result] = await visionClient.textDetection({
      image: { content: imageBase64.split(",")[1] },
    });

    const detections = result.textAnnotations || [];
    if (detections.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy chữ trong ảnh" },
        { status: 404 },
      );
    }

    const textAnnotations = detections.slice(1);

    // 2. Dịch từng đoạn văn bản
    const translatedResults = await Promise.all(
      textAnnotations.map(async (annotation) => {
        const text = annotation.description || "";
        if (!text.trim()) return null;

        try {
          const [translation] = await translateClient.translate(
            text,
            targetLanguage || "vi",
          );

          const vertices = annotation.boundingPoly?.vertices || [];
          if (vertices.length < 4) return null;

          const xs = vertices.map((v) => v.x || 0);
          const ys = vertices.map((v) => v.y || 0);
          const x = Math.min(...xs);
          const y = Math.min(...ys);
          const width = Math.max(...xs) - x;
          const height = Math.max(...ys) - y;

          return {
            originalText: text,
            translatedText: translation,
            boundingBox: { x, y, width, height },
          };
        } catch (err) {
          console.error("Dịch lỗi:", text, err);
          return null;
        }
      }),
    );

    const validResults = translatedResults.filter((r) => r !== null);

    // 3. Tạo ảnh mới với chữ đã dịch
    const imageBuffer = Buffer.from(imageBase64.split(",")[1], "base64");
    const img = await loadImage(imageBuffer);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    for (const item of validResults) {
      const { x, y, width, height } = item.boundingBox;
      const translatedText = item.translatedText;

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x, y, width, height);

      const fontSize = Math.min(
        (width / translatedText.length) * 1.8,
        height * 0.7,
      );
      ctx.font = `${Math.max(10, fontSize)}px Arial, "Noto Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000000";

      const words = translatedText.split(" ");
      let lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > width * 0.9 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = y + (height - totalHeight) / 2;

      lines.forEach((line, i) => {
        ctx.fillText(
          line,
          x + width / 2,
          startY + i * lineHeight + fontSize / 2,
        );
      });
    }

    const outputBuffer = canvas.toBuffer("image/png");
    const outputBase64 = `data:image/png;base64,${outputBuffer.toString("base64")}`;

    return NextResponse.json({
      success: true,
      originalTexts: validResults.map((r) => r.originalText),
      translatedTexts: validResults.map((r) => r.translatedText),
      imageWithTranslation: outputBase64,
      count: validResults.length,
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
