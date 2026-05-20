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
    <div className="mt-6">
      <div
        className={`mb-3 flex items-center justify-between gap-3 text-sm ${
          theme === 'dark'
            ? 'text-zinc-400'
            : 'text-zinc-500'
        }`}
      >
        <span>Uploaded Pages</span>
        <span className="text-xs">{images.length} trang</span>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-2 md:overflow-visible md:px-0 md:pb-0">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`relative aspect-[3/4] min-w-[116px] shrink-0 overflow-hidden rounded-xl border transition md:min-w-0 ${
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
                className="h-full w-full object-cover"
              />
            </button>

            <div className="absolute inset-x-1 top-1 flex items-center justify-between gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() =>
                  onMovePage(index, 'left')
                }
                className={`h-7 w-7 rounded-full text-xs disabled:opacity-30 ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                {'<'}
              </button>

              <button
                type="button"
                onClick={() => onDeletePage(index)}
                className={`h-7 w-7 rounded-full text-xs ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                x
              </button>

              <button
                type="button"
                disabled={
                  index === images.length - 1
                }
                onClick={() =>
                  onMovePage(index, 'right')
                }
                className={`h-7 w-7 rounded-full text-xs disabled:opacity-30 ${
                  theme === 'dark'
                    ? 'bg-black/55 text-white'
                    : 'border border-zinc-300 bg-white/90 text-zinc-900'
                }`}
              >
                {'>'}
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
