'use client'

import { useState } from 'react'

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

const countryCodes: Record<string, string> = {
  eng: 'us',
  en: 'us',
  jpn: 'jp',
  ja: 'jp',
  kor: 'kr',
  ko: 'kr',
  chi_sim: 'cn',
  'zh-CN': 'cn',
  spa: 'es',
  es: 'es',
  fra: 'fr',
  fr: 'fr',
  deu: 'de',
  de: 'de',
  ita: 'it',
  it: 'it',
  por: 'br',
  pt: 'br',
  rus: 'ru',
  ru: 'ru',
  vi: 'vn',
}

export default function LanguageSelector({
  label,
  options,
  theme = 'dark',
  value,
  onChange,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  const code = (option?: Option) =>
    option ? countryCodes[option.value] : undefined

  return (
    <div className="relative">
      <label
        className={`mb-2 block text-sm ${
          theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
        }`}
      >
        {label}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left outline-none ${
          theme === 'dark'
            ? 'border-zinc-700 bg-zinc-800 text-white'
            : 'border-zinc-300 bg-white text-zinc-900'
        }`}
      >
        <span>{selected?.label ?? 'Chọn ngôn ngữ'}</span>
        <span className="ml-3 flex items-center gap-2">
          {code(selected) && (
            <span className="text-xs lowercase opacity-50">
              {code(selected)}
            </span>
          )}
          <span className="text-xs opacity-60">⌄</span>
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border p-1 shadow-2xl ${
            theme === 'dark'
              ? 'border-zinc-700 bg-zinc-900'
              : 'border-zinc-200 bg-white'
          }`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                option.value === value
                  ? theme === 'dark'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-100 text-zinc-900'
                  : theme === 'dark'
                    ? 'text-zinc-300 hover:bg-zinc-800'
                    : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span>{option.label}</span>
              {code(option) && (
                <span className="ml-3 text-[11px] lowercase opacity-45">
                  {code(option)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
