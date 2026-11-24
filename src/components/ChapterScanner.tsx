import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Image as ImageIcon,
  Images,
  Loader2,
  Save,
  ScanText,
  Trash2,
} from 'lucide-react';
import {
  CHAPTER_LIMITS,
  type Book,
  type Chapter,
  type ChapterStatus,
  type PendingPhoto,
  type ScanPagesApiResponse,
  type ScannedPageRecord,
} from '../types/book';
import { compressBookPhoto } from '../utils/imageCompress';
import {
  deleteSavedPageImage,
  saveChapterContent,
  subscribeToChapterPages,
} from '../services/firestoreBooks';

interface ChapterScannerProps {
  book: Book;
  chapter: Chapter;
  userId: string;
  userEmail: string | null | undefined;
  onBack: () => void;
}

export const ChapterScanner: React.FC<ChapterScannerProps> = ({
  book,
  chapter,
  userId,
  userEmail,
  onBack,
}) => {
  const [chapterNumber, setChapterNumber] = useState<number>(chapter.chapterNumber);
  const [title, setTitle] = useState<string>(chapter.title);
  const [combinedText, setCombinedText] = useState<string>(chapter.combinedText);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [savedPages, setSavedPages] = useState<ScannedPageRecord[]>([]);
  const [mergeMode, setMergeMode] = useState<'replace' | 'append'>('append');

  const [compressing, setCompressing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [detectedHeading, setDetectedHeading] = useState<{
    chapterNumber: number;
    title: string;
  } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setChapterNumber(chapter.chapterNumber);
    setTitle(chapter.title);
    setCombinedText(chapter.combinedText);
    setStatus(chapter.status);
    setDetectedHeading(null);
  }, [chapter.id, chapter.chapterNumber, chapter.title, chapter.combinedText, chapter.status]);

  useEffect(() => {
    const unsubscribe = subscribeToChapterPages(
      book.id,
      chapter.id,
      userId,
      userEmail,
      (pages) => {
        setSavedPages(pages);
      }
    );
    return () => unsubscribe();
  }, [book.id, chapter.id, userId, userEmail]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    e.target.value = '';

    setCompressing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const remainingSlots = Math.max(0, 12 - pendingPhotos.length);
      if (files.length > remainingSlots) {
        setErrorMsg(`You can queue up to 12 pages per scan batch. Added the first ${remainingSlots}.`);
      }
      const filesToProcess = files.slice(0, remainingSlots);
      const nextItems: PendingPhoto[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const compressed = await compressBookPhoto(filesToProcess[i]);
        nextItems.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
          pageNumber: pendingPhotos.length + nextItems.length + 1,
          previewUrl: compressed.previewUrl,
          ocrBase64: compressed.ocrBase64,
          ocrMimeType: compressed.ocrMimeType,
          archivalDataUrl: compressed.archivalDataUrl,
          keepImage: false,
          hasDiagram: false,
          diagramNote: '',
          extractedText: '',
        });
      }

      setPendingPhotos((prev) =>
        [...prev, ...nextItems].map((item, idx) => ({ ...item, pageNumber: idx + 1 }))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to prepare photo.');
    } finally {
      setCompressing(false);
    }
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pendingPhotos.length) return;
    setPendingPhotos((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  const removePhoto = (localId: string) => {
    setPendingPhotos((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, idx) => ({ ...item, pageNumber: idx + 1 }))
    );
  };

  const toggleKeepImage = (localId: string) => {
    setPendingPhotos((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, keepImage: !item.keepImage } : item
      )
    );
  };

  const handleReadPages = async () => {
    if (pendingPhotos.length === 0) {
      setErrorMsg('Take or pick at least one page photo first.');
      return;
    }

    setScanning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const CHUNK_SIZE = 4;
      const allPageResults: ScanPagesApiResponse['pages'] = [];
      const textParts: string[] = [];
      let firstSuggestedTitle = '';
      let firstSuggestedNumber = 0;

      for (let i = 0; i < pendingPhotos.length; i += CHUNK_SIZE) {
        const batch = pendingPhotos.slice(i, i + CHUNK_SIZE);
        const response = await fetch('/api/scan-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: book.language,
            bookTitle: book.title,
            chapterTitle: title,
            pages: batch.map((p) => ({
              pageNumber: p.pageNumber,
              mimeType: p.ocrMimeType,
              data: p.ocrBase64,
            })),
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Could not read pages from photos.');
        }

        const chunkResult = payload as ScanPagesApiResponse;
        allPageResults.push(...chunkResult.pages);
        if (chunkResult.combinedText.trim()) {
          textParts.push(chunkResult.combinedText.trim());
        }
        if (i === 0) {
          firstSuggestedTitle = chunkResult.suggestedChapterTitle || '';
          firstSuggestedNumber = chunkResult.suggestedChapterNumber || 0;
        }
      }

      const byPage = new Map(allPageResults.map((p) => [p.pageNumber, p]));

      setPendingPhotos((prev) =>
        prev.map((photo) => {
          const matched = byPage.get(photo.pageNumber);
          if (!matched) return photo;
          return {
            ...photo,
            extractedText: matched.extractedText || '',
            hasDiagram: Boolean(matched.hasDiagram),
            diagramNote: matched.diagramNote || '',
            keepImage: photo.keepImage || Boolean(matched.hasDiagram),
          };
        })
      );

      const newText = textParts.join('\n\n');
      setCombinedText((prev) => {
        const existingTrimmed = prev.trim();
        if (!existingTrimmed || mergeMode === 'replace') {
          return newText.slice(0, CHAPTER_LIMITS.combinedTextMax);
        }
        return `${existingTrimmed}\n\n${newText}`.slice(0, CHAPTER_LIMITS.combinedTextMax);
      });

      const suggestedTitle = firstSuggestedTitle.trim().slice(0, CHAPTER_LIMITS.titleMax);
      const suggestedNum =
        typeof firstSuggestedNumber === 'number' && firstSuggestedNumber > 0
          ? Math.min(500, Math.round(firstSuggestedNumber))
          : 0;

      if (suggestedTitle) {
        const isPlaceholderTitle =
          !title.trim() || /^chapter\s*\d*$/i.test(title.trim()) || /^पाठ\s*\d*$/i.test(title.trim());

        if (isPlaceholderTitle) {
          setTitle(suggestedTitle);
          if (suggestedNum > 0) {
            setChapterNumber(suggestedNum);
          }
          setDetectedHeading(null);
        } else if (suggestedTitle.toLowerCase() !== title.trim().toLowerCase()) {
          setDetectedHeading({
            chapterNumber: suggestedNum,
            title: suggestedTitle,
          });
        } else {
          setDetectedHeading(null);
        }
      } else {
        setDetectedHeading(null);
      }

      setStatus('ready');
      setSuccessMsg(
        `Read ${pendingPhotos.length} page${pendingPhotos.length === 1 ? '' : 's'}. Review the combined text below and save when ready.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to scan textbook pages.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveChapter = async (nextStatus: ChapterStatus) => {
    if (!title.trim()) {
      setErrorMsg('Please enter a chapter title before saving.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await saveChapterContent(book.id, chapter.id, userId, {
        chapterNumber,
        title,
        combinedText,
        status: nextStatus,
        pendingPhotos: pendingPhotos.length > 0 ? pendingPhotos : undefined,
        existingPageCount: chapter.pageCount,
        existingSavedImageCount: chapter.savedImageCount,
      });

      setStatus(nextStatus);
      setSuccessMsg(
        nextStatus === 'ready'
          ? 'Chapter saved to Firebase.'
          : 'Draft saved to Firebase.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save chapter.');
    } finally {
      setSaving(false);
    }
  };

  const keptPendingCount = pendingPhotos.filter((p) => p.keepImage).length;
  const savedImagePages = savedPages.filter((p) => p.keepImage && p.imageDataUrl);

  return (
    <div className="pb-24 lg:pb-10">
      {/* Sub-header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back to {book.title}
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{book.board}</span>
          <span aria-hidden="true">·</span>
          <span>{book.grade}</span>
          <span aria-hidden="true">·</span>
          <span>{book.language === 'hi' ? 'हिन्दी' : 'English'}</span>
          <span aria-hidden="true">·</span>
          <span className={status === 'ready' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            {status === 'ready' ? 'Ready' : 'Draft'}
          </span>
        </div>
      </div>

      {/* Chapter identity fields */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-3">
            <label htmlFor="ch-num" className="block text-xs font-medium text-slate-600 mb-1.5">
              Chapter No.
            </label>
            <input
              id="ch-num"
              type="number"
              min={1}
              max={500}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(Math.max(1, Number(e.target.value) || 1))}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 tabular-nums bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-9">
            <label htmlFor="ch-title" className="block text-xs font-medium text-slate-600 mb-1.5">
              Chapter Title
            </label>
            <input
              id="ch-title"
              type="text"
              maxLength={CHAPTER_LIMITS.titleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chapter 1: Poonam's Day Out"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {detectedHeading && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="min-w-0 truncate">
                  Detected heading:{' '}
                  <strong className="text-slate-900 font-medium">
                    {detectedHeading.chapterNumber > 0 ? `${detectedHeading.chapterNumber}. ` : ''}
                    {detectedHeading.title}
                  </strong>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(detectedHeading.title);
                      if (detectedHeading.chapterNumber > 0) {
                        setChapterNumber(detectedHeading.chapterNumber);
                      }
                      setDetectedHeading(null);
                    }}
                    className="font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    Use detected title
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetectedHeading(null)}
                    className="text-slate-500 hover:text-slate-800 whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main 2-column responsive layout on desktop, stacked thumb-first on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Top Column: Camera & Photo Queue */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="font-display text-base font-semibold text-slate-900">
              1. Scan Book Pages
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {pendingPhotos.length}/12 queued
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Snap pages in order. Toggle <strong>Keep photo</strong> on any page that has a picture or diagram you want saved.
          </p>

          {/* Hidden native inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFilesSelected}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />

          {/* Big mobile-first camera & gallery triggers */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              disabled={compressing || pendingPhotos.length >= 12}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[48px] px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Camera className="w-4 h-4 shrink-0" />
              Take Photo
            </button>
            <button
              type="button"
              disabled={compressing || pendingPhotos.length >= 12}
              onClick={() => galleryInputRef.current?.click()}
              className="min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Images className="w-4 h-4 shrink-0" />
              Pick Photos
            </button>
          </div>

          {compressing && (
            <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5 mb-4">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Preparing page photo...
            </div>
          )}

          {/* Queued page thumbnails */}
          {pendingPhotos.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl py-8 px-4 text-center text-sm text-slate-500">
              No photos queued yet. Tap <strong>Take Photo</strong> or <strong>Pick Photos</strong> to scan pages.
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              {pendingPhotos.map((photo, index) => (
                <div
                  key={photo.localId}
                  className="border border-slate-200 rounded-xl p-3 bg-slate-50/70"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedImage(photo.previewUrl)}
                      className="w-16 h-20 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={`Queued page ${photo.pageNumber}`}
                        className="w-full h-full object-cover"
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          Page {photo.pageNumber}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePhoto(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move page ${photo.pageNumber} up`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(index, 1)}
                            disabled={index === pendingPhotos.length - 1}
                            aria-label={`Move page ${photo.pageNumber} down`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePhoto(photo.localId)}
                            aria-label={`Remove page ${photo.pageNumber}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {photo.hasDiagram && (
                        <p className="text-xs text-blue-700 mb-1.5 leading-snug">
                          Diagram detected{photo.diagramNote ? `: ${photo.diagramNote}` : ''}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleKeepImage(photo.localId)}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          photo.keepImage
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {photo.keepImage ? (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {photo.keepImage ? 'Keeping photo' : 'Keep photo'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {combinedText.trim().length > 0 && pendingPhotos.length > 0 && (
            <div className="mb-4">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">
                When reading these new pages:
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMergeMode('append')}
                  className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    mergeMode === 'append'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Append to text
                </button>
                <button
                  type="button"
                  onClick={() => setMergeMode('replace')}
                  className={`min-h-[36px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    mergeMode === 'replace'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Replace text
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={scanning || compressing || pendingPhotos.length === 0}
            onClick={handleReadPages}
            className="w-full min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Reading {pendingPhotos.length} page{pendingPhotos.length === 1 ? '' : 's'}...
              </>
            ) : (
              <>
                <ScanText className="w-4 h-4 shrink-0" />
                Read Pages ({book.language === 'hi' ? 'Hindi & English' : 'English'})
              </>
            )}
          </button>
        </section>

        {/* Right/Bottom Column: Combined Text Editor & Saved Diagram Photos */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                2. Combined Chapter Text
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>{combinedText.length.toLocaleString()} chars</span>
                <span aria-hidden="true">·</span>
                <span>
                  {pendingPhotos.length > 0
                    ? `${keptPendingCount} photo${keptPendingCount === 1 ? '' : 's'} marked`
                    : `${savedImagePages.length} saved photo${savedImagePages.length === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            <textarea
              value={combinedText}
              onChange={(e) => setCombinedText(e.target.value.slice(0, CHAPTER_LIMITS.combinedTextMax))}
              rows={14}
              placeholder={
                book.language === 'hi'
                  ? 'पेज स्कैन करने के बाद यहाँ पाठ और अभ्यास प्रश्न दिखेंगे... आप इन्हें यहाँ सुधार भी सकते हैं।'
                  : 'Scanned story, lesson text, and end-of-chapter exercises will appear here as one combined text. You can edit anything before saving.'
              }
              className="w-full p-3.5 text-sm sm:text-base text-slate-900 leading-relaxed bg-slate-50/50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white resize-y"
            />

            {errorMsg && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {errorMsg}
              </p>
            )}

            {successMsg && (
              <p className="mt-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                {successMsg}
              </p>
            )}

            {/* Desktop Save Actions */}
            <div className="hidden lg:flex items-center justify-end gap-3 mt-5">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveChapter('draft')}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveChapter('ready')}
                className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                {saving ? 'Saving...' : 'Save Chapter'}
              </button>
            </div>
          </div>

          {/* Saved Diagram / Reference Images in Firestore */}
          {savedImagePages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Saved Page Photos ({savedImagePages.length})
                </h3>
                <span className="text-xs text-slate-500">Stored in Firebase</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {savedImagePages.map((page) => (
                  <div
                    key={page.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedImage(page.imageDataUrl)}
                      className="w-full aspect-[3/4] block bg-white"
                    >
                      <img
                        src={page.imageDataUrl}
                        alt={`Saved page ${page.pageNumber}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-700 tabular-nums">
                        Page {page.pageNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSavedPageImage(book.id, chapter.id, page.id)}
                        aria-label={`Remove saved photo for page ${page.pageNumber}`}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile Sticky Bottom Save CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSaveChapter('draft')}
          className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap"
        >
          Save Draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSaveChapter('ready')}
          className="flex-1 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Save className="w-4 h-4 shrink-0" />
          )}
          {saving ? 'Saving...' : 'Save Chapter'}
        </button>
      </div>

      {/* Full-size Photo Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Full textbook page preview"
            className="max-w-full max-h-[88vh] rounded-xl object-contain bg-white"
          />
        </div>
      )}
    </div>
  );
};
