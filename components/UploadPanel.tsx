import { Upload } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import PageThumbnails from '@/components/PageThumbnails'
import type { UploadedImage } from '@/components/types'

type UploadPanelProps = {
  isDragging: boolean
  images: UploadedImage[]
  statusMessage: string
  currentIndex: number
  sourceLanguage: string
  targetLanguage: string
  theme: 'dark' | 'light'
  onDeletePage: (index: number) => void
  onDragStateChange: (value: boolean) => void
  onMergeImages: () => void
  onMovePage: (
    fromIndex: number,
    direction: 'left' | 'right'
  ) => void
  onDrop: (
    e: React.DragEvent<HTMLLabelElement>
  ) => void
  onUpload: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void
  onSourceLanguageChange: (value: string) => void
  onTargetLanguageChange: (value: string) => void
  onSelectPage: (index: number) => void
}

const sourceLanguageOptions = [
  { value: 'eng', label: 'English' },
  {
    value: 'manga_vert',
    label: 'Manga Vertical',
    disabled: true,
  },
  {
    value: 'jpn',
    label: 'Japanese',
    disabled: true,
  },
  {
    value: 'kor',
    label: 'Korean',
    disabled: true,
  },
  {
    value: 'chi_sim',
    label: 'Chinese',
    disabled: true,
  },
]

const targetLanguageOptions = [
  { value: 'vi', label: 'Vietnamese' },
  {
    value: 'en',
    label: 'English',
    disabled: true,
  },
]

export default function UploadPanel({
  isDragging,
  images,
  statusMessage,
  currentIndex,
  sourceLanguage,
  targetLanguage,
  theme,
  onDeletePage,
  onDragStateChange,
  onMergeImages,
  onMovePage,
  onDrop,
  onUpload,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onSelectPage,
}: UploadPanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border p-4 shadow-2xl backdrop-blur sm:p-6 xl:sticky xl:top-6 ${
        theme === 'dark'
          ? 'border-zinc-800 bg-zinc-900/70 shadow-black/30'
          : 'border-zinc-200 bg-white/85 shadow-zinc-300/40'
      }`}
    >
      <label
        onDragOver={(e) => {
          e.preventDefault()
          onDragStateChange(true)
        }}
        onDragLeave={() =>
          onDragStateChange(false)
        }
        onDrop={onDrop}
        className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-5 py-8 text-center transition sm:px-8 ${
          isDragging
            ? theme === 'dark'
              ? 'border-white bg-zinc-800'
              : 'border-zinc-900 bg-zinc-100'
            : theme === 'dark'
            ? 'border-zinc-700 hover:border-zinc-500'
            : 'border-zinc-300 hover:border-zinc-500'
        }`}
      >
        <Upload className="mb-4 h-10 w-10 sm:h-12 sm:w-12" />

        <div className="mb-2 text-base font-semibold sm:text-lg">
          Upload Images
        </div>

        <div
          className={`max-w-[18rem] text-sm leading-relaxed ${
            theme === 'dark'
              ? 'text-zinc-400'
              : 'text-zinc-500'
          }`}
        >
          Tap to choose images or drag multiple manga pages
          here. Supports PNG, JPG, and WEBP.
        </div>

        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
      </label>

      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <LanguageSelector
            label="Source Language"
            value={sourceLanguage}
            options={sourceLanguageOptions}
            theme={theme}
            onChange={onSourceLanguageChange}
          />

          <LanguageSelector
            label="Translate To"
            value={targetLanguage}
            options={targetLanguageOptions}
            theme={theme}
            onChange={onTargetLanguageChange}
          />
        </div>

        <div
          className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
            theme === 'dark'
              ? 'border-zinc-800 bg-black/30 text-zinc-300'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700'
          }`}
        >
          Click the image to open a scan box. Drag the frame to
          move it, drag the corners or edges to resize it, then
          press Scan to run OCR and translate the selected area.
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

        {images.length > 1 && (
          <button
            type="button"
            onClick={onMergeImages}
            className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              theme === 'dark'
                ? 'border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700'
                : 'border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
            }`}
          >
            Merge images in current order
          </button>
        )}
      </div>

      <PageThumbnails
        images={images}
        currentIndex={currentIndex}
        theme={theme}
        onDeletePage={onDeletePage}
        onMovePage={onMovePage}
        onSelectPage={onSelectPage}
      />
    </div>
  )
}
