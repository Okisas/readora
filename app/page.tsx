'use client'

import { Suspense } from 'react'
import Image from 'next/image'
import { Moon, Sun } from 'lucide-react'
import DonateCard from '@/components/DonateCard'
import ImageUtilityCanvas from '@/components/ImageUtilityCanvas'
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
    imageToolStatus,
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
    cropCurrentImage,
    removeBackgroundFromCurrentImage,
    removeBackgroundStrength,
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
    setRemoveBackgroundStrength,
    translatorMode,
    setTranslatorMode,
    sourceLanguage,
    targetLanguage,
    setTheme,
    theme,
  } = useMangaTranslator()

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
                  Read Stories Better
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
                ? 'Light Mode'
                : 'Dark Mode'}
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
              Manga, manhwa, and manhua translation
            </div>

            <h1 className="mb-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl md:mb-4 md:text-5xl">
              Translate Stories
              <br />
              From Images
            </h1>

            <p
              className={`mx-auto max-w-xl text-sm leading-relaxed sm:text-base ${
                theme === 'dark'
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
              }`}
            >
              Upload manga, manhwa, or manhua pages,
              scan each speech bubble, and translate
              the text directly on the image.
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

          <div className="mb-4 flex justify-center sm:mb-5">
            <div
              className={`inline-flex w-full max-w-3xl flex-wrap rounded-full p-1 sm:w-auto ${
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
                Image
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
                Text
              </button>
              <button
                type="button"
                onClick={() => setTranslatorMode('crop')}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold sm:flex-none ${
                  translatorMode === 'crop'
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-white'
                    : theme === 'dark'
                    ? 'text-zinc-300'
                    : 'text-zinc-700'
                }`}
              >
                Crop Image
              </button>
              <button
                type="button"
                onClick={() =>
                  setTranslatorMode('remove-bg')
                }
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold sm:flex-none ${
                  translatorMode === 'remove-bg'
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-white'
                    : theme === 'dark'
                    ? 'text-zinc-300'
                    : 'text-zinc-700'
                }`}
              >
                Remove Background
              </button>
              <button
                type="button"
                onClick={() => setTranslatorMode('donate')}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold sm:flex-none ${
                  translatorMode === 'donate'
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-zinc-900 text-white'
                    : theme === 'dark'
                    ? 'text-zinc-300'
                    : 'text-zinc-700'
                }`}
              >
                Donate
              </button>
            </div>
          </div>

          {translatorMode === 'image' ? (
            <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
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
          ) : translatorMode === 'crop' ||
            translatorMode === 'remove-bg' ? (
            <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:gap-8">
              <UploadPanel
                isDragging={isDragging}
                images={images}
                statusMessage={imageToolStatus}
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

              <ImageUtilityCanvas
                mode={translatorMode}
                imagesLength={images.length}
                theme={theme}
                canvasRef={canvasRef}
                selection={selection}
                isSelecting={isSelecting}
                isProcessing={isProcessing}
                statusMessage={imageToolStatus}
                removeBackgroundStrength={
                  removeBackgroundStrength
                }
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onSelectionMoveStart={startMoveSelection}
                onSelectionResizeStart={
                  startResizeSelection
                }
                onClearSelection={clearSelection}
                onCropImage={cropCurrentImage}
                onRemoveBackground={
                  removeBackgroundFromCurrentImage
                }
                onDownloadImage={downloadCurrentImage}
                onRemoveBackgroundStrengthChange={
                  setRemoveBackgroundStrength
                }
              />
            </div>
          ) : translatorMode === 'donate' ? (
            <Suspense fallback={null}>
              <DonateCard theme={theme} />
            </Suspense>
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
