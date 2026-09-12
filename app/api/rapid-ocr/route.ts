import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  let tempFile = ''
  try {
    const { imageBase64, boxes } = await request.json() as {
      imageBase64?: string
      boxes?: Array<{ x: number; y: number; width: number; height: number }>
    }
    if (!imageBase64) return NextResponse.json({ error: 'Thiếu ảnh OCR' }, { status: 400 })

    const match = imageBase64.match(/^data:image\/([\w+.-]+);base64,(.+)$/)
    if (!match) return NextResponse.json({ error: 'Ảnh phải ở dạng data URL' }, { status: 400 })

    const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
    tempFile = path.join(os.tmpdir(), `readora-rapid-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`)
    await fs.writeFile(tempFile, Buffer.from(match[2], 'base64'))

    const python = process.platform === 'win32'
      ? path.join(process.cwd(), '.venv-rapidocr', 'Scripts', 'python.exe')
      : path.join(process.cwd(), '.venv-rapidocr', 'bin', 'python')
    const script = path.join(process.cwd(), 'scripts', 'benchmark-rapidocr.py')
    const args = [script, tempFile]
    if (boxes?.length) args.push('--boxes', JSON.stringify(boxes.slice(0, 32)))
    const { stdout, stderr } = await execFileAsync(python, args, {
      timeout: 110_000,
      maxBuffer: 10 * 1024 * 1024,
    })
    if (stderr.trim()) console.warn('[RapidOCR]', stderr.trim())
    const payload = JSON.parse(stdout) as {
      engine?: string
      elapsed_ms?: number
      count?: number
      results?: unknown[]
      timings?: { engine_ready_ms?: number; recognition_ms?: number }
    }
    console.log('[RapidOCR server]', JSON.stringify({
      engine: payload.engine,
      elapsed_ms: payload.elapsed_ms,
      timings: payload.timings,
      count: payload.count,
      results: payload.results,
    }, null, 2))
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[RapidOCR] failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'RapidOCR thất bại',
    }, { status: 500 })
  } finally {
    if (tempFile) await fs.unlink(tempFile).catch(() => undefined)
  }
}
