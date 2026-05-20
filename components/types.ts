export type UploadedImage = {
  id: string
  url: string
}

export type TranslationOverlay = {
  id: string
  x: number
  y: number
  width: number
  height: number
  ocrText: string
  sentenceText: string
  translatedText: string
}

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
}

export type OCRLine = {
  text: string
  bbox?: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export type OCRAttempt = {
  label: string
  psm: string
  canvasType: 'raw' | 'processed' | 'grayscale'
}

export type OCRCandidate = {
  cleanedText: string
  textForTranslation: string
  confidence: number
  score: number
  label: string
  scriptRatio: number
  languageFamily: string
}

export type InkBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type GoogleTranslateResponse = [
  Array<[string, ...unknown[]]>,
  ...unknown[],
]
