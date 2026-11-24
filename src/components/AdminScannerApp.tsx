import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Edit3,
  FileText,
  ListOrdered,
  Loader2,
  LogOut,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { auth, googleProvider, testConnection } from '../lib/firebase';
import {
  createBook,
  createChapter,
  deleteBookWithContents,
  deleteChapter,
  subscribeToBooks,
  subscribeToChapters,
  updateBook,
} from '../services/firestoreBooks';
import {
  subscribeToBoards,
  subscribeToClasses,
  subscribeToSubjects,
} from '../services/firestoreMasters';
import { subscribeToParents } from '../services/firestoreParents';
import {
  DEFAULT_SUBJECTS,
  type Book,
  type Chapter,
  type MasterBoard,
  type MasterClass,
  type MasterSubject,
  type ParentAccount,
} from '../types/book';
import { BookFormModal } from './BookFormModal';
import { ChapterScanner } from './ChapterScanner';
import { IndexScannerModal } from './IndexScannerModal';
import { MastersPage } from './MastersPage';
import { ParentsPage } from './ParentsPage';

type ActiveSection = 'bookshelf' | 'masters' | 'parents';

export const AdminScannerApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<ActiveSection>('bookshelf');

  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  const [boards, setBoards] = useState<MasterBoard[]>([]);
  const [classes, setClasses] = useState<MasterClass[]>([]);
  const [subjects, setSubjects] = useState<MasterSubject[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [parentsLoading, setParentsLoading] = useState(true);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapterNumber, setNewChapterNumber] = useState<number>(1);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [showIndexScanner, setShowIndexScanner] = useState(false);
  const [indexSuccessMessage, setIndexSuccessMessage] = useState<string | null>(null);

  const [confirmDeleteBookId, setConfirmDeleteBookId] = useState<string | null>(null);
  const [confirmDeleteChapterId, setConfirmDeleteChapterId] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!showAccountMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAccountMenu]);

  useEffect(() => {
    testConnection();
    getRedirectResult(auth).catch((err) => {
      if (err instanceof Error) {
        setAuthError(err.message);
      }
    });
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setBooks([]);
      setBoards([]);
      setClasses([]);
      setSubjects([]);
      setParents([]);
      setBooksLoading(false);
      setMastersLoading(false);
      setParentsLoading(false);
      return;
    }

    setBooksLoading(true);
    setMastersLoading(true);
    setParentsLoading(true);

    const unsubBooks = subscribeToBooks(user.uid, user.email, (loadedBooks) => {
      setBooks(loadedBooks);
      setBooksLoading(false);
    });
    const unsubBoards = subscribeToBoards(user.uid, user.email, (loadedBoards) => {
      setBoards(loadedBoards);
      setMastersLoading(false);
    });
    const unsubClasses = subscribeToClasses(user.uid, user.email, (loadedClasses) => {
      setClasses(loadedClasses);
    });
    const unsubSubjects = subscribeToSubjects(user.uid, user.email, (loadedSubjects) => {
      setSubjects(loadedSubjects);
    });
    const unsubParents = subscribeToParents(user.uid, user.email, (loadedParents) => {
      setParents(loadedParents);
      setParentsLoading(false);
    });

    return () => {
      unsubBooks();
      unsubBoards();
      unsubClasses();
      unsubSubjects();
      unsubParents();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || !selectedBookId) {
      setChapters([]);
      setChaptersLoading(false);
      return;
    }

    setChaptersLoading(true);
    const unsub = subscribeToChapters(selectedBookId, user.uid, user.email, (loadedChapters) => {
      setChapters(loadedChapters);
      setChaptersLoading(false);
    });
    return () => unsub();
  }, [authReady, user, selectedBookId]);

  const selectedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) ?? null,
    [books, selectedBookId]
  );

  const selectedChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );

  const filterSubjects = useMemo(() => {
    const names = new Set<string>();
    const base = subjects.length > 0 ? subjects.map((s) => s.name) : DEFAULT_SUBJECTS.map((s) => s.name);
    for (const s of base) names.add(s);
    for (const b of books) {
      if (b.subject) names.add(b.subject);
    }
    return ['All', ...Array.from(names)];
  }, [subjects, books]);

  const filteredBooks = useMemo(() => {
    if (subjectFilter === 'All') return books;
    return books.filter((b) => b.subject === subjectFilter);
  }, [books, subjectFilter]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Add "${window.location.hostname}" to Firebase Console -> Authentication -> Settings -> Authorized domains to enable Google Sign-In here.`
        );
        return;
      }
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setAuthError(redirectErr instanceof Error ? redirectErr.message : 'Google sign-in failed.');
          return;
        }
      }
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    setShowAccountMenu(false);
    setSelectedBookId(null);
    setSelectedChapterId(null);
    setActiveSection('bookshelf');
    await signOut(auth);
  };

  const goToBookshelf = () => {
    setActiveSection('bookshelf');
    setSelectedChapterId(null);
    setSelectedBookId(null);
  };

  const goToMasters = () => {
    setActiveSection('masters');
    setSelectedChapterId(null);
    setSelectedBookId(null);
  };

  const goToParents = () => {
    setActiveSection('parents');
    setSelectedChapterId(null);
    setSelectedBookId(null);
  };

  const handleOpenAddChapter = () => {
    const nextNum =
      chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1 : 1;
    setNewChapterNumber(nextNum);
    setNewChapterTitle('');
    setShowAddChapter(true);
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBook) return;

    const resolvedTitle = newChapterTitle.trim() || `Chapter ${newChapterNumber}`;
    setCreatingChapter(true);
    try {
      const createdId = await createChapter(selectedBook.id, user.uid, {
        chapterNumber: newChapterNumber,
        title: resolvedTitle,
      });
      setShowAddChapter(false);
      setSelectedChapterId(createdId);
    } finally {
      setCreatingChapter(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones, <= 56px height */}
      <header className="sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <a
            href="#bookshelf"
            onClick={(e) => {
              e.preventDefault();
              goToBookshelf();
            }}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Paathshala Studio
          </a>

          {user && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={goToBookshelf}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === 'bookshelf'
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Bookshelf
              </button>
              <button
                type="button"
                onClick={goToMasters}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === 'masters'
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Masters
              </button>
              <button
                type="button"
                onClick={goToParents}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  activeSection === 'parents'
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Parents
              </button>
            </nav>
          )}

          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAccountMenu((prev) => !prev)}
                  aria-label="Account settings"
                  aria-expanded={showAccountMenu}
                  aria-haspopup="menu"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <Settings className="w-5 h-5 shrink-0" />
                </button>

                {showAccountMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-50 font-sans"
                  >
                    <div className="flex items-center gap-3">
                      {user.photoURL && !avatarFailed ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'Google profile photo'}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-sans text-sm font-semibold flex items-center justify-center shrink-0">
                          {(user.displayName || user.email || 'A').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1 font-sans">
                        <p className="font-sans text-sm font-semibold text-slate-900 truncate">
                          {user.displayName || 'Admin User'}
                        </p>
                        <p className="font-sans text-sm font-normal text-slate-500 truncate">
                          {user.email || ''}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-3" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full min-h-[44px] px-3.5 py-2 font-sans text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Mobile Section Switcher (visible < md when not inside a chapter scanner) */}
        {authReady && user && !selectedChapter && (
          <div className="md:hidden grid grid-cols-3 gap-1 p-1 bg-slate-200/75 rounded-xl mb-5">
            <button
              type="button"
              onClick={goToBookshelf}
              className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'bookshelf'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bookshelf
            </button>
            <button
              type="button"
              onClick={goToMasters}
              className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'masters'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masters
            </button>
            <button
              type="button"
              onClick={goToParents}
              className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeSection === 'parents'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Parents
            </button>
          </div>
        )}

        {!authReady ? (
          <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking session...
          </div>
        ) : !user ? (
          <section className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mt-4 sm:mt-10">
            <p className="text-xs font-medium text-blue-700 mb-2">
              Admin Mode · Class 3 CBSE
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3 text-balance">
              Scan her paper textbooks into your family library
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              Sign in with Google to manage Boards, Classes, and Subjects, snap page photos from your phone, read text with AI, and save chapters and diagram images to Firebase.
            </p>

            {authError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              className="w-full min-h-[48px] px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Sign in with Google
            </button>
          </section>
        ) : activeSection === 'masters' ? (
          <MastersPage
            userId={user.uid}
            boards={boards}
            classes={classes}
            subjects={subjects}
            loading={mastersLoading}
          />
        ) : activeSection === 'parents' ? (
          <ParentsPage
            userId={user.uid}
            parents={parents}
            loading={parentsLoading}
          />
        ) : selectedBook && selectedChapter ? (
          /* Chapter Scanner */
          <ChapterScanner
            book={selectedBook}
            chapter={selectedChapter}
            userId={user.uid}
            userEmail={user.email}
            onBack={() => setSelectedChapterId(null)}
          />
        ) : selectedBook ? (
          /* Book Detail -> Chapters List */
          <div className="pb-20 sm:pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedBookId(null);
                  setIndexSuccessMessage(null);
                }}
                className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                All Books
              </button>

              <div className="hidden sm:flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIndexSuccessMessage(null);
                    setShowIndexScanner(true);
                  }}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <ListOrdered className="w-4 h-4 shrink-0" />
                  Scan Index
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddChapter}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add Chapter
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 mb-1.5 text-balance">
                    {selectedBook.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
                    <span>{selectedBook.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedBook.language === 'hi' ? 'हिन्दी (Hindi)' : 'English'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedBook.board} {selectedBook.grade}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{chapters.length} chapters</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingBook(selectedBook);
                    setShowBookModal(true);
                  }}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  Edit Book
                </button>
              </div>
            </div>

            {showAddChapter && (
              <form
                onSubmit={handleCreateChapter}
                className="bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 mb-6 space-y-4"
              >
                <h2 className="font-display text-base font-semibold text-slate-900">
                  New Chapter
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label htmlFor="new-ch-num" className="block text-xs font-medium text-slate-600 mb-1">
                      Chapter No.
                    </label>
                    <input
                      id="new-ch-num"
                      type="number"
                      min={1}
                      max={500}
                      value={newChapterNumber}
                      onChange={(e) => setNewChapterNumber(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 tabular-nums border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="sm:col-span-9">
                    <label htmlFor="new-ch-title" className="block text-xs font-medium text-slate-600 mb-1">
                      Chapter Name <span className="text-slate-400 font-normal">(optional — auto-reads from page 1)</span>
                    </label>
                    <input
                      id="new-ch-title"
                      type="text"
                      maxLength={160}
                      value={newChapterTitle}
                      onChange={(e) => setNewChapterTitle(e.target.value)}
                      placeholder={
                        selectedBook.language === 'hi'
                          ? 'जैसे: पाठ 1 - सीखो (या खाली छोड़ें)'
                          : 'e.g., Unit 1: Colours (or leave blank)'
                      }
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddChapter(false)}
                    className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingChapter}
                    className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl whitespace-nowrap"
                  >
                    {creatingChapter ? 'Creating...' : 'Create & Open Scanner'}
                  </button>
                </div>
              </form>
            )}

            {indexSuccessMessage && (
              <p className="mb-5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                {indexSuccessMessage}
              </p>
            )}

            {chaptersLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading chapters...
              </div>
            ) : chapters.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h2 className="font-display text-base font-semibold text-slate-900 mb-1">
                  No chapters yet
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto mb-5">
                  Scan the book&apos;s Contents / Index page to create all chapters at once, or add chapters one by one as you scan.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIndexSuccessMessage(null);
                      setShowIndexScanner(true);
                    }}
                    className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ListOrdered className="w-4 h-4" />
                    Scan Index Page
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddChapter}
                    className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Chapter
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedChapterId(ch.id)}
                      className="flex-1 min-w-0 text-left py-1"
                    >
                      <div className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate">
                        {ch.chapterNumber}. {ch.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className={ch.status === 'ready' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                          {ch.status === 'ready' ? 'Ready' : 'Draft'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{ch.pageCount} pages</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{ch.savedImageCount} photos saved</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {confirmDeleteChapterId === ch.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteChapter(selectedBook.id, ch.id);
                              setConfirmDeleteChapterId(null);
                            }}
                            className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteChapterId(null)}
                            className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteChapterId(ch.id)}
                          aria-label={`Delete chapter ${ch.title}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedChapterId(ch.id)}
                        aria-label={`Open scanner for ${ch.title}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile Sticky Scan Index + Add Chapter Bar */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIndexSuccessMessage(null);
                  setShowIndexScanner(true);
                }}
                className="flex-1 min-h-[48px] px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-medium rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <ListOrdered className="w-4 h-4 shrink-0" />
                Scan Index
              </button>
              <button
                type="button"
                onClick={handleOpenAddChapter}
                className="flex-1 min-h-[48px] px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add Chapter
              </button>
            </div>
          </div>
        ) : (
          /* Admin Bookshelf */
          <div className="pb-20 sm:pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">
                  Admin Bookshelf
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                  Textbooks Library
                </h1>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingBook(null);
                  setShowBookModal(true);
                }}
                className="hidden sm:inline-flex min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add Book
              </button>
            </div>

            {/* Dynamic Subject Filter Segmented Bar */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto mb-6 max-w-full">
              {filterSubjects.map((subj) => (
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

            {booksLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading textbooks...
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center">
                <BookOpen className="w-9 h-9 text-slate-400 mx-auto mb-3" />
                <h2 className="font-display text-lg font-semibold text-slate-900 mb-1.5">
                  {books.length === 0 ? 'No textbooks added yet' : `No ${subjectFilter} books yet`}
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
                  Add her English, Hindi, Maths, or EVS textbook to start scanning chapters with your phone camera.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBook(null);
                    setShowBookModal(true);
                  }}
                  className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add First Textbook
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBooks.map((book) => (
                  <article
                    key={book.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedBookId(book.id)}
                      className="text-left w-full mb-4"
                    >
                      <h2 className="font-display text-lg font-semibold text-slate-900 mb-1.5 leading-snug">
                        {book.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{book.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{book.language === 'hi' ? 'हिन्दी' : 'English'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{book.board} {book.grade}</span>
                      </div>
                    </button>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBookId(book.id)}
                        className="min-h-[40px] text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 tabular-nums whitespace-nowrap"
                      >
                        Open ({book.chapterCount} chapters)
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBook(book);
                            setShowBookModal(true);
                          }}
                          aria-label={`Edit ${book.title}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {confirmDeleteBookId === book.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteBookWithContents(book.id);
                                setConfirmDeleteBookId(null);
                              }}
                              className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBookId(null)}
                              className="min-h-[36px] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteBookId(book.id)}
                            aria-label={`Delete ${book.title}`}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Mobile Sticky Add Book CTA */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBook(null);
                  setShowBookModal(true);
                }}
                className="w-full min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Add Textbook
              </button>
            </div>
          </div>
        )}
      </main>

      {showBookModal && user && (
        <BookFormModal
          initialBook={editingBook}
          boards={boards}
          classes={classes}
          subjects={subjects}
          onOpenMasters={goToMasters}
          onClose={() => {
            setShowBookModal(false);
            setEditingBook(null);
          }}
          onSave={async (data) => {
            if (editingBook) {
              await updateBook(editingBook.id, data);
            } else {
              const newId = await createBook(user.uid, data);
              setSelectedBookId(newId);
            }
          }}
        />
      )}

      {showIndexScanner && user && selectedBook && (
        <IndexScannerModal
          book={selectedBook}
          userId={user.uid}
          existingChapters={chapters}
          onClose={() => setShowIndexScanner(false)}
          onCreated={(createdCount) => {
            setShowIndexScanner(false);
            setIndexSuccessMessage(
              `Added ${createdCount} draft chapter${createdCount === 1 ? '' : 's'} from the index page. Tap any chapter below to scan its pages.`
            );
          }}
        />
      )}
    </div>
  );
};
