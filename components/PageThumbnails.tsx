import type { UploadedImage } from '@/components/types'

type PageThumbnailsProps = {
  images: UploadedImage[]
  currentIndex: number
  theme: 'dark' | 'light'
  onSelectPage: (index: number) => void
  onDeletePage: (index: number) => void
  onMovePage: (
    fromIndex: number,
    direction: 'left' | 'right'
  ) => void
}

export default function PageThumbnails({
  images,
  currentIndex,
  theme,
  onSelectPage,
  onDeletePage,
  onMovePage,
}: PageThumbnailsProps) {
  if (images.length === 0) return null

  return (
    <div className="mt-6 min-w-0 max-w-full">
      <div
        className={`mb-3 flex items-center justify-between gap-3 text-sm ${
          theme === 'dark'
            ? 'text-zinc-400'
            : 'text-zinc-500'
        }`}
      >
        <span>Các trang đã tải</span>
        <span className="text-xs">{images.length} trang</span>
      </div>

      <div className="grid min-w-0 max-w-full grid-cols-2 gap-3 px-1 pb-2 md:px-0 md:pb-0">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`relative aspect-[3/4] min-w-0 w-full overflow-hidden rounded-xl border transition ${
              currentIndex === index
                ? theme === 'dark'
                  ? 'border-white ring-2 ring-white/20'
                  : 'border-zinc-900 ring-2 ring-zinc-900/10'
                : theme === 'dark'
                ? 'border-zinc-800'
                : 'border-zinc-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectPage(index)}
              className="h-full w-full"
            >
              <img
                src={image.url}
                alt=""
                className="h-full w-full bg-black object-contain"
              />
            </button>

            <div className="absolute inset-x-1 top-1 flex min-w-0 items-center justify-between gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() =>
                  onMovePage(index, 'left')
                }
                aria-label="Đưa trang sang trái"
                className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-1 py-1 text-[10px] disabled:opacity-30 sm:px-2 sm:text-[11px] ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                Trước
              </button>

              <button
                type="button"
                onClick={() => onDeletePage(index)}
                aria-label="Xóa trang"
                className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-1 py-1 text-[10px] sm:px-2 sm:text-[11px] ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                Xóa
              </button>

              <button
                type="button"
                disabled={
                  index === images.length - 1
                }
                onClick={() =>
                  onMovePage(index, 'right')
                }
                aria-label="Đưa trang sang phải"
                className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-1 py-1 text-[10px] disabled:opacity-30 sm:px-2 sm:text-[11px] ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                Sau
              </button>
            </div>

            <div
              className={`absolute inset-x-0 bottom-0 px-2 py-1 text-center text-[11px] font-medium backdrop-blur-sm ${
                theme === 'dark'
                  ? 'bg-black/45 text-zinc-200'
                  : 'bg-white/80 text-zinc-700'
              }`}
            >
              Trang {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
