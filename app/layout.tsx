import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Readora | Translate Manga, Manhwa, and Manhua Images',
  description:
    'Readora helps you translate manga, manhwa, and manhua from images with a simple online reader and editor.',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
