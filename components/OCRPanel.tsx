type OCRPanelProps = {
  isProcessing: boolean
  ocrText: string
  theme: 'dark' | 'light'
}

export default function OCRPanel({
  isProcessing,
  ocrText,
  theme,
}: OCRPanelProps) {
  return (
    <div
      className={`relative rounded-3xl border p-4 backdrop-blur sm:p-6 ${
        theme === 'dark'
          ? 'border-zinc-800 bg-zinc-900/70'
          : 'border-zinc-200 bg-white/85'
      }`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">
          Result
        </h2>

        {isProcessing && (
          <div
            className={`text-sm ${
              theme === 'dark'
                ? 'text-zinc-400'
                : 'text-zinc-500'
            }`}
          >
            Processing...
          </div>
        )}
      </div>

      <div
        className={`min-h-[180px] whitespace-pre-wrap rounded-2xl border p-4 font-mono text-sm sm:min-h-[200px] sm:text-base ${
          theme === 'dark'
            ? 'border-zinc-800 bg-black/40 text-zinc-300'
            : 'border-zinc-200 bg-zinc-50 text-zinc-800'
        }`}
      >
        {ocrText || 'Select text area and scan.'}
      </div>
    </div>
  )
}
