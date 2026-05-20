import type {
  SelectionRect,
  TranslationOverlay,
} from '@/components/types'

type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

type PreviewCanvasProps = {
  imagesLength: number
  theme: 'dark' | 'light'
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  currentOverlays: TranslationOverlay[]
  activeEditorRegion: SelectionRect | null
  activeOverlayId: string | null
  editorSentence: string
  editorTranslation: string
  selection: SelectionRect
  hoveredOverlayId: string | null
  isSelecting: boolean
  isUpdatingOverlay: boolean
  onMouseDown: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onMouseMove: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onMouseUp: () => void
  onScanSelection: () => void
  onClearSelection: () => void
  onCloseOverlayEditor: () => void
  onApplyOverlaySentence: () => void
  onSaveEditedTranslation: () => void
  onEditorSentenceChange: (value: string) => void
  onEditorTranslationChange: (value: string) => void
  onSelectionMoveStart: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onSelectionResizeStart: (
    handle: ResizeHandle,
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onOverlayHover: (id: string | null) => void
  onOverlaySelect: (overlayId: string) => void
  onDeleteOverlay: (overlayId: string) => void
  getOverlayStyle: (
    overlay: TranslationOverlay
  ) =>
    | {
        left: number
        top: number
        width: number
        height: number
        fontSize: string
      }
    | null
  getOverlayEditorStyle: (
    region: SelectionRect
  ) =>
    | {
        left: number
        top: number
        width: number
      }
    | null
}

export default function PreviewCanvas({
  imagesLength,
  theme,
  canvasRef,
  currentOverlays,
  activeEditorRegion,
  activeOverlayId,
  editorSentence,
  editorTranslation,
  selection,
  hoveredOverlayId,
  isSelecting,
  isUpdatingOverlay,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onScanSelection,
  onClearSelection,
  onCloseOverlayEditor,
  onApplyOverlaySentence,
  onSaveEditedTranslation,
  onEditorSentenceChange,
  onEditorTranslationChange,
  onSelectionMoveStart,
  onSelectionResizeStart,
  onOverlayHover,
  onOverlaySelect,
  onDeleteOverlay,
  getOverlayStyle,
  getOverlayEditorStyle,
}: PreviewCanvasProps) {
  const showSelection =
    selection.width > 0 && selection.height > 0
  const stopPointerEvent = (
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation()
  }
  const handles: Array<{
    key: ResizeHandle
    className: string
    cursor: string
  }> = [
    {
      key: 'nw',
      className: '-left-3 -top-3 h-8 w-8',
      cursor: 'cursor-nwse-resize',
    },
    {
      key: 'ne',
      className: '-right-3 -top-3 h-8 w-8',
      cursor: 'cursor-nesw-resize',
    },
    {
      key: 'se',
      className: '-bottom-3 -right-3 h-8 w-8',
      cursor: 'cursor-nwse-resize',
    },
    {
      key: 'sw',
      className: '-bottom-3 -left-3 h-8 w-8',
      cursor: 'cursor-nesw-resize',
    },
  ]
  const editorStyle = activeEditorRegion
    ? getOverlayEditorStyle(activeEditorRegion)
    : null

  return (
    <div
      className={`relative min-h-[360px] overflow-auto rounded-3xl border p-3 backdrop-blur sm:min-h-[520px] sm:p-4 lg:min-h-[800px] ${
        theme === 'dark'
          ? 'border-zinc-800 bg-zinc-900/70'
          : 'border-zinc-200 bg-white/85'
      }`}
    >
      {imagesLength === 0 ? (
        <div className="flex h-[280px] flex-col items-center justify-center text-center text-zinc-500 sm:h-[420px] lg:h-[700px]">
          <div className="mb-2 text-lg font-semibold">
            Upload images to begin
          </div>
        </div>
      ) : (
        <div
          className="relative inline-block max-w-full"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            if (isSelecting) {
              onMouseUp()
            }
          }}
        >
          <canvas
            ref={canvasRef}
            className="mx-auto h-auto max-w-full rounded-2xl cursor-crosshair"
          />

          {showSelection && (
            <>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-black/55" />

              <div
                className="pointer-events-none absolute border border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                }}
              />

              <div
                className="absolute z-20"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                }}
                onMouseDown={stopPointerEvent}
              >
                <div
                  className="absolute inset-0 cursor-move"
                  onMouseDown={onSelectionMoveStart}
                />

                {[ 
                  'left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl',
                  'right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl',
                  'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl',
                  'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl',
                ].map((corner) => (
                  <div
                    key={corner}
                    className={`pointer-events-none absolute h-10 w-10 border-white ${corner}`}
                  />
                ))}

                {handles.map((handle) => (
                  <div
                    key={handle.key}
                    className={`absolute ${handle.className} ${handle.cursor} bg-transparent`}
                    onMouseDown={(e) =>
                      onSelectionResizeStart(
                        handle.key,
                        e
                      )
                    }
                  />
                ))}

                <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                  <div className="rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/90">
                    Lens Scan
                  </div>
                </div>

                <div className="absolute -bottom-14 left-1/2 flex -translate-x-1/2 gap-3">
                  <button
                    type="button"
                    onMouseDown={stopPointerEvent}
                    onClick={onClearSelection}
                    className="rounded-full border border-white/20 bg-black/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onMouseDown={stopPointerEvent}
                    onClick={onScanSelection}
                    className="rounded-full border border-white/10 bg-white px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-black shadow-[0_8px_24px_rgba(255,255,255,0.28)]"
                  >
                    Scan
                  </button>
                </div>
              </div>
            </>
          )}

          {currentOverlays.map((overlay) => {
            const style = getOverlayStyle(overlay)

            if (!style) return null

            return (
              <div
                key={overlay.id}
                className={`absolute overflow-hidden rounded-lg shadow-lg backdrop-blur-sm ${
                  theme === 'dark'
                    ? 'border border-white/10 bg-black/65 text-white'
                    : 'border border-zinc-200 bg-white/92 text-zinc-900'
                }`}
                style={style}
                onClick={() =>
                  onOverlaySelect(overlay.id)
                }
                onMouseEnter={() =>
                  onOverlayHover(overlay.id)
                }
                onMouseLeave={() =>
                  onOverlayHover(null)
                }
                onMouseDown={stopPointerEvent}
                title={overlay.sentenceText}
              >
                <button
                  type="button"
                  onMouseDown={stopPointerEvent}
                  onClick={() =>
                    onDeleteOverlay(overlay.id)
                  }
                  className={`absolute right-1 top-1 z-10 h-6 w-6 rounded-full text-sm transition ${
                    theme === 'dark'
                      ? 'bg-black/45 text-white'
                      : 'border border-zinc-300 bg-white/90 text-zinc-900'
                  } ${
                    hoveredOverlayId === overlay.id
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                >
                  x
                </button>

                <div className="flex h-full w-full items-center justify-center px-3 py-2 text-center font-semibold leading-tight">
                  {overlay.translatedText}
                </div>
              </div>
            )
          })}

          {activeEditorRegion && editorStyle && (
            <div
              className={`absolute z-30 rounded-2xl border p-3 shadow-2xl ${
                theme === 'dark'
                  ? 'border-white/10 bg-zinc-950/92 text-white'
                  : 'border-zinc-200 bg-white/95 text-zinc-900'
              }`}
              style={editorStyle}
              onMouseDown={stopPointerEvent}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Sentence
                </div>
                <button
                  type="button"
                  onMouseDown={stopPointerEvent}
                  onClick={onCloseOverlayEditor}
                  className={`h-7 w-7 rounded-full text-sm ${
                    theme === 'dark'
                      ? 'bg-white/5 text-white'
                      : 'bg-zinc-100 text-zinc-800'
                  }`}
                >
                  x
                </button>
              </div>

              <textarea
                value={editorSentence}
                onChange={(e) =>
                  onEditorSentenceChange(
                    e.target.value
                  )
                }
                rows={4}
                className={`mb-3 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${
                  theme === 'dark'
                    ? 'border-white/10 bg-black/30 text-white placeholder:text-zinc-500'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400'
                }`}
                placeholder="Edit the detected sentence before translating"
              />

              {activeOverlayId && (
                <div className="mb-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Translation
                  </div>
                  <textarea
                    value={editorTranslation}
                    onChange={(e) =>
                      onEditorTranslationChange(
                        e.target.value
                      )
                    }
                    rows={4}
                    className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${
                      theme === 'dark'
                        ? 'border-white/10 bg-black/30 text-white placeholder:text-zinc-500'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                    placeholder="Edit the translated text"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onMouseDown={stopPointerEvent}
                  onClick={onApplyOverlaySentence}
                  disabled={isUpdatingOverlay}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                    theme === 'dark'
                      ? 'bg-white text-black disabled:bg-zinc-700 disabled:text-zinc-300'
                      : 'bg-zinc-900 text-white disabled:bg-zinc-300'
                  }`}
                >
                  {isUpdatingOverlay
                    ? 'Translating...'
                    : activeOverlayId
                    ? 'Retranslate'
                    : 'Translate'}
                </button>

                {activeOverlayId && (
                  <button
                    type="button"
                    onMouseDown={stopPointerEvent}
                    onClick={onSaveEditedTranslation}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                      theme === 'dark'
                        ? 'border-white/15 bg-white/5 text-white'
                        : 'border-zinc-300 bg-white text-zinc-900'
                    }`}
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
