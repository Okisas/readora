import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { imageBase64?: string; results?: unknown[] }
    if (!body.imageBase64 || !body.results) return NextResponse.json({ error: 'Thiếu ảnh hoặc kết quả RapidOCR' }, { status: 400 })
    const image = body.imageBase64.replace(/^data:image\/[^;]+;base64,/, '')
    const model = process.env.OLLAMA_MODEL || 'llama3.2-vision'
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: 'json', options: { temperature: 0 }, messages: [{
        role: 'user', images: [image], content: `Manga OCR post-processing. Do not invent text. Use the image and OCR box coordinates to group boxes into separate speech bubbles, fix only obvious spacing/OCR noise, and preserve reading order. Return JSON only: {"groups":[{"source_indices":[0],"text":"...","confidence":0.0}]}\nOCR boxes:\n${JSON.stringify(body.results)}`,
      }] }),
    })
    const raw = await response.text()
    if (!response.ok) return NextResponse.json({ error: `Ollama ${response.status}: ${raw.slice(0, 500)}` }, { status: 502 })
    const parsed = JSON.parse(raw) as { message?: { content?: string } }
    const result = JSON.parse((parsed.message?.content || '{}').replace(/^```json\s*|\s*```$/g, '').trim())
    console.log('[Ollama OCR]', JSON.stringify({ model, groups: result.groups }, null, 2))
    return NextResponse.json({ model, ...result })
  } catch (error) {
    console.error('[Ollama OCR] failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Ollama OCR thất bại' }, { status: 502 })
  }
}
