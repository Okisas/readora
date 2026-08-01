import LanguageSelector from '@/components/LanguageSelector'

type TextTranslatePanelProps = {
  inputText: string
  outputText: string
  isTranslating: boolean
  sourceLanguage: string
  targetLanguage: string
  theme: 'dark' | 'light'
  textUrl: string
  chapterTitle: string
  isFetchingUrl: boolean
  onTextUrlChange: (value: string) => void
  onFetchUrl: () => void
  onSourceLanguageChange: (value: string) => void
  onTargetLanguageChange: (value: string) => void
  onTranslate: () => void
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
  { value: 'vi', label: 'Tiếng Việt' },
]

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
  inputText = '',
  outputText = '',
  isTranslating = false,
  sourceLanguage = 'eng',
  targetLanguage = 'vi',
  theme = 'dark',
  textUrl,
  chapterTitle,
  isFetchingUrl,
  onTextUrlChange,
  onFetchUrl,
  onSourceLanguageChange,
  onTargetLanguageChange,
  onTranslate,
}: TextTranslatePanelProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
      <div
        className={`self-start rounded-3xl border p-4 shadow-2xl backdrop-blur sm:p-6 lg:sticky lg:top-6 lg:h-fit ${
          theme === 'dark'
            ? 'border-zinc-800 bg-zinc-900/70 shadow-black/30'
            : 'border-zinc-200 bg-white/85 shadow-zinc-300/40'
        }`}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold">Lấy nội dung chương</div>
            <p className={`mb-3 text-xs leading-relaxed ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Dán URL chương từ Faloo, Qidian hoặc AliceSW.
            </p>
            <input
              type="url"
              value={textUrl}
              onChange={(event) => onTextUrlChange(event.target.value)}
              placeholder="Nhập URL chương truyện"
              className={`mb-3 w-full rounded-xl border px-4 py-3 text-sm outline-none ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-black/40 text-zinc-200 placeholder:text-zinc-500'
                  : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
              }`}
            />
            <button
              type="button"
              onClick={onFetchUrl}
              disabled={isFetchingUrl || !textUrl.trim()}
              className={`w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
                theme === 'dark' ? 'bg-white text-black' : 'bg-zinc-900 text-white'
              }`}
            >
              {isFetchingUrl ? 'Đang lấy...' : 'Lấy nội dung'}
            </button>
            {chapterTitle && (
              <div>
                <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed ${
                  theme === 'dark' ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800'
                }`}>
                  {chapterTitle}
                </div>
                <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed ${
                  theme === 'dark'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'bg-zinc-100 text-zinc-800'
                }`}>
                  Hãy chọn ngôn ngữ phù hợp và ấn “Dịch” để lấy bản dịch.
                </p>
              </div>
            )}
          </div>

          <div className={`h-px ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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

          <button
            type="button"
            onClick={onTranslate}
            disabled={
              isTranslating || !inputText || !inputText.trim()
            }
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-white text-black'
                : 'bg-zinc-900 text-white'
            }`}
          >
            {isTranslating
              ? 'Đang dịch...'
              : 'Dịch'}
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div
          className={`rounded-3xl border p-4 backdrop-blur sm:p-6 ${
            theme === 'dark'
              ? 'border-zinc-800 bg-zinc-900/70'
              : 'border-zinc-200 bg-white/85'
          }`}
        >
          <h2 className="mb-4 text-xl font-bold">
            Bản dịch
          </h2>

          <div
            className={`min-h-[220px] whitespace-pre-wrap rounded-2xl border p-4 sm:min-h-[260px] ${
              theme === 'dark'
                ? 'border-zinc-800 bg-black/40 text-zinc-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-800'
            }`}
          >
            {outputText ||
              'Bản dịch sẽ xuất hiện ở đây.'}
          </div>
        </div>
      </div>
    </div>
  )
}
