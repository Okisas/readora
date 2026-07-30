// app/api/ocr-extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { extractTextWithPositions } from "@/components/ocrUtils";

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, language } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "Ảnh không hợp lệ" }, { status: 400 });
    }

    // Lấy text + vị trí
    const result = await extractTextWithPositions(
      imageBase64,
      language || "eng",
    );

    if (!result || result.lines.length === 0) {
      return NextResponse.json(
        {
          error: "Không tìm thấy chữ trong ảnh",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      fullText: result.fullText,
      lines: result.lines,
      words: result.words,
      count: result.lines.length,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Lỗi xử lý OCR" }, { status: 500 });
  }
}
