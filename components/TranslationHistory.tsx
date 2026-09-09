'use client'

import { Trash2 } from 'lucide-react'

export type TranslationHistoryItem = {
  id: number
  url: string
  title: string
  originalText: string
  translatedText: string
  createdAt: string
  edits: Array<{ source: string; replacement: string }>
}

type Props = {
  items: TranslationHistoryItem[]
  theme: 'dark' | 'light'
  onSelect: (item: TranslationHistoryItem) => void
  onDelete: (id: number) => void
  onClearAll: () => void
}

export default function TranslationHistory({ items, theme, onSelect, onDelete, onClearAll }: Props) {
  const dark = theme === 'dark'

  return (
    <section className={`mx-auto max-w-5xl rounded-3xl border p-4 shadow-2xl sm:p-6 ${dark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-white/85'}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Lịch sử dịch</h2>
          <p className="mt-1 text-sm text-zinc-500">Mỗi lần lấy URL được lưu thành một phiên làm việc.</p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={onClearAll} className="shrink-0 rounded-xl border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10">
            Xóa hết
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center text-sm ${dark ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'}`}>
          Chưa có phiên dịch nào.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className={`rounded-2xl border p-4 transition ${dark ? 'border-zinc-800 bg-black/20 hover:border-zinc-600' : 'border-zinc-200 bg-white hover:border-zinc-400'}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{item.title || 'Phiên dịch không có tiêu đề'}</span>
                    <span className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="mt-2 truncate text-xs text-zinc-500">{item.url}</div>
                  <div className="mt-1 font-semibold">#{item.id}</div>
                  {item.edits?.length > 0 && <div className="mt-3 border-t border-zinc-800 pt-3 text-xs"><div className="mb-1 font-semibold text-zinc-400">Từ đã sửa ({item.edits.length})</div>{item.edits.map((edit) => <div key={`${edit.source}-${edit.replacement}`} className="truncate text-zinc-500">{edit.source} → {edit.replacement}</div>)}</div>}
                  <div className="mt-2 text-xs text-zinc-500">{item.translatedText ? 'Đã dịch xong' : 'Đang chờ bản dịch'}</div>
                </button>
                <button type="button" onClick={() => onDelete(item.id)} aria-label={`Xóa phiên ${item.id}`} title="Xóa phiên này" className="shrink-0 rounded-xl border border-red-400/40 p-2 text-red-400 transition hover:bg-red-500/10">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
