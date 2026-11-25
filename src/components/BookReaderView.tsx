import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import {
  subscribeToChapterPages,
  subscribeToChapters,
} from '../services/firestoreBooks';
import type { Book, Chapter, ScannedPageRecord } from '../types/book';

interface BookReaderViewProps {
  book: Book;
  userId: string;
  userEmail: string | null | undefined;
  backLabel: string;
  onBack: () => void;
}

export const BookReaderView: React.FC<BookReaderViewProps> = ({
  book,
  userId,
  userEmail,
  backLabel,
  onBack,
}) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [pages, setPages] = useState<ScannedPageRecord[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    setChaptersLoading(true);
    setSelectedChapterId(null);
    const unsub = subscribeToChapters(
      book.id,
      userId,
      userEmail,
      (loaded) => {
        setChapters(loaded);
        setChaptersLoading(false);
      },
      true
    );
    return () => unsub();
  }, [book.id, userId, userEmail]);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  useEffect(() => {
    if (!selectedChapterId) {
      setPages([]);
      setPagesLoading(false);
      return;
    }
    setPagesLoading(true);
    const unsub = subscribeToChapterPages(
      book.id,
      selectedChapterId,
      userId,
      userEmail,
      (loaded) => {
        setPages(loaded);
        setPagesLoading(false);
      },
      true
    );
    return () => unsub();
  }, [book.id, selectedChapterId, userId, userEmail]);

  const savedImages = pages.filter((p) => p.keepImage && p.imageDataUrl);

  if (selectedChapter) {
    return (
      <div className="pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={() => setSelectedChapterId(null)}
            className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to {book.title}
          </button>

          <span className="text-xs text-slate-500 tabular-nums">
            {book.board} · {book.grade} · {book.subject}
          </span>
        </div>

        <article className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-6">
          <header className="border-b border-slate-100 pb-4">
            <p className="text-xs font-medium text-blue-700 mb-1 tabular-nums">
              Chapter {selectedChapter.chapterNumber}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 text-balance">
              {selectedChapter.title}
            </h1>
          </header>

          {selectedChapter.combinedText.trim() ? (
            <div className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
              {selectedChapter.combinedText}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-4">
              No text has been added to this chapter yet.
            </p>
          )}

          {pagesLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading chapter pictures...
            </div>
          ) : (
            savedImages.length > 0 && (
              <section className="pt-4 border-t border-slate-100">
                <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">
                  Textbook Pictures &amp; Diagrams ({savedImages.length})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {savedImages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setExpandedImage(page.imageDataUrl)}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 text-left hover:border-blue-300 transition-colors"
                    >
                      <div className="aspect-[3/4] bg-white">
                        <img
                          src={page.imageDataUrl}
                          alt={`Chapter ${selectedChapter.chapterNumber} page ${page.pageNumber}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-2.5 py-2 text-xs font-medium text-slate-700 tabular-nums">
                        Page {page.pageNumber}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )
          )}
        </article>

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
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {backLabel}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 mb-1.5 text-balance">
          {book.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
          <span>{book.subject}</span>
          <span aria-hidden="true">·</span>
          <span>{book.board}</span>
          <span aria-hidden="true">·</span>
          <span>{book.grade}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{chapters.length} chapters</span>
        </div>
      </div>

      {chaptersLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading chapters...
        </div>
      ) : chapters.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <h2 className="font-display text-base font-semibold text-slate-900 mb-1">
            No chapters available yet
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Chapters scanned and saved by the Admin will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {chapters.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setSelectedChapterId(ch.id)}
              className="w-full p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {ch.chapterNumber}. {ch.title}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 tabular-nums">
                  <span>{ch.pageCount} pages</span>
                  {ch.savedImageCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ch.savedImageCount} pictures</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
