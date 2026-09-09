'use client'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import type { TranslationGlossary } from '@/components/TranslationGlossary'

type TextTranslatePanelProps = {
  inputText: string
  outputText: string
  isTranslating: boolean
  translationProgress: { completed: number; total: number }
  targetLanguage: string
  theme: 'dark' | 'light'
  textUrl: string
  chapterTitle: string
  isFetchingUrl: boolean
  onTextUrlChange: (value: string) => void
  onOutputChange: (value: string) => void
  onFetchUrl: () => void
  onTargetLanguageChange: (value: string) => void
  onTranslate: () => void
  glossary: TranslationGlossary
  onGlossarySave: (entries: TranslationGlossary) => void
  onGlossaryClear: () => void
  onGlossaryAdd: (source: string, replacement: string) => void
}

const targetLanguageOptions = [
  { value: 'en', label: 'Tiếng Anh' },
  { value: 'ja', label: 'Tiếng Nhật' },
  { value: 'ko', label: 'Tiếng Hàn' },
  { value: 'zh-CN', label: 'Tiếng Trung' },
  { value: 'es', label: 'Tiếng Tây Ban Nha' },
  { value: 'fr', label: 'Tiếng Pháp' },
  { value: 'de', label: 'Tiếng Đức' },
  { value: 'it', label: 'Tiếng Ý' },
  { value: 'pt', label: 'Tiếng Bồ Đào Nha' },
  { value: 'ru', label: 'Tiếng Nga' },
  { value: 'vi', label: 'Tiếng Việt' },
]

export default function TextTranslatePanel({
  inputText = '', outputText = '', isTranslating = false, targetLanguage = 'vi',
  theme = 'dark', textUrl, chapterTitle, isFetchingUrl, onTextUrlChange,
  onOutputChange, onFetchUrl, onTargetLanguageChange, onTranslate, translationProgress,
  glossary, onGlossarySave, onGlossaryClear, onGlossaryAdd,
}: TextTranslatePanelProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorShellRef = useRef<HTMLDivElement>(null)
  const lastTextRef = useRef(outputText)
  const [selectedPhrase, setSelectedPhrase] = useState('')
  const [replacementDraft, setReplacementDraft] = useState('')
  const [selectionPosition, setSelectionPosition] = useState({ top: 0, left: 0 })
  const [showOriginal, setShowOriginal] = useState(false)
  const displayText = showOriginal ? inputText : outputText

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    const pageScrollY = window.scrollY
    const editorScrollTop = editor.scrollTop
    if (editor.innerText !== displayText) editor.innerText = displayText
    editor.scrollTop = editorScrollTop
    // Thay chunk có thể làm chiều cao nội dung thay đổi; giữ nguyên vị trí
    // người dùng đang đọc để phần gốc chưa dịch không bị nhìn như biến mất.
    window.scrollTo({ top: pageScrollY, left: window.scrollX, behavior: 'auto' })
    lastTextRef.current = displayText
  }, [displayText])

  const handleEditorInput = () => {
    const editor = editorRef.current
    if (!editor) return

    const previousText = lastTextRef.current
    const nextText = editor.innerText
    let prefixLength = 0
    while (
      prefixLength < previousText.length &&
      prefixLength < nextText.length &&
      previousText[prefixLength] === nextText[prefixLength]
    ) prefixLength += 1

    let suffixLength = 0
    while (
      suffixLength < previousText.length - prefixLength &&
      suffixLength < nextText.length - prefixLength &&
      previousText[previousText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
    ) suffixLength += 1

    const oldValue = previousText.slice(prefixLength, previousText.length - suffixLength)
    const newValue = nextText.slice(prefixLength, nextText.length - suffixLength)

    // Đây là editor thay thế, không phải textarea: không cho xóa hoặc chèn
    // tự do. Phần mới phải thay thế một phần đã có trong bản dịch.
    if (!oldValue || !newValue.trim()) {
      editor.innerText = previousText
      return
    }

    const replacedText = previousText.split(oldValue).join(newValue)
    editor.innerText = replacedText
    lastTextRef.current = replacedText
    onOutputChange(replacedText)
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') event.preventDefault()
  }

  const handleEditorSelection = () => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection || !editor || selection.isCollapsed || !selection.toString().trim()) return
    if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return
    setSelectedPhrase(selection.toString())
    setReplacementDraft(selection.toString())
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    const shellRect = editorShellRef.current?.getBoundingClientRect()
    if (!shellRect) return
    const toolbarWidth = Math.min(430, shellRect.width - 24)
    const belowTop = rect.bottom - shellRect.top + 8
    const top = belowTop + 76 <= shellRect.height
      ? belowTop
      : Math.max(8, rect.top - shellRect.top - 84)
    setSelectionPosition({
      top,
      left: Math.max(12, Math.min(shellRect.width - toolbarWidth - 12, rect.left - shellRect.left)),
    })
  }

  const applySelectedPhrase = () => {
    const replacement = replacementDraft.trim()
    if (!selectedPhrase.trim() || !replacement) return
    const nextText = lastTextRef.current.split(selectedPhrase).join(replacement)
    if (editorRef.current) editorRef.current.innerText = nextText
    lastTextRef.current = nextText
    onOutputChange(nextText)
    onGlossaryAdd(selectedPhrase.trim(), replacement)
    setSelectedPhrase('')
    setReplacementDraft('')
    setSelectionPosition({ top: 0, left: 0 })
    window.getSelection()?.removeAllRanges()
  }

  const dark = theme === 'dark'

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
      <aside className={`self-start rounded-3xl border p-4 shadow-2xl backdrop-blur sm:p-6 lg:sticky lg:top-6 lg:h-fit ${dark ? 'border-zinc-800 bg-zinc-900/70 shadow-black/30' : 'border-zinc-200 bg-white/85 shadow-zinc-300/40'}`}>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold">Lấy nội dung chương</div>
            <p className={`mb-3 text-xs leading-relaxed ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Dán URL chương truyện rồi lấy nội dung.
            </p>
            <input type="url" value={textUrl} onChange={(event) => onTextUrlChange(event.target.value)} placeholder="Nhập URL chương truyện" className={`mb-3 w-full rounded-xl border px-4 py-3 text-sm outline-none ${dark ? 'border-zinc-700 bg-black/40 text-zinc-200 placeholder:text-zinc-500' : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'}`} />
            <button type="button" onClick={onFetchUrl} disabled={isFetchingUrl || isTranslating || !textUrl.trim()} className={`w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
              {isFetchingUrl ? 'Đang lấy...' : 'Lấy nội dung'}
            </button>
            {chapterTitle && <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed ${dark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800'}`}>{chapterTitle}</div>}
          </div>

          <div className={`h-px ${dark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
          <LanguageSelector label="Dịch sang" value={targetLanguage} options={targetLanguageOptions} theme={theme} onChange={onTargetLanguageChange} />
          <button type="button" onClick={onTranslate} disabled={isTranslating || !inputText.trim()} className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
            {isTranslating ? 'Đang dịch...' : 'Dịch'}
          </button>
        </div>
      </aside>

      <section className="min-w-0">
        <div className={`rounded-3xl border p-4 backdrop-blur sm:p-6 ${dark ? 'border-zinc-800 bg-zinc-900/70' : 'border-zinc-200 bg-white/85'}`}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{showOriginal ? 'Văn bản gốc' : 'Bản dịch'}</h2>
              <p className="mt-1 text-xs text-zinc-500">{isTranslating ? `Đang dịch từng đoạn${translationProgress.total ? ` (${translationProgress.completed}/${translationProgress.total})` : '...'}` : showOriginal ? 'Nội dung gốc của chương.' : 'Nhấn giữ để bôi đen rồi sửa trực tiếp trên bản dịch.'}</p>
            </div>
            <button type="button" onClick={() => setShowOriginal((value) => !value)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${dark ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'}`} aria-pressed={showOriginal}>
              {showOriginal ? <EyeOff size={15} /> : <Eye size={15} />}
              Văn bản gốc
            </button>
          </div>
          <div ref={editorShellRef} className="relative isolate">
          <div ref={editorRef} contentEditable={!showOriginal} suppressContentEditableWarning role="textbox" aria-label={showOriginal ? 'Văn bản gốc' : 'Nội dung bản dịch có thể chỉnh sửa'} data-placeholder="Bản dịch sẽ xuất hiện ở đây." spellCheck={false} onInput={handleEditorInput} onKeyDown={handleEditorKeyDown} onMouseUp={() => window.setTimeout(handleEditorSelection, 0)} onKeyUp={() => window.setTimeout(handleEditorSelection, 0)} onSelect={() => window.setTimeout(handleEditorSelection, 0)} className={`min-h-[520px] whitespace-pre-wrap rounded-2xl border p-5 text-base leading-8 outline-none empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)] focus:ring-2 ${showOriginal ? 'cursor-default' : ''} ${dark ? 'border-zinc-700 bg-black/40 text-zinc-100 focus:ring-zinc-500' : 'border-zinc-300 bg-white text-zinc-900 focus:ring-zinc-400'}`} />
          {selectedPhrase && (
            <>
              <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-black/20 backdrop-blur-[1px]" />
              <div style={{ top: selectionPosition.top, left: selectionPosition.left, zIndex: 9999 }} className={`absolute flex w-[min(430px,calc(100%-24px))] items-center gap-2 rounded-2xl border p-3 shadow-2xl ${dark ? 'border-zinc-700 bg-zinc-950 text-zinc-100' : 'border-zinc-300 bg-white text-zinc-900'}`}>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-[10px] text-zinc-500">{selectedPhrase.trim()}</div>
                  <input value={replacementDraft} onChange={(event) => setReplacementDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applySelectedPhrase(); if (event.key === 'Escape') setSelectedPhrase('') }} className={`h-10 w-full rounded-lg border px-3 text-sm outline-none ${dark ? 'border-zinc-600 bg-black/30 focus:border-zinc-400' : 'border-zinc-300 bg-white focus:border-zinc-500'}`} aria-label="Cụm thay thế" />
                </div>
                <button type="button" onClick={applySelectedPhrase} disabled={!replacementDraft.trim() || replacementDraft.trim() === selectedPhrase.trim()} className="h-10 self-end rounded-lg border px-3 text-xs font-semibold disabled:opacity-50">Đổi</button>
                <button type="button" onClick={() => setSelectedPhrase('')} className="h-10 self-end rounded-lg border px-3 text-xs">×</button>
              </div>
            </>
          )}
          </div>
        </div>
      </section>
    </div>
  )
}
