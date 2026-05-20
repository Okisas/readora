type ResizeHandle =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

type ImageUtilityCanvasProps = {
  mode: 'crop' | 'remove-bg'
  imagesLength: number
  theme: 'dark' | 'light'
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  selection: {
    x: number
    y: number
    width: number
    height: number
  }
  isSelecting: boolean
  isProcessing: boolean
  statusMessage: string
  removeBackgroundStrength: number
  onMouseDown: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onMouseMove: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onMouseUp: () => void
  onSelectionMoveStart: (
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onSelectionResizeStart: (
    handle: ResizeHandle,
    e: React.MouseEvent<HTMLDivElement>
  ) => void
  onClearSelection: () => void
  onCropImage: () => void
  onRemoveBackground: () => void
  onDownloadImage: () => void
  onRemoveBackgroundStrengthChange: (
    value: number
  ) => void
}

export default function ImageUtilityCanvas({
  mode,
  imagesLength,
  theme,
  canvasRef,
  selection,
  isSelecting,
  isProcessing,
  statusMessage,
  removeBackgroundStrength,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onSelectionMoveStart,
  onSelectionResizeStart,
  onClearSelection,
  onCropImage,
  onRemoveBackground,
  onDownloadImage,
  onRemoveBackgroundStrengthChange,
}: ImageUtilityCanvasProps) {
  const showSelection =
    mode === 'crop' &&
    selection.width > 0 &&
    selection.height > 0

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

  const stopPointerEvent = (
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation()
  }

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
        <div className="space-y-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
              theme === 'dark'
                ? 'border-zinc-800 bg-black/30 text-zinc-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700'
            }`}
          >
            {mode === 'crop'
              ? 'Draw a selection box on the image, adjust it if needed, then create a cropped page.'
              : 'Remove the surrounding background from the current image and save the result as a new transparent page.'}
          </div>

          {statusMessage && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-black/30 text-zinc-300'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700'
              }`}
            >
              {statusMessage}
            </div>
          )}

          {mode === 'remove-bg' && (
            <div
              className={`rounded-2xl border px-4 py-4 ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-black/30 text-zinc-300'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-4 text-sm font-semibold">
                <span>Do manh xoa nen</span>
                <span>{removeBackgroundStrength}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={removeBackgroundStrength}
                onChange={(e) =>
                  onRemoveBackgroundStrengthChange(
                    Number(e.target.value)
                  )
                }
                className="w-full"
              />
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Giam muc nay neu bi an vao chu the. Tang len
                neu nen van con qua nhieu.
              </p>
            </div>
          )}

          <div
            className="relative inline-block max-w-full"
            onMouseDown={
              mode === 'crop' ? onMouseDown : undefined
            }
            onMouseMove={
              mode === 'crop' ? onMouseMove : undefined
            }
            onMouseUp={
              mode === 'crop' ? onMouseUp : undefined
            }
            onMouseLeave={() => {
              if (mode === 'crop' && isSelecting) {
                onMouseUp()
              }
            }}
          >
            <canvas
              ref={canvasRef}
              className={`mx-auto h-auto max-w-full rounded-2xl ${
                mode === 'crop'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
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
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {mode === 'crop' && (
              <>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    theme === 'dark'
                      ? 'border-zinc-700 bg-zinc-800 text-white'
                      : 'border-zinc-300 bg-zinc-100 text-zinc-900'
                  }`}
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={onCropImage}
                  disabled={isProcessing}
                  className={`rounded-full px-5 py-2 text-sm font-semibold ${
                    theme === 'dark'
                      ? 'bg-white text-black disabled:bg-zinc-700 disabled:text-zinc-300'
                      : 'bg-zinc-900 text-white disabled:bg-zinc-300'
                  }`}
                >
                  Create Cropped Image
                </button>
              </>
            )}

            {mode === 'remove-bg' && (
              <button
                type="button"
                onClick={onRemoveBackground}
                disabled={isProcessing}
                className={`rounded-full px-5 py-2 text-sm font-semibold ${
                  theme === 'dark'
                    ? 'bg-white text-black disabled:bg-zinc-700 disabled:text-zinc-300'
                    : 'bg-zinc-900 text-white disabled:bg-zinc-300'
                }`}
              >
                {isProcessing
                  ? 'Processing...'
                  : 'Remove Background'}
              </button>
            )}

            <button
              type="button"
              onClick={onDownloadImage}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-800 text-white'
                  : 'border-zinc-300 bg-zinc-100 text-zinc-900'
              }`}
            >
              Download Current Image
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
