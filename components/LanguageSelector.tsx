type Option = {
  disabled?: boolean
  label: string
  value: string
}

type LanguageSelectorProps = {
  label: string
  options: Option[]
  theme?: 'dark' | 'light'
  value: string
  onChange: (value: string) => void
}

export default function LanguageSelector({
  label,
  options,
  theme = 'dark',
  value,
  onChange,
}: LanguageSelectorProps) {
  return (
    <div>
      <label
        className={`block mb-2 text-sm ${
          theme === 'dark'
            ? 'text-zinc-400'
            : 'text-zinc-600'
        }`}
      >
        {label}
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className={`w-full rounded-2xl px-4 py-3 outline-none ${
          theme === 'dark'
            ? 'bg-zinc-800 border border-zinc-700 text-white'
            : 'bg-white border border-zinc-300 text-zinc-900'
        }`}
      >
        {options.map((option) => (
          <option
            key={option.value}
            disabled={option.disabled}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
