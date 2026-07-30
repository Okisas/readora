'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Moon, Sun } from 'lucide-react'
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

  // State cho auto translate
  const [isAutoTranslating, setIsAutoTranslating] = useState(false)

  // Hàm xử lý lấy ảnh từ URL
  const handleFetchFromUrl = async () => {
    if (!mangaUrl.trim()) {
      alert('Vui lòng nhập URL chương truyện')
      return
    }

    try {
      setIsFetchingUrl(true)
      const response = await fetch('/api/fetch-manga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mangaUrl.trim() })
      })

      const data = await response.json()
      console.log('Phản hồi API:', data)

      if (data.success && data.images && data.images.length > 0) {
        const newImages = data.images.map((imgData: string, index: number) => ({
          id: `url_${Date.now()}_${index}`,
          url: imgData
        }))

        setImages((prev: any[]) => [...prev, ...newImages])
        
        if (newImages.length > 0) {
          setCurrentIndex(0)
          drawImage(newImages[0].url)
        }
        
        alert(`Đã tải thành công ${newImages.length} ảnh!`)
      } else {
        alert(data.error || 'Không tìm thấy ảnh từ URL này')
      }
    } catch (error) {
      console.error('Error fetching manga:', error)
      alert('Lỗi kết nối server. Vui lòng thử lại.')
    } finally {
      setIsFetchingUrl(false)
    }
  }

  // Hàm xử lý dịch tự động
  const handleAutoTranslate = async () => {
    if (images.length === 0) {
      alert('Vui lòng upload ảnh hoặc lấy ảnh từ URL trước')
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
        
        alert(`Đã dịch ${data.count} dòng chữ.`)
      } else {
        alert(data.error || 'Dịch thất bại')
      }
    } catch (error) {
      console.error('Auto translate error:', error)
      alert('Lỗi kết nối server')
    } finally {
      setIsAutoTranslating(false)
    }
  }

  return (
    <main
      className={`min-h-screen overflow-hidden ${
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
            <div
              className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] backdrop-blur sm:mb-4 sm:text-xs ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900/70 text-zinc-300'
                  : 'border-zinc-200 bg-white/75 text-zinc-700'
              }`}
            >
              Dịch manga, manhwa và manhua
            </div>

            <h1 className="mb-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl md:mb-4 md:text-5xl">
              Dịch truyện
              <br />
              từ hình ảnh
            </h1>

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
              <div className="space-y-4">
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
                      placeholder="Nhập URL từ Webtoon, BookWalker, Manga Plus hoặc MangaDex"
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
                      onClick={handleFetchFromUrl}
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
                  <p className={`mt-2 text-xs ${
                    theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
                  }`}>
                    Hỗ trợ link từ Webtoon, BookWalker, Manga Plus và MangaDex
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
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
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
              onInputChange={setTextInput}
              onSourceLanguageChange={setTextSourceLanguage}
              onTargetLanguageChange={setTextTargetLanguage}
              onTranslate={handleTranslateText}
            />
          )}
        </div>
      </div>
    </main>
  )
}
