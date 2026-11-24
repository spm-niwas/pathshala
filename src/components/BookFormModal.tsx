import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  BOOK_LIMITS,
  DEFAULT_BOARDS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  type Book,
  type BookLanguage,
  type MasterBoard,
  type MasterClass,
  type MasterSubject,
  type Subject,
} from '../types/book';

interface BookFormModalProps {
  initialBook?: Book | null;
  boards: MasterBoard[];
  classes: MasterClass[];
  subjects: MasterSubject[];
  onOpenMasters: () => void;
  onClose: () => void;
  onSave: (data: {
    title: string;
    subject: Subject;
    language: BookLanguage;
    board: string;
    grade: string;
  }) => Promise<void>;
}

export const BookFormModal: React.FC<BookFormModalProps> = ({
  initialBook,
  boards,
  classes,
  subjects,
  onOpenMasters,
  onClose,
  onSave,
}) => {
  const boardOptions = useMemo(() => {
    const names = boards.length > 0 ? boards.map((b) => b.name) : DEFAULT_BOARDS;
    if (initialBook?.board && !names.includes(initialBook.board)) {
      return [initialBook.board, ...names];
    }
    return names;
  }, [boards, initialBook?.board]);

  const classOptions = useMemo(() => {
    const names = classes.length > 0 ? classes.map((c) => c.name) : DEFAULT_CLASSES;
    if (initialBook?.grade && !names.includes(initialBook.grade)) {
      return [initialBook.grade, ...names];
    }
    return names;
  }, [classes, initialBook?.grade]);

  const subjectOptions = useMemo(() => {
    const list =
      subjects.length > 0
        ? subjects.map((s) => ({ name: s.name, defaultLanguage: s.defaultLanguage }))
        : DEFAULT_SUBJECTS;
    if (initialBook?.subject && !list.some((s) => s.name === initialBook.subject)) {
      return [{ name: initialBook.subject, defaultLanguage: initialBook.language }, ...list];
    }
    return list;
  }, [subjects, initialBook?.subject, initialBook?.language]);

  const [title, setTitle] = useState(initialBook?.title ?? '');
  const [subject, setSubject] = useState<Subject>(
    initialBook?.subject ?? subjectOptions[0]?.name ?? 'English'
  );
  const [language, setLanguage] = useState<BookLanguage>(
    initialBook?.language ?? subjectOptions[0]?.defaultLanguage ?? 'en'
  );
  const [board, setBoard] = useState(initialBook?.board ?? boardOptions[0] ?? 'CBSE');
  const [grade, setGrade] = useState(initialBook?.grade ?? classOptions[0] ?? 'Class 3');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubjectChange = (nextSubject: string) => {
    setSubject(nextSubject);
    if (!initialBook) {
      const matched = subjectOptions.find((s) => s.name === nextSubject);
      if (matched) {
        setLanguage(matched.defaultLanguage);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a book title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ title, subject, language, board, grade });
      onClose();
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Failed to save book.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed && typeof parsed.error === 'string') {
          msg = parsed.error.includes('permissions')
            ? 'You do not have permission to save books with this account. Please sign in with director@spmniwas.in.'
            : parsed.error;
        }
      } catch {
        // Plain error message
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 id="book-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {initialBook ? 'Edit Textbook' : 'Add Textbook'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="book-title-input" className="block text-sm font-medium text-slate-700 mb-1.5">
              Book Title
            </label>
            <input
              id="book-title-input"
              type="text"
              required
              maxLength={BOOK_LIMITS.titleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Veena (Class 3 Hindi) or Maths Mela"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-subject-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                Subject
              </label>
              <select
                id="book-subject-select"
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {subjectOptions.map((subj) => (
                  <option key={subj.name} value={subj.name}>
                    {subj.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">
                Textbook Language
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl min-h-[44px]">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    language === 'hi'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  हिन्दी (Hindi)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-board-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                Board
              </label>
              <select
                id="book-board-select"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {boardOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="book-grade-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                Class / Grade
              </label>
              <select
                id="book-grade-select"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Need another Board, Class, or Subject?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMasters();
              }}
              className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Manage in Masters
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap"
            >
              {saving ? 'Saving...' : initialBook ? 'Update Book' : 'Save Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
