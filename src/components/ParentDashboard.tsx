import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Edit3,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { sortBooksByLatestEdited } from '../services/firestoreBooks';
import { createChild, deleteChild, updateChild } from '../services/firestoreChildren';
import {
  CHILD_AVATAR_COLORS,
  type Book,
  type ChildProfile,
  type MasterBoard,
  type MasterClass,
} from '../types/book';
import { BookCoverGraphic } from './BookCoverGraphic';
import { BookReaderView } from './BookReaderView';
import { ChildFormModal } from './ChildFormModal';
import { ConfirmDeleteDialog, type ConfirmDeleteTarget } from './ConfirmDeleteDialog';

interface ParentDashboardProps {
  userId: string;
  userEmail: string;
  parentName: string;
  accessSynced: boolean;
  childrenList: ChildProfile[];
  childrenLoading: boolean;
  books: Book[];
  booksLoading: boolean;
  boards: MasterBoard[];
  classes: MasterClass[];
  onLockToFamilyHome: () => void;
  onChangePasspin: () => void;
  onOpenChildView: (childId: string) => void;
}

function getAvatarColorStyle(colorId: ChildProfile['avatarColor']) {
  return (
    CHILD_AVATAR_COLORS.find((c) => c.id === colorId) ?? CHILD_AVATAR_COLORS[0]
  );
}

function doesBookMatchChild(book: Book, child: ChildProfile): boolean {
  return (
    book.board.trim().toLowerCase() === child.board.trim().toLowerCase() &&
    book.grade.trim().toLowerCase() === child.grade.trim().toLowerCase()
  );
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  userId,
  userEmail,
  parentName,
  accessSynced,
  childrenList,
  childrenLoading,
  books,
  booksLoading,
  boards,
  classes,
  onLockToFamilyHome,
  onChangePasspin,
  onOpenChildView,
}) => {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [readingBookId, setReadingBookId] = useState<string | null>(null);

  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfirmDeleteTarget | null>(null);

  useEffect(() => {
    if (childrenList.length === 0) {
      setSelectedChildId(null);
      return;
    }
    if (!selectedChildId || !childrenList.some((c) => c.id === selectedChildId)) {
      setSelectedChildId(childrenList[0].id);
    }
  }, [childrenList, selectedChildId]);

  useEffect(() => {
    setSubjectFilter('All');
    setReadingBookId(null);
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => childrenList.find((c) => c.id === selectedChildId) ?? null,
    [childrenList, selectedChildId]
  );

  const booksByChildId = useMemo(() => {
    const map = new Map<string, Book[]>();
    for (const child of childrenList) {
      const matching = sortBooksByLatestEdited(
        books.filter((book) => doesBookMatchChild(book, child))
      );
      map.set(child.id, matching);
    }
    return map;
  }, [childrenList, books]);

  const selectedChildBooks = useMemo(() => {
    if (!selectedChild) return [];
    return booksByChildId.get(selectedChild.id) ?? [];
  }, [selectedChild, booksByChildId]);

  const availableSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const b of selectedChildBooks) {
      if (b.subject) names.add(b.subject);
    }
    return ['All', ...Array.from(names)];
  }, [selectedChildBooks]);

  const filteredBooks = useMemo(() => {
    if (subjectFilter === 'All') return selectedChildBooks;
    return selectedChildBooks.filter((b) => b.subject === subjectFilter);
  }, [selectedChildBooks, subjectFilter]);

  const readingBook = useMemo(
    () => books.find((b) => b.id === readingBookId) ?? null,
    [books, readingBookId]
  );

  if (readingBook && selectedChild) {
    return (
      <BookReaderView
        book={readingBook}
        userId={userId}
        userEmail={userEmail}
        backLabel={`Back to ${selectedChild.name}'s Books`}
        onBack={() => setReadingBookId(null)}
      />
    );
  }

  return (
    <div className="pb-20 sm:pb-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-blue-700 mb-1">
            Parent Mode · {parentName}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
            Children &amp; Textbooks
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onChangePasspin}
            className="min-h-[44px] px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4 shrink-0" />
            Passpin
          </button>
          <button
            type="button"
            onClick={onLockToFamilyHome}
            className="min-h-[44px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Lock className="w-4 h-4 shrink-0" />
            Family Home
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingChild(null);
              setShowChildModal(true);
            }}
            className="hidden sm:inline-flex min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Child
          </button>
        </div>
      </div>

      {!accessSynced && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Your parent account is verified, and shared textbook permissions are finishing sync. Ask the school Admin (<strong>director@spmniwas.in</strong>) to open Paathshala Studio once if books do not appear yet.
        </div>
      )}

      {/* Children Section */}
      <section aria-labelledby="children-heading">
        <div className="flex items-center justify-between gap-4 mb-3.5">
          <h2 id="children-heading" className="font-display text-base sm:text-lg font-semibold text-slate-900">
            Your Children ({childrenList.length})
          </h2>
          {selectedChild && (
            <button
              type="button"
              onClick={() => onOpenChildView(selectedChild.id)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Open {selectedChild.name}&apos;s View
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}
        </div>

        {childrenLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500 gap-2 bg-white border border-slate-200 rounded-2xl">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading child profiles...
          </div>
        ) : childrenList.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center">
            <Users className="w-9 h-9 text-slate-400 mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold text-slate-900 mb-1.5">
              Add your first child profile
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
              Add each child with their Name, Board, Class, and a 4-digit login code. We&apos;ll automatically show every textbook added by Admin for their board and class.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingChild(null);
                setShowChildModal(true);
              }}
              className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add First Child
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {childrenList.map((child) => {
              const colorStyle = getAvatarColorStyle(child.avatarColor);
              const isSelected = child.id === selectedChild?.id;
              const matchCount = (booksByChildId.get(child.id) ?? []).length;

              return (
                <article
                  key={child.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    setSelectedChildId(child.id);
                  }}
                  className={`cursor-pointer bg-white rounded-2xl p-4 transition-all border ${
                    isSelected
                      ? 'border-blue-600 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedChildId(child.id)}
                      className="flex items-center gap-3.5 min-w-0 flex-1 text-left focus:outline-none"
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl ${colorStyle.bgClass} text-white font-display text-lg font-bold flex items-center justify-center shrink-0`}
                      >
                        {child.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                            {child.name}
                          </h3>
                          {isSelected && (
                            <UserCheck className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {child.board}
                          <span aria-hidden="true" className="mx-1.5 text-slate-300">
                            ·
                          </span>
                          {child.grade}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 tabular-nums">
                          {matchCount} {matchCount === 1 ? 'book' : 'books'} available
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center shrink-0 -mr-1 -mt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingChild(child);
                          setShowChildModal(true);
                        }}
                        aria-label={`Edit ${child.name}`}
                        title="Edit child profile or reset 4-digit code"
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({
                            itemName: child.name,
                            description: 'and their child app profile',
                            onConfirm: () => deleteChild(child.id),
                          });
                        }}
                        aria-label={`Delete ${child.name}`}
                        title="Delete child profile"
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Books Available for Selected Child */}
      {selectedChild && (
        <section aria-labelledby="child-books-heading" className="pt-2">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2
                id="child-books-heading"
                className="font-display text-lg sm:text-xl font-bold text-slate-900"
              >
                Books for {selectedChild.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {selectedChild.board} · {selectedChild.grade} · {selectedChildBooks.length}{' '}
                {selectedChildBooks.length === 1 ? 'textbook' : 'textbooks'} made available by Admin
              </p>
            </div>
          </div>

          {availableSubjects.length > 2 && (
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto mb-5 max-w-full">
              {availableSubjects.map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSubjectFilter(subj)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    subjectFilter === subj
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {subj}
                </button>
              ))}
            </div>
          )}

          {booksLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading textbooks...
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
                No textbooks available for {selectedChild.board} {selectedChild.grade} yet
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                When Admin adds books for {selectedChild.board} {selectedChild.grade}, they will show up here and in {selectedChild.name}&apos;s profile automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredBooks.map((book) => (
                <article
                  key={book.id}
                  className="group bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setReadingBookId(book.id)}
                    className="text-left w-full flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  >
                    <BookCoverGraphic
                      subject={book.subject}
                      title={book.title}
                      topLabel={book.board}
                    />

                    <div className="p-3 sm:p-3.5 w-full flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-display text-sm sm:text-[15px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="mt-1.5 text-xs text-slate-600 truncate">
                          {book.grade}
                          <span aria-hidden="true" className="mx-1 text-slate-300">
                            ·
                          </span>
                          {book.subject}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 tabular-nums">
                          {book.chapterCount} {book.chapterCount === 1 ? 'ch' : 'chs'}
                        </span>
                        <span className="font-semibold text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-0.5">
                          Read
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </span>
                      </div>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Mobile Sticky Add Child Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2">
        <button
          type="button"
          onClick={() => {
            setEditingChild(null);
            setShowChildModal(true);
          }}
          className="w-full min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Add Child
        </button>
      </div>

      {showChildModal && (
        <ChildFormModal
          initialChild={editingChild}
          boards={boards}
          classes={classes}
          onClose={() => {
            setShowChildModal(false);
            setEditingChild(null);
          }}
          onSave={async (data) => {
            if (editingChild) {
              await updateChild(editingChild.id, data, editingChild);
            } else {
              const newId = await createChild(userId, userEmail, data);
              setSelectedChildId(newId);
            }
          }}
        />
      )}

      <ConfirmDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
