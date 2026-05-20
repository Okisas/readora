'use client'

import { Heart, Loader2, QrCode } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Be_Vietnam_Pro } from "next/font/google";

export const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "700", "800"],
});


type DonateCardProps = {
  theme: 'dark' | 'light'
}

const presets = [20000, 50000, 100000, 200000]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)

export default function DonateCard({
  theme,
}: DonateCardProps) {
  const searchParams = useSearchParams()
  const [selectedAmount, setSelectedAmount] =
    useState(50000)
  const [customAmount, setCustomAmount] = useState('')
  const [donorName, setDonorName] = useState('')
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const paymentState = useMemo(() => {
    const code = searchParams.get('code')
    const status = searchParams.get('status')
    const cancelled = searchParams.get('cancel')

    if (!code && !status && !cancelled) {
      return null
    }

    if (status === 'PAID' && cancelled !== 'true') {
      return {
        tone: 'success' as const,
        text: 'Donate thành công. Cảm ơn bạn đã ủng hộ dự án.',
      }
    }

    if (cancelled === 'true' || status === 'CANCELLED') {
      return {
        tone: 'warning' as const,
        text: 'Bạn đã hủy giao dịch.',
      }
    }

    return {
      tone: 'neutral' as const,
      text: `Trạng thái thanh toán: ${status ?? code ?? 'PENDING'}.`,
    }
  }, [searchParams])

  const amount = customAmount.trim()
    ? Number(customAmount)
    : selectedAmount

  const handleDonate = async () => {
    try {
      setError('')

      if (!Number.isInteger(amount) || amount < 1000) {
        setError('Số tiền donate tối thiểu là 1.000 VND.')
        return
      }

      setIsLoading(true)

      const response = await fetch(
        '/api/payos/create-link',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            donorName,
            note,
          }),
        }
      )

      const payload = (await response.json()) as
        | {
            checkoutUrl?: string
            error?: string
          }
        | undefined

      if (!response.ok || !payload?.checkoutUrl) {
        setError(
          payload?.error ??
            'Không tạo được link thanh toán.'
        )
        return
      }

      window.location.href = payload.checkoutUrl
    } catch (requestError) {
      console.error(requestError)
      setError('Không kết nối được tới PayOS.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      className={`mb-6 overflow-hidden rounded-3xl border p-5 backdrop-blur sm:mb-8 sm:p-6 ${
        theme === 'dark'
          ? 'border-zinc-800 bg-zinc-900/70'
          : 'border-zinc-200 bg-white/85'
      }`}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-start">
        <div>
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
              theme === 'dark'
                ? 'border-rose-800/60 bg-rose-950/40 text-rose-200'
                : 'border-rose-200 bg-white/80 text-rose-700'
            }`}
          >
            <Heart className="h-3.5 w-3.5" />
            Donate
          </div>

          <h2 className="mb-2 text-2xl font-extrabold sm:text-3xl">
            Ủng hộ để mình tiếp tục nâng cấp tool
          </h2>

          <p
            className={`max-w-2xl text-sm leading-relaxed sm:text-base ${
              theme === 'dark'
                ? 'text-zinc-300'
                : 'text-zinc-600'
            }`}
          >
            Nếu thấy web hữu ích, bạn có thể donate để hỗ
            trợ chi phí server và phát triển thêm nhiều
            tính năng mới.
          </p>

          {paymentState && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                paymentState.tone === 'success'
                  ? theme === 'dark'
                    ? 'border-emerald-900 bg-emerald-950/40 text-emerald-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : paymentState.tone === 'warning'
                  ? theme === 'dark'
                    ? 'border-amber-900 bg-amber-950/40 text-amber-200'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                  : theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-950/50 text-zinc-200'
                  : 'border-zinc-200 bg-white/80 text-zinc-700'
              }`}
            >
              {paymentState.text}
            </div>
          )}
        </div>

        <div
          className={`rounded-3xl border p-4 sm:p-5 ${
            theme === 'dark'
              ? 'border-white/10 bg-black/30'
              : 'border-white/80 bg-white/80'
          }`}
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" />
            Tạo link Donate
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const active =
                !customAmount.trim() &&
                selectedAmount === preset

              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(preset)
                    setCustomAmount('')
                  }}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? theme === 'dark'
                        ? 'border-white bg-white text-black'
                        : 'border-zinc-900 bg-zinc-900 text-white'
                      : theme === 'dark'
                      ? 'border-zinc-700 bg-zinc-900/60 text-zinc-200'
                      : 'border-zinc-200 bg-white text-zinc-800'
                  }`}
                >
                  {formatCurrency(preset)}
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <input
              type="number"
              min="1000"
              step="1000"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) =>
                setCustomAmount(e.target.value)
              }
              placeholder="Số tiền khác (VND)"
              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-950/60 text-white placeholder:text-zinc-500'
                  : 'border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400'
              }`}
            />

            <input
              type="text"
              maxLength={50}
              value={donorName}
              onChange={(e) =>
                setDonorName(e.target.value)
              }
              placeholder="Tên người donate (tùy chọn)"
              className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-950/60 text-white placeholder:text-zinc-500'
                  : 'border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400'
              }`}
            />

            <textarea
              rows={3}
              maxLength={100}
              value={note}
              onChange={(e) =>
                setNote(
                  e.target.value.replace(/\n/g, '')
                )
              }
              placeholder="Lời nhắn (tùy chọn, tối đa 100 ký tự)"
              className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-950/60 text-white placeholder:text-zinc-500'
                  : 'border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400'
              }`}
            />

            <div
              className={`text-right text-xs ${
                theme === 'dark'
                  ? 'text-zinc-500'
                  : 'text-zinc-400'
              }`}
            >
              {note.length}/100
            </div>
          </div>

          {error && (
            <div
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                theme === 'dark'
                  ? 'border-red-900 bg-red-950/40 text-red-200'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleDonate}
            disabled={isLoading}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
              theme === 'dark'
                ? 'bg-white text-black disabled:bg-zinc-700 disabled:text-zinc-300'
                : 'bg-zinc-900 text-white disabled:bg-zinc-300'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tạo link thanh toán...
              </>
            ) : (
              'Thanh toán'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
