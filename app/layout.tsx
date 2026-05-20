import Script from 'next/script'
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
      
      <body>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YYVPXWZLF8"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-YYVPXWZLF8');
          `}
        </Script>
        
        {children}
      </body>
    </html>
  )
}
