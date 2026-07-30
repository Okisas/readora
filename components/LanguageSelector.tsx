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

const flagCodes: Record<string, string> = {
  eng: 'gb',
  en: 'gb',
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
  por: 'pt',
  pt: 'pt',
  rus: 'ru',
  ru: 'ru',
  vi: 'vn',
}

const getFlagUrl = (value: string) => {
  const code = flagCodes[value]
  return code ? `https://flagcdn.com/w20/${code}.png` : null
}

export default function LanguageSelector({
  label,
  options,
  theme = 'dark',
  value,
  onChange,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0]
  const selectedFlag = selectedOption
    ? getFlagUrl(selectedOption.value)
    : null

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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label ?? 'Chọn ngôn ngữ'}</span>
        <span className="ml-3 flex items-center gap-2">
          {selectedFlag && (
            <img
              src={selectedFlag}
              alt=""
              className="h-4 w-6 rounded-sm object-cover"
            />
          )}
          <span className="text-xs opacity-60">⌄</span>
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border p-1 shadow-2xl ${
            theme === 'dark'
              ? 'border-zinc-700 bg-zinc-900'
              : 'border-zinc-200 bg-white'
          }`}
        >
          {options.map((option) => {
            const flagUrl = getFlagUrl(option.value)

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
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
                {flagUrl && (
                  <img
                    src={flagUrl}
                    alt=""
                    className="ml-3 h-4 w-6 rounded-sm object-cover"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
