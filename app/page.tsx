'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  MessageCircle,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import PreviewCanvas from '@/components/PreviewCanvas'
import TextTranslatePanel from '@/components/TextTranslatePanel'
import UploadPanel from '@/components/UploadPanel'
import useMangaTranslator from '@/components/useMangaTranslator'

export default function HomePage() {
  const {
    activeEditorRegion,
    activeOverlayId,
    applyOverlaySentence,
    canvasRef,
    closeOverlayEditor,
    currentIndex,
    currentOverlays,
    deletePage,
    deleteOverlay,
    downloadCurrentImage,
    editorSentence,
    editorTranslation,
    getOverlayStyle,
    getOverlayEditorStyle,
    handleDrop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleUpload,
    hoveredOverlayId,
    images,
    isDragging,
    isProcessing,
    isSelecting,
    isUpdatingOverlay,
    mergeImages,
    movePage,
    ocrText,
    clearSelection,
    scanSelection,
    saveEditedTranslation,
    selectOverlay,
    startMoveSelection,
    startResizeSelection,
    textInput,
    textOutput,
    textSourceLanguage,
    textTargetLanguage,
    isTranslatingText,
    handleTranslateText,
    selectPage,
    selection,
    setHoveredOverlayId,
    setEditorSentence,
    setEditorTranslation,
    setIsDragging,
    setSourceLanguage,
    setTargetLanguage,
    setTextInput,
    setTextSourceLanguage,
    setTextTargetLanguage,
    translatorMode,
    setTranslatorMode,
    sourceLanguage,
    targetLanguage,
    setTheme,
    theme,
    drawImage,
    setImages,
    setCurrentIndex,
  } = useMangaTranslator()

  // State cho URL input
  const [mangaUrl, setMangaUrl] = useState('')
  const [isFetchingUrl, setIsFetchingUrl] = useState(false)
  const [textUrl, setTextUrl] = useState('')
  const [textChapterTitle, setTextChapterTitle] = useState('')
  const [isFetchingTextUrl, setIsFetchingTextUrl] = useState(false)

  const webtoonChapter = (() => {
    try {
      const parsedUrl = new URL(mangaUrl)
      const isWebtoon =
        parsedUrl.protocol === 'https:' &&
        (parsedUrl.hostname === 'webtoons.com' ||
          parsedUrl.hostname.endsWith('.webtoons.com'))
      const episodeNumber = Number(parsedUrl.searchParams.get('episode_no'))

      if (!isWebtoon || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
        return null
      }

      return { parsedUrl, episodeNumber }
    } catch {
      return null
    }
  })()

  // State cho auto translate
  const [isAutoTranslating, setIsAutoTranslating] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3500)
  }

  useEffect(() => {
    setHasMounted(true)
    const guideSeen = window.localStorage.getItem('readora-guide-seen')
    if (!guideSeen) {
      setIsGuideOpen(true)
    }

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const closeGuide = () => {
    setIsGuideOpen(false)
    window.localStorage.setItem('readora-guide-seen', '1')
  }

  // Hàm xử lý lấy ảnh từ URL
  const handleFetchFromUrl = async (
    urlOverride?: string,
    replaceImages = false,
  ) => {
    const requestedUrl = (urlOverride ?? mangaUrl).trim()

    if (!requestedUrl) {
      showToast('Vui lòng nhập URL chương truyện', 'error')
      return
    }

    try {
      setIsFetchingUrl(true)
      const response = await fetch('/api/fetch-manga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: requestedUrl })
      })

      const data = await response.json()
      console.log('Phản hồi API:', data)

      if (data.success && data.images && data.images.length > 0) {
        const newImages = data.images.map((imgData: string, index: number) => ({
          id: `url_${Date.now()}_${index}`,
          url: imgData
        }))

        setImages((prev: any[]) =>
          replaceImages ? newImages : [...prev, ...newImages],
        )
        
        if (newImages.length > 0) {
          setCurrentIndex(0)
          drawImage(newImages[0].url)
        }
        
        showToast(`Đã tải thành công ${newImages.length} ảnh!`, 'success')
      } else {
        showToast(data.error || 'Không tìm thấy ảnh từ URL này', 'error')
      }
    } catch (error) {
      console.error('Error fetching manga:', error)
      showToast('Lỗi kết nối server. Vui lòng thử lại.', 'error')
    } finally {
      setIsFetchingUrl(false)
    }
  }

  const navigateWebtoonChapter = async (direction: -1 | 1) => {
    if (!webtoonChapter) return

    const nextEpisode = webtoonChapter.episodeNumber + direction
    if (nextEpisode < 1) {
      showToast('Đây là chap đầu tiên', 'info')
      return
    }

    const nextUrl = new URL(webtoonChapter.parsedUrl.toString())
    nextUrl.searchParams.set('episode_no', String(nextEpisode))
    setMangaUrl(nextUrl.toString())
    await handleFetchFromUrl(nextUrl.toString(), true)
  }

  // Hàm xử lý dịch tự động
  const handleAutoTranslate = async () => {
    if (images.length === 0) {
      showToast('Vui lòng upload ảnh hoặc lấy ảnh từ URL trước', 'error')
      return
    }

    const currentImage = images[currentIndex]
    if (!currentImage) return

    try {
      setIsAutoTranslating(true)
      
      // Lấy ảnh base64
      const response = await fetch(currentImage.url)
      const blob = await response.blob()
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      // Gọi API auto-translate
      const apiResponse = await fetch('/api/auto-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          sourceLanguage: sourceLanguage || 'eng',
          targetLanguage: targetLanguage || 'vi',
        }),
      })

      const data = await apiResponse.json()

      if (data.success) {
        // Thay thế ảnh hiện tại bằng ảnh đã dịch
        const newImage = {
          id: `translated_${Date.now()}`,
          url: data.imageWithTranslation,
        }
        
        const newImages = [...images]
        newImages[currentIndex] = newImage
        setImages(newImages)
        drawImage(newImage.url)
        
        showToast(`Đã dịch ${data.count} dòng chữ.`, 'success')
      } else {
        showToast(data.error || 'Dịch thất bại', 'error')
      }
    } catch (error) {
      console.error('Auto translate error:', error)
      showToast('Lỗi kết nối server', 'error')
    } finally {
      setIsAutoTranslating(false)
    }
  }

  const handleFetchTextFromUrl = async () => {
    if (!textUrl.trim()) {
      showToast('Vui lòng nhập URL chương truyện', 'error')
      return
    }

    try {
      setIsFetchingTextUrl(true)
      const response = await fetch('/api/fetch-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: textUrl.trim() }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        showToast(data.error || 'Không lấy được nội dung chương', 'error')
        return
      }

      setTextChapterTitle(data.title || `Nội dung từ ${data.site}`)
      setTextInput(data.content)
      showToast(`Đã lấy nội dung từ ${data.site}`, 'success')
    } catch (error) {
      console.error('Text chapter fetch error:', error)
      showToast('Lỗi kết nối server. Vui lòng thử lại.', 'error')
    } finally {
      setIsFetchingTextUrl(false)
    }
  }

  return (
    <main
      className={`min-h-screen overflow-x-hidden ${
        theme === 'dark'
          ? 'bg-black text-white'
          : 'bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-zinc-950'
      }`}
    >
      <div
        className={`absolute inset-0 ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_top,rgba(120,119,198,0.15),transparent_40%)]'
            : 'bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_45%)]'
        }`}
      />

      <div className="relative">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:py-5 md:px-8 md:py-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div
              className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900/70 text-zinc-100'
                  : 'border-zinc-200 bg-white/80 text-zinc-900'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full ${
                  theme === 'dark'
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-white'
                }`}
              >
                <Image
                  src="/upload/logo.png"
                  alt="Readora logo"
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                  priority
                />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Readora
                </div>
                <div
                  className={`text-xs ${
                    theme === 'dark'
                      ? 'text-zinc-400'
                      : 'text-zinc-500'
                  }`}
                >
                  Đọc truyện dễ dàng hơn
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setTheme(
                  theme === 'dark' ? 'light' : 'dark'
                )
              }
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-900/70 text-zinc-200'
                  : 'border-zinc-300 bg-white/80 text-zinc-900'
              }`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              {theme === 'dark'
                ? 'Chế độ sáng'
                : 'Chế độ tối'}
            </button>
          </div>

          <div className="mb-5 text-center sm:mb-6">
            <p
              className={`mx-auto max-w-xl text-sm leading-relaxed sm:text-base ${
                theme === 'dark'
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
              }`}
            >
              Tải lên các trang manga, manhwa hoặc manhua,
              quét từng khung thoại và dịch trực tiếp
              trên hình ảnh.
            </p>

            <div
              className={`mx-auto mt-4 max-w-2xl rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:mt-5 ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
                  : 'border-zinc-200 bg-white/80 text-zinc-700'
              }`}
            >
              Support • Contact • Feedback: {' '}
              <a
                href="mailto:tranthanhnguyenviet@gmail.com"
                className={`font-semibold underline underline-offset-4 ${
                  theme === 'dark'
                    ? 'text-white'
                    : 'text-zinc-950'
                }`}
              >
                tranthanhnguyenviet@gmail.com
              </a>
            </div>
          </div>

          {/* Tabs - chỉ giữ Image và Text */}
          <div className="mb-4 flex justify-center sm:mb-5">
            <div
              className={`inline-flex w-full max-w-md flex-wrap rounded-full p-1 sm:w-auto ${
                theme === 'dark'
                  ? 'border border-zinc-800 bg-zinc-900/70'
                  : 'border border-zinc-200 bg-white/80'
              }`}
            >
              <button
                type="button"
                onClick={() => setTranslatorMode('image')}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold sm:flex-none ${
                  translatorMode === 'image'
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-white'
                    : theme === 'dark'
                    ? 'text-zinc-300'
                    : 'text-zinc-700'
                }`}
              >
                Hình ảnh
              </button>
              <button
                type="button"
                onClick={() => setTranslatorMode('text')}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold sm:flex-none ${
                  translatorMode === 'text'
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-white'
                    : theme === 'dark'
                    ? 'text-zinc-300'
                    : 'text-zinc-700'
                }`}
              >
                Văn bản
              </button>
            </div>
          </div>

          {translatorMode === 'image' ? (
            <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
              <div className="min-w-0 w-full space-y-4">
                {/* Phần nhập URL */}
                <div
                  className={`rounded-3xl border p-4 backdrop-blur sm:p-6 ${
                    theme === 'dark'
                      ? 'border-zinc-800 bg-zinc-900/70'
                      : 'border-zinc-200 bg-white/85'
                  }`}
                >
                  <div className="mb-3 text-sm font-semibold">
                    Lấy ảnh từ URL
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="url"
                      placeholder="Nhập URL từ Webtoon hoặc MangaDex"
                      value={mangaUrl}
                      onChange={(e) => setMangaUrl(e.target.value)}
                      className={`flex-1 rounded-xl border px-4 py-2 text-sm outline-none ${
                        theme === 'dark'
                          ? 'border-zinc-700 bg-black/40 text-white placeholder:text-zinc-500'
                          : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchFromUrl()}
                      disabled={isFetchingUrl}
                      className={`rounded-xl px-5 py-2 text-sm font-semibold whitespace-nowrap transition disabled:opacity-50 ${
                        theme === 'dark'
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isFetchingUrl ? 'Đang lấy...' : 'Lấy ảnh'}
                    </button>
                  </div>
                  {webtoonChapter && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigateWebtoonChapter(-1)}
                        disabled={isFetchingUrl || webtoonChapter.episodeNumber <= 1}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                        }`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Chap trước
                      </button>
                      <span
                        className={`text-xs ${
                          theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        Chap {webtoonChapter.episodeNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateWebtoonChapter(1)}
                        disabled={isFetchingUrl}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                        }`}
                      >
                        Chap sau
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <p className={`mt-2 text-xs ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Hiện chỉ hỗ trợ link từ Webtoon và MangaDex
                  </p>
                </div>

                <UploadPanel
                  isDragging={isDragging}
                  images={images}
                  statusMessage={ocrText}
                  currentIndex={currentIndex}
                  sourceLanguage={sourceLanguage}
                  targetLanguage={targetLanguage}
                  theme={theme}
                  onDeletePage={deletePage}
                  onDragStateChange={setIsDragging}
                  onMergeImages={mergeImages}
                  onMovePage={movePage}
                  onDrop={handleDrop}
                  onUpload={handleUpload}
                  onSourceLanguageChange={setSourceLanguage}
                  onTargetLanguageChange={setTargetLanguage}
                  onSelectPage={selectPage}
                />
              </div>

              <div className="min-w-0 space-y-6 xl:space-y-8">
                <PreviewCanvas
                  imagesLength={images.length}
                  theme={theme}
                  canvasRef={canvasRef}
                  currentOverlays={currentOverlays}
                  activeEditorRegion={activeEditorRegion}
                  activeOverlayId={activeOverlayId}
                  editorSentence={editorSentence}
                  editorTranslation={editorTranslation}
                  selection={selection}
                  hoveredOverlayId={hoveredOverlayId}
                  isSelecting={isSelecting}
                  isUpdatingOverlay={isUpdatingOverlay}
                  onPointerDown={handleMouseDown}
                  onPointerMove={handleMouseMove}
                  onPointerUp={handleMouseUp}
                  onScanSelection={scanSelection}
                  onClearSelection={clearSelection}
                  onCloseOverlayEditor={closeOverlayEditor}
                  onApplyOverlaySentence={
                    applyOverlaySentence
                  }
                  onSaveEditedTranslation={
                    saveEditedTranslation
                  }
                  onEditorSentenceChange={
                    setEditorSentence
                  }
                  onEditorTranslationChange={
                    setEditorTranslation
                  }
                  onSelectionMoveStart={startMoveSelection}
                  onSelectionResizeStart={
                    startResizeSelection
                  }
                  onOverlayHover={setHoveredOverlayId}
                  onOverlaySelect={selectOverlay}
                  onDeleteOverlay={deleteOverlay}
                  getOverlayStyle={getOverlayStyle}
                  getOverlayEditorStyle={
                    getOverlayEditorStyle
                  }
                />
              </div>
            </div>
          ) : (
            <TextTranslatePanel
              inputText={textInput}
              outputText={textOutput}
              isTranslating={isTranslatingText}
              sourceLanguage={textSourceLanguage}
              targetLanguage={textTargetLanguage}
              theme={theme}
              textUrl={textUrl}
              chapterTitle={textChapterTitle}
              isFetchingUrl={isFetchingTextUrl}
              onTextUrlChange={setTextUrl}
              onFetchUrl={handleFetchTextFromUrl}
              onSourceLanguageChange={setTextSourceLanguage}
              onTargetLanguageChange={setTextTargetLanguage}
              onTranslate={handleTranslateText}
            />
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-[10000] max-w-[calc(100vw-2rem)] rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur sm:bottom-6 sm:right-6 sm:max-w-sm ${
            toast.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-950/90 text-emerald-100'
              : toast.type === 'error'
                ? 'border-red-400/30 bg-red-950/90 text-red-100'
                : 'border-zinc-700 bg-zinc-950/95 text-zinc-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      {hasMounted && (
        <div className="fixed bottom-4 right-4 z-[9999] sm:bottom-6 sm:right-6">
          {isGuideOpen && (
            <div
              className={`mb-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border shadow-2xl ${
                theme === 'dark'
                  ? 'border-zinc-700 bg-zinc-950 text-zinc-100'
                  : 'border-zinc-200 bg-white text-zinc-900'
              }`}
            >
              <div
                className={`flex items-center justify-between px-4 py-3 ${
                  theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  <BookOpen className="h-4 w-4" />
                  Hướng dẫn sử dụng
                </div>
                <button
                  type="button"
                  onClick={closeGuide}
                  aria-label="Đóng hướng dẫn"
                  className={`rounded-full p-1 transition ${
                    theme === 'dark'
                      ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[min(70vh,34rem)] space-y-4 overflow-y-auto px-4 py-4 text-xs leading-relaxed sm:text-sm">
                <section>
                  <h2 className="mb-1 font-bold">Readora hỗ trợ gì?</h2>
                  <p className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}>
                    Hiện tại Readora hỗ trợ lấy ảnh chương từ <strong>Webtoon</strong> và <strong>MangaDex</strong>.
                    Các trang khác chưa được hỗ trợ ổn định.
                  </p>
                </section>

                <section>
                  <h2 className="mb-1 font-bold">Dịch văn bản</h2>
                  <p className={theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}>
                    Dán URL chương, nhấn “Lấy nội dung”, chọn đúng ngôn ngữ gốc và ngôn ngữ đích, rồi nhấn “Dịch”. Nội dung bản dịch sẽ hiển thị ở khung bên phải.
                  </p>
                </section>

                <section>
                  <h2 className="mb-1 font-bold">Theo từng nguồn</h2>
                  <ul className={`space-y-1 pl-4 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    <li className="list-disc"><strong>Webtoon:</strong> dán link chapter, sau đó dùng nút chap trước/chap sau để chuyển chương.</li>
                    <li className="list-disc"><strong>MangaDex:</strong> dán link chapter để lấy toàn bộ ảnh của chapter.</li>
                    <li className="list-disc"><strong>Ảnh:</strong> tải ảnh lên hoặc kéo thả ảnh trực tiếp vào khu vực tải ảnh.</li>
                    <li className="list-disc"><strong>Văn bản:</strong> dán URL chương từ Faloo, Qidian hoặc AliceSW để lấy nội dung rồi dịch.</li>
                  </ul>
                </section>

                <section>
                  <h2 className="mb-1 font-bold">Cách dịch ảnh tốt nhất</h2>
                  <ol className={`space-y-1 pl-4 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    <li className="list-decimal">Chọn ảnh cần dịch.</li>
                    <li className="list-decimal">Nhấp vào ảnh để mở vùng quét.</li>
                    <li className="list-decimal">Kéo khung bao phủ toàn bộ khung thoại hoặc ô chữ.</li>
                    <li className="list-decimal">Nhấn <strong>Quét</strong>, kiểm tra bản dịch rồi áp dụng lên ảnh.</li>
                  </ol>
                </section>

                <section className={`rounded-2xl px-3 py-2 ${
                  theme === 'dark' ? 'bg-amber-950/40 text-amber-100' : 'bg-amber-50 text-amber-900'
                }`}>
                  <h2 className="mb-1 font-bold">Mẹo để dịch chính xác hơn</h2>
                  <p>
                    Hãy quét <strong>hết khung thoại của nhân vật</strong>, gồm cả các dòng chữ ở mép trong.
                    Không nên quét quá nhỏ hoặc cắt mất chữ. Ảnh càng rõ và khung quét càng đầy đủ thì OCR và bản dịch càng tốt.
                  </p>
                </section>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsGuideOpen((open) => !open)}
            aria-label="Mở hướng dẫn sử dụng"
            className={`ml-auto flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition hover:scale-105 ${
              theme === 'dark'
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Trở lại đầu trang"
        className={`fixed bottom-20 right-4 z-[10001] flex h-10 w-10 items-center justify-center rounded-full shadow-xl transition hover:scale-105 sm:bottom-24 sm:right-6 ${
          theme === 'dark'
            ? 'bg-zinc-800 text-white hover:bg-zinc-700'
            : 'bg-white text-zinc-900 hover:bg-zinc-100'
        }`}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </main>
  )
}
