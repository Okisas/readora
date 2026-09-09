'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings, X } from 'lucide-react'

export type TranslationGlossary = Record<string, string>

type Props = {
  entries: TranslationGlossary
  theme: 'dark' | 'light'
  onSave: (entries: TranslationGlossary) => void
  onClear: () => void
}

export default function TranslationGlossaryManager({ entries, theme, onSave, onClear }: Props) {
  const dark = theme === 'dark'
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TranslationGlossary>(entries)

  const openManager = () => {
    setDraft(entries)
    setOpen(true)
  }

  const updateEntry = (oldKey: string, key: string, value: string) => {
    setDraft((current) => {
      const next = { ...current }
      if (oldKey !== key) delete next[oldKey]
      if (key.trim()) next[key] = value
      return next
    })
  }

  return (
    <>
      <button type="button" onClick={openManager} aria-label="Quản lý từ dịch" title="Quản lý từ dịch" className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-xl transition hover:scale-105 ${dark ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'}`}>
        <Settings size={17} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className={`max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl ${dark ? 'border-zinc-700 bg-zinc-950 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900'}`}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="font-bold">Quản lý từ dịch</h2>
                <p className="mt-1 text-xs text-zinc-500">Các mục sẽ được thay trên toàn bản dịch.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng"><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
              {Object.entries(draft).length === 0 && <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Chưa có từ nào được lưu.</div>}
              {Object.entries(draft).map(([key, value]) => (
                <div key={key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input defaultValue={key} onBlur={(event) => updateEntry(key, event.target.value, value)} className={`rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-zinc-700 bg-black/30' : 'border-zinc-300 bg-white'}`} placeholder="Cụm cần thay" />
                  <input value={value} onChange={(event) => updateEntry(key, key, event.target.value)} className={`rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-zinc-700 bg-black/30' : 'border-zinc-300 bg-white'}`} placeholder="Bản sửa" />
                  <button type="button" onClick={() => setDraft((current) => { const next = { ...current }; delete next[key]; return next })} className="rounded-xl border border-red-400/40 px-3 py-2 text-xs text-red-400">Xóa</button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-zinc-800 px-5 py-4">
              <button type="button" onClick={() => { onClear(); setDraft({}) }} className="rounded-xl border border-red-400/40 px-4 py-2 text-sm text-red-400">Xóa hết</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm">Hủy</button>
                <button type="button" onClick={() => { onSave(draft); setOpen(false) }} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Lưu lại</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
