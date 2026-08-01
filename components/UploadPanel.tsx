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
  { value: 'eng', label: 'Tiếng Anh' },
  {
    value: 'jpn',
    label: 'Tiếng Nhật',
  },
  {
    value: 'kor',
    label: 'Tiếng Hàn',
  },
  {
    value: 'chi_sim',
    label: 'Tiếng Trung',
  },
  { value: 'spa', label: 'Tiếng Tây Ban Nha' },
  { value: 'fra', label: 'Tiếng Pháp' },
  { value: 'deu', label: 'Tiếng Đức' },
  { value: 'ita', label: 'Tiếng Ý' },
  { value: 'por', label: 'Tiếng Bồ Đào Nha' },
  { value: 'rus', label: 'Tiếng Nga' },
]

const targetLanguageOptions = [
  { value: 'vi', label: 'Tiếng Việt' },
  {
    value: 'en',
    label: 'Tiếng Anh',
  },
  { value: 'es', label: 'Tiếng Tây Ban Nha' },
  { value: 'fr', label: 'Tiếng Pháp' },
  { value: 'de', label: 'Tiếng Đức' },
  { value: 'it', label: 'Tiếng Ý' },
  { value: 'pt', label: 'Tiếng Bồ Đào Nha' },
  { value: 'ru', label: 'Tiếng Nga' },
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
      className={`relative min-w-0 w-full max-w-full overflow-x-hidden rounded-3xl border p-3 shadow-2xl backdrop-blur sm:p-4 xl:sticky xl:top-6 ${
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
        className={`flex min-h-[165px] w-full min-w-0 max-w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-5 text-center transition sm:px-6 ${
          isDragging
            ? theme === 'dark'
              ? 'border-white bg-zinc-800'
              : 'border-zinc-900 bg-zinc-100'
            : theme === 'dark'
            ? 'border-zinc-700 hover:border-zinc-500'
            : 'border-zinc-300 hover:border-zinc-500'
        }`}
      >
        <Upload className="mb-3 h-8 w-8 sm:h-10 sm:w-10" />

        <div className="mb-1 text-sm font-semibold sm:text-base">
          Tải ảnh lên
        </div>

        <div
          className={`max-w-[18rem] text-xs leading-relaxed ${
            theme === 'dark'
              ? 'text-zinc-400'
              : 'text-zinc-500'
          }`}
        >
          Nhấn để chọn ảnh hoặc kéo thả nhiều trang truyện vào đây.
          Hỗ trợ PNG, JPG và WEBP.
        </div>

        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
      </label>

      <div className="mt-4 space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <LanguageSelector
            label="Ngôn ngữ gốc"
            value={sourceLanguage}
            options={sourceLanguageOptions}
            theme={theme}
            onChange={onSourceLanguageChange}
          />

          <LanguageSelector
            label="Dịch sang"
            value={targetLanguage}
            options={targetLanguageOptions}
            theme={theme}
            onChange={onTargetLanguageChange}
          />
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
            Ghép ảnh theo thứ tự hiện tại
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
