import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    console.log('[Readora OCR server log]', JSON.stringify(payload, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Readora OCR server log] failed:', error)
    return NextResponse.json({ error: 'Invalid OCR log payload' }, { status: 400 })
  }
}
