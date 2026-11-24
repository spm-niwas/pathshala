import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Images,
  ListOrdered,
  Loader2,
  Plus,
  ScanText,
  Trash2,
  X,
} from 'lucide-react';
import {
  CHAPTER_LIMITS,
  type Book,
  type Chapter,
  type ScanIndexApiResponse,
} from '../types/book';
import { compressBookPhoto } from '../utils/imageCompress';
import { createChaptersBatch } from '../services/firestoreBooks';
import { ConfirmDeleteDialog, type ConfirmDeleteTarget } from './ConfirmDeleteDialog';

interface IndexPhoto {
  localId: string;
  pageNumber: number;
  previewUrl: string;
  ocrBase64: string;
  ocrMimeType: string;
}

interface DraftRow {
  rowId: string;
  chapterNumber: number;
  title: string;
  pageRange: string;
  selected: boolean;
}

interface IndexScannerModalProps {
  book: Book;
  userId: string;
  existingChapters: Chapter[];
  onClose: () => void;
  onCreated: (createdCount: number) => void;
}

export const IndexScannerModal: React.FC<IndexScannerModalProps> = ({
  book,
  userId,
  existingChapters,
  onClose,
  onCreated,
}) => {
  const [photos, setPhotos] = useState<IndexPhoto[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);

  const [compressing, setCompressing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmDeleteTarget | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const existingNumbers = useMemo(
    () => new Set(existingChapters.map((c) => c.chapterNumber)),
    [existingChapters]
  );

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    e.target.value = '';

    setCompressing(true);
    setErrorMsg(null);

    try {
      const remainingSlots = Math.max(0, 4 - photos.length);
      if (files.length > remainingSlots) {
        setErrorMsg(`You can scan up to 4 index pages at once. Added the first ${remainingSlots}.`);
      }

      const filesToProcess = files.slice(0, remainingSlots);
      const nextItems: IndexPhoto[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const compressed = await compressBookPhoto(filesToProcess[i]);
        nextItems.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
          pageNumber: photos.length + nextItems.length + 1,
          previewUrl: compressed.previewUrl,
          ocrBase64: compressed.ocrBase64,
          ocrMimeType: compressed.ocrMimeType,
        });
      }

      setPhotos((prev) =>
        [...prev, ...nextItems].map((item, idx) => ({ ...item, pageNumber: idx + 1 }))
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to prepare index photo.');
    } finally {
      setCompressing(false);
    }
  };

  const removePhoto = (localId: string) => {
    setPhotos((prev) =>
      prev
        .filter((p) => p.localId !== localId)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
    );
  };

  const handleExtractChapters = async () => {
    if (photos.length === 0) {
      setErrorMsg('Take or pick at least one photo of the Contents / Index page.');
      return;
    }

    setExtracting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/scan-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: book.language,
          bookTitle: book.title,
          pages: photos.map((p) => ({
            pageNumber: p.pageNumber,
            mimeType: p.ocrMimeType,
            data: p.ocrBase64,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not extract chapters from the index page.');
      }

      const data = payload as ScanIndexApiResponse;
      if (!data.chapters || data.chapters.length === 0) {
        setErrorMsg('No chapters were detected on those photos. Try a sharper, flat photo of the Contents page.');
        return;
      }

      setRows(
        data.chapters.map((ch, idx) => ({
          rowId: `${Date.now()}-${idx}`,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          pageRange: ch.pageRange || '',
          selected: !existingNumbers.has(ch.chapterNumber),
        }))
      );
      setHasExtracted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to scan index page.');
    } finally {
      setExtracting(false);
    }
  };

  const updateRow = (rowId: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleAddEmptyRow = () => {
    const nextNum =
      rows.length > 0
        ? Math.max(...rows.map((r) => r.chapterNumber)) + 1
        : existingChapters.length > 0
          ? Math.max(...existingChapters.map((c) => c.chapterNumber)) + 1
          : 1;

    setRows((prev) => [
      ...prev,
      {
        rowId: `${Date.now()}-manual-${Math.random().toString(36).slice(2, 6)}`,
        chapterNumber: nextNum,
        title: '',
        pageRange: '',
        selected: true,
      },
    ]);
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => r.selected && r.title.trim().length > 0),
    [rows]
  );

  const handleCreateChapters = async () => {
    if (selectedRows.length === 0) {
      setErrorMsg('Select at least one chapter with a title to create.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const count = await createChaptersBatch(
        book.id,
        userId,
        selectedRows.map((r) => ({
          chapterNumber: r.chapterNumber,
          title: r.title,
        }))
      );
      onCreated(count);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create chapters.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-index-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="scan-index-title"
              className="font-display text-lg font-bold text-slate-900 truncate"
            >
              Scan Index Page
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {book.title} · {book.language === 'hi' ? 'हिन्दी' : 'English'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close index scanner"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!hasExtracted ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Take 1 to 4 photos of the book&apos;s Contents / Index page ({book.language === 'hi' ? 'विषय-सूची' : 'Table of Contents'}). We&apos;ll extract every chapter name so you can scan chapters in any order later.
              </p>

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

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={compressing || photos.length >= 4}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[48px] px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  Take Photo
                </button>
                <button
                  type="button"
                  disabled={compressing || photos.length >= 4}
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Images className="w-4 h-4 shrink-0" />
                  Pick Photos
                </button>
              </div>

              {compressing && (
                <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Preparing index photo...
                </div>
              )}

              {photos.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl py-8 px-4 text-center text-sm text-slate-500">
                  No index photos added yet ({photos.length}/4).
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.localId}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
                    >
                      <div className="aspect-[3/4] bg-white">
                        <img
                          src={photo.previewUrl}
                          alt={`Index page ${photo.pageNumber}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-700 tabular-nums">
                          Page {photo.pageNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              itemName: `Index Page ${photo.pageNumber}`,
                              description: 'from this index scan',
                              onConfirm: () => removePhoto(photo.localId),
                            })
                          }
                          aria-label={`Delete index page ${photo.pageNumber}`}
                          className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Review Extracted Chapters ({selectedRows.length} selected)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Uncheck any front-matter or edit chapter numbers and names before saving.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHasExtracted(false);
                    setErrorMsg(null);
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                >
                  Rescan Photos
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                {rows.map((row) => {
                  const isDuplicate = existingNumbers.has(row.chapterNumber);
                  return (
                    <div
                      key={row.rowId}
                      className={`p-3 flex items-start gap-2.5 ${
                        row.selected ? 'bg-white' : 'bg-slate-50/70 opacity-75'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => updateRow(row.rowId, { selected: !row.selected })}
                        aria-label={row.selected ? 'Deselect chapter' : 'Select chapter'}
                        className={`mt-1.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          row.selected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={500}
                            aria-label="Chapter number"
                            value={row.chapterNumber}
                            onChange={(e) =>
                              updateRow(row.rowId, {
                                chapterNumber: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 min-h-[40px] px-2.5 py-1.5 text-sm text-slate-900 tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
                          />
                          <input
                            type="text"
                            maxLength={CHAPTER_LIMITS.titleMax}
                            aria-label="Chapter title"
                            value={row.title}
                            onChange={(e) => updateRow(row.rowId, { title: e.target.value })}
                            placeholder="Chapter title"
                            className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>

                        {(row.pageRange || isDuplicate) && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pl-0.5">
                            {row.pageRange && (
                              <span className="tabular-nums">Book p. {row.pageRange}</span>
                            )}
                            {row.pageRange && isDuplicate && <span aria-hidden="true">·</span>}
                            {isDuplicate && (
                              <span className="text-amber-700 font-medium">
                                Chapter {row.chapterNumber} already exists in book
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            itemName: row.title.trim()
                              ? `Chapter ${row.chapterNumber}: ${row.title.trim()}`
                              : `Chapter ${row.chapterNumber} row`,
                            description: 'from this extracted list',
                            onConfirm: () => removeRow(row.rowId),
                          })
                        }
                        aria-label={`Delete chapter row ${row.chapterNumber}`}
                        className="mt-1 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddEmptyRow}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                Add Missing Chapter
              </button>
            </>
          )}

          {errorMsg && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            disabled={extracting || saving}
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors whitespace-nowrap"
          >
            Cancel
          </button>

          {!hasExtracted ? (
            <button
              type="button"
              disabled={extracting || compressing || photos.length === 0}
              onClick={handleExtractChapters}
              className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Reading Index...
                </>
              ) : (
                <>
                  <ScanText className="w-4 h-4 shrink-0" />
                  Extract Chapters
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || selectedRows.length === 0}
              onClick={handleCreateChapters}
              className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Creating...
                </>
              ) : (
                <>
                  <ListOrdered className="w-4 h-4 shrink-0" />
                  Create {selectedRows.length} Draft Chapter{selectedRows.length === 1 ? '' : 's'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
