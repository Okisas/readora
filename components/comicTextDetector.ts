'use client'

import * as ort from 'onnxruntime-web'
import type { SelectionRect } from '@/components/types'

type Detection = SelectionRect & { confidence: number }
let sessionPromise: Promise<ort.InferenceSession> | null = null

if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  const isolated = Boolean((navigator as Navigator & { crossOriginIsolated?: boolean }).crossOriginIsolated)
  ort.env.wasm.numThreads = isolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
  ort.env.wasm.proxy = isolated
  console.info('[ComicTextDetector] environment:', {
    crossOriginIsolated: isolated,
    origin: window.location.origin,
    secureContext: window.isSecureContext,
  })
}

const getSession = () => {
  sessionPromise ??= ort.InferenceSession.create('/models/comic-text-detector.onnx', { executionProviders: ['wasm'] })
  return sessionPromise
}

const iou = (a: Detection, b: Detection) => {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.width, b.x + b.width), y1 = Math.min(a.y + a.height, b.y + b.height)
  const intersection = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = a.width * a.height + b.width * b.height - intersection
  return union > 0 ? intersection / union : 0
}

export const detectComicText = async (sourceCanvas: HTMLCanvasElement) => {
  const inputSize = 1024
  const scale = Math.min(inputSize / sourceCanvas.width, inputSize / sourceCanvas.height)
  const width = Math.max(1, Math.round(sourceCanvas.width * scale))
  const height = Math.max(1, Math.round(sourceCanvas.height * scale))
  const offsetX = Math.floor((inputSize - width) / 2)
  const offsetY = Math.floor((inputSize - height) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = inputSize; canvas.height = inputSize
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  context.fillStyle = '#000'; context.fillRect(0, 0, inputSize, inputSize)
  context.drawImage(sourceCanvas, offsetX, offsetY, width, height)
  const pixels = context.getImageData(0, 0, inputSize, inputSize).data
  const plane = inputSize * inputSize
  const data = new Float32Array(plane * 3)
  for (let index = 0; index < plane; index += 1) {
    data[index] = pixels[index * 4] / 255
    data[plane + index] = pixels[index * 4 + 1] / 255
    data[plane * 2 + index] = pixels[index * 4 + 2] / 255
  }
  const output = await (await getSession()).run({ images: new ort.Tensor('float32', data, [1, 3, inputSize, inputSize]) })
  const raw = output.blk.data as Float32Array
  const detections: Detection[] = []
  for (let index = 0; index + 6 < raw.length; index += 7) {
    const confidence = raw[index + 4] * Math.max(raw[index + 5], raw[index + 6])
    if (confidence < 0.55) continue
    const centerX = raw[index], centerY = raw[index + 1]
    const boxWidth = raw[index + 2], boxHeight = raw[index + 3]
    const x = Math.max(0, (centerX - boxWidth / 2 - offsetX) / scale)
    const y = Math.max(0, (centerY - boxHeight / 2 - offsetY) / scale)
    const right = Math.min(sourceCanvas.width, (centerX + boxWidth / 2 - offsetX) / scale)
    const bottom = Math.min(sourceCanvas.height, (centerY + boxHeight / 2 - offsetY) / scale)
    if (right - x >= 12 && bottom - y >= 12) detections.push({ x, y, width: right - x, height: bottom - y, confidence })
  }
  return detections.sort((a, b) => b.confidence - a.confidence)
    .filter((item, index, all) => all.slice(0, index).every((kept) => iou(item, kept) < 0.35))
    .slice(0, 8)
    .sort((a, b) => a.y - b.y || b.x - a.x)
}
