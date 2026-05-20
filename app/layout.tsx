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
      <meta name="google-adsense-account" content="ca-pub-3558900564632115"></meta>
      <meta name="google-site-verification" content="3Rki2vSPK39LR6h_QEZh9t96z4Z4ZVV06PZiYW_6kiY" />
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
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
          Readora được duy trì bằng quảng cáo để giữ web hoạt động miễn phí.
          Nếu quảng cáo hữu ích với bạn, hãy cân nhắc ủng hộ bằng cách tương tác với chúng. Cảm ơn bạn ❤️
          Ads help keep Readora free and running for everyone ❤️
        </div>
        {children}

        <div className="mt-6 text-center text-sm text-zinc-500">
          <span>Support • Contact • Feedback:</span>{' '}
          
          <a
            href="mailto:tranthanhnguyenviet@gmail.com"
            className="underline underline-offset-4 hover:text-white"
          >
            tranthanhnguyenviet@gmail.com
          </a>

          <span className="mx-2">•</span>

          <a
            href="/privacy"
            className="hover:text-white"
          >
            Privacy
          </a>
        </div>
      </body>
    </html>
  )
}
