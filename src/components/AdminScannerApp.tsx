import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Edit3,
  EyeOff,
  FileText,
  Globe,
  ListOrdered,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../lib/firebase';
import {
  createBook,
  createChapter,
  deleteBookWithContents,
  deleteChapter,
  getTimestampMillis,
  publishBook,
  sortBooksByLatestEdited,
  subscribeToBooks,
  subscribeToChapters,
  unpublishBook,
  updateBook,
} from '../services/firestoreBooks';
import { subscribeToChildren } from '../services/firestoreChildren';
import {
  subscribeToBoards,
  subscribeToClasses,
  subscribeToSubjects,
} from '../services/firestoreMasters';
import {
  checkParentAuthorization,
  ensureParentAccessSynced,
  subscribeToParentAccessRecord,
  subscribeToParents,
  subscribeToParentSettings,
} from '../services/firestoreParents';
import {
  DEFAULT_SUBJECTS,
  type Book,
  type Chapter,
  type ChildProfile,
  type MasterBoard,
  type MasterClass,
  type MasterSubject,
  type ParentAccount,
  type ParentSettings,
} from '../types/book';
import { BookCoverGraphic } from './BookCoverGraphic';
import { BookFormModal } from './BookFormModal';
import { ChapterScanner } from './ChapterScanner';
import { ConfirmDeleteDialog, type ConfirmDeleteTarget } from './ConfirmDeleteDialog';
import { FamilyPortalApp } from './FamilyPortalApp';
import { IndexScannerModal } from './IndexScannerModal';
import { MastersPage } from './MastersPage';
import { ParentsPage } from './ParentsPage';

type ActiveSection = 'bookshelf' | 'masters' | 'parents';
type AccountRole = 'none' | 'checking' | 'admin' | 'parent' | 'unauthorized';
type AppMode = 'admin' | 'family';

function formatEditedLabel(updatedAt: unknown, createdAt: unknown): string {
  const millis = Math.max(getTimestampMillis(updatedAt), getTimestampMillis(createdAt));
  if (!millis) return 'Just now';

  const date = new Date(millis);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
}

export const AdminScannerApp: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole>('none');
  const [parentAccessSynced, setParentAccessSynced] = useState(true);
  const [parentDisplayName, setParentDisplayName] = useState('');
  const [appMode, setAppMode] = useState<AppMode>('admin');
  const [familyHomeResetNonce, setFamilyHomeResetNonce] = useState(0);
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

  const [childrenList, setChildrenList] = useState<ChildProfile[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);

  const [parentSettings, setParentSettings] = useState<ParentSettings | null>(null);
  const [parentSettingsLoading, setParentSettingsLoading] = useState(true);

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
  const [publishingBookAction, setPublishingBookAction] = useState<'publish' | 'unpublish' | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ConfirmDeleteTarget | null>(null);
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
      setAccountRole('none');
      setParentAccessSynced(true);
      setParentDisplayName('');
      setAppMode('admin');
      return;
    }

    let cancelled = false;
    const normalizedEmail = (user.email || '').trim().toLowerCase();

    if (normalizedEmail === 'director@spmniwas.in' && user.emailVerified) {
      setAccountRole('admin');
      setParentAccessSynced(true);
      setParentDisplayName(user.displayName || 'Admin');
      setAppMode('admin');
      return;
    }

    if (!user.emailVerified) {
      setAccountRole('unauthorized');
      return;
    }

    setAccountRole('checking');
    getDoc(doc(db, 'admins', user.uid))
      .then(async (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setAccountRole('admin');
          setParentAccessSynced(true);
          setParentDisplayName(user.displayName || 'Admin');
          setAppMode('admin');
          return;
        }

        const parentResult = await checkParentAuthorization(user.email);
        if (cancelled) return;
        if (parentResult.authorized) {
          setAccountRole('parent');
          setParentAccessSynced(parentResult.accessSynced);
          setParentDisplayName(
            parentResult.parentName || user.displayName || user.email || 'Parent'
          );
          setAppMode('family');
        } else {
          setAccountRole('unauthorized');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAccountRole('unauthorized');
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    const canReadCatalog =
      accountRole === 'admin' || (accountRole === 'parent' && parentAccessSynced);

    if (!authReady || !user || !canReadCatalog) {
      setBooks([]);
      setBoards([]);
      setClasses([]);
      setSubjects([]);
      setBooksLoading(false);
      setMastersLoading(false);
      return;
    }

    setBooksLoading(true);
    setMastersLoading(true);

    const unsubBooks = subscribeToBooks(
      user.uid,
      user.email,
      (loadedBooks) => {
        setBooks(loadedBooks);
        setBooksLoading(false);
      },
      true,
      accountRole === 'parent'
    );
    const unsubBoards = subscribeToBoards(
      user.uid,
      user.email,
      (loadedBoards) => {
        setBoards(loadedBoards);
        setMastersLoading(false);
      },
      true
    );
    const unsubClasses = subscribeToClasses(
      user.uid,
      user.email,
      (loadedClasses) => {
        setClasses(loadedClasses);
      },
      true
    );
    const unsubSubjects = subscribeToSubjects(
      user.uid,
      user.email,
      (loadedSubjects) => {
        setSubjects(loadedSubjects);
      },
      true
    );

    return () => {
      unsubBooks();
      unsubBoards();
      unsubClasses();
      unsubSubjects();
    };
  }, [authReady, user, accountRole, parentAccessSynced]);

  useEffect(() => {
    if (!authReady || !user || accountRole !== 'admin') {
      setParents([]);
      setParentsLoading(false);
      return;
    }

    setParentsLoading(true);
    const unsubParents = subscribeToParents(user.uid, user.email, (loadedParents) => {
      setParents(loadedParents);
      setParentsLoading(false);
      void ensureParentAccessSynced(user.uid, loadedParents);
    });

    return () => unsubParents();
  }, [authReady, user, accountRole]);

  useEffect(() => {
    if (
      !authReady ||
      !user ||
      !user.email ||
      (accountRole !== 'admin' && accountRole !== 'parent')
    ) {
      setChildrenList([]);
      setChildrenLoading(false);
      setParentSettings(null);
      setParentSettingsLoading(false);
      return;
    }

    setChildrenLoading(true);
    setParentSettingsLoading(true);

    const unsubChildren = subscribeToChildren(user.email, (loadedChildren) => {
      setChildrenList(loadedChildren);
      setChildrenLoading(false);
    });

    const unsubParentSettings = subscribeToParentSettings(user.uid, (settings) => {
      setParentSettings(settings);
      setParentSettingsLoading(false);
    });

    const unsubParentAccess =
      accountRole === 'parent'
        ? subscribeToParentAccessRecord(user.email, (record) => {
            if (record) {
              setParentDisplayName(record.name);
              setParentAccessSynced(record.accessSynced);
            }
          })
        : () => {};

    return () => {
      unsubChildren();
      unsubParentSettings();
      unsubParentAccess();
    };
  }, [authReady, user, accountRole]);

  useEffect(() => {
    if (
      !authReady ||
      !user ||
      accountRole !== 'admin' ||
      appMode !== 'admin' ||
      !selectedBookId
    ) {
      setChapters([]);
      setChaptersLoading(false);
      return;
    }

    setChaptersLoading(true);
    const unsub = subscribeToChapters(
      selectedBookId,
      user.uid,
      user.email,
      (loadedChapters) => {
        setChapters(loadedChapters);
        setChaptersLoading(false);
      },
      true
    );
    return () => unsub();
  }, [authReady, user, accountRole, appMode, selectedBookId]);

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
    const matching =
      subjectFilter === 'All' ? books : books.filter((b) => b.subject === subjectFilter);
    return sortBooksByLatestEdited(matching);
  }, [books, subjectFilter]);

  const publishedBooks = useMemo(
    () => books.filter((b) => b.publishStatus === 'published'),
    [books]
  );

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

  const handleSwitchAccount = async () => {
    setAuthError(null);
    setShowAccountMenu(false);
    setSelectedBookId(null);
    setSelectedChapterId(null);
    await signOut(auth);
    await handleSignIn();
  };

  const handleReauthenticateWithGoogle = async () => {
    if (!auth.currentUser) {
      throw new Error('Please sign in with Google first.');
    }
    await reauthenticateWithPopup(auth.currentUser, googleProvider);
  };

  const switchMode = (nextMode: AppMode) => {
    if (nextMode === 'admin' && accountRole !== 'admin') return;
    setShowAccountMenu(false);
    setSelectedChapterId(null);
    setSelectedBookId(null);
    setAppMode(nextMode);
    if (nextMode === 'family') {
      setFamilyHomeResetNonce((prev) => prev + 1);
    }
  };

  const goToBookshelf = () => {
    if (accountRole === 'admin') {
      setAppMode('admin');
      setActiveSection('bookshelf');
      setSelectedChapterId(null);
      setSelectedBookId(null);
    } else if (accountRole === 'parent') {
      setAppMode('family');
      setFamilyHomeResetNonce((prev) => prev + 1);
    }
  };

  const goToMasters = () => {
    setAppMode('admin');
    setActiveSection('masters');
    setSelectedChapterId(null);
    setSelectedBookId(null);
  };

  const goToParents = () => {
    setAppMode('admin');
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

  const handlePublishSelectedBook = async () => {
    if (!selectedBook || publishingBookAction) return;
    const isRepublish = selectedBook.publishStatus === 'published';
    setPublishingBookAction('publish');
    try {
      await publishBook(selectedBook.id);
      setIndexSuccessMessage(
        isRepublish
          ? `Republished "${selectedBook.title}". Latest updates are live for parents and children.`
          : `Published "${selectedBook.title}". It is now available to parents and children.`
      );
    } finally {
      setPublishingBookAction(null);
    }
  };

  const handleUnpublishSelectedBook = async () => {
    if (!selectedBook || publishingBookAction) return;
    setPublishingBookAction('unpublish');
    try {
      await unpublishBook(selectedBook.id);
      setIndexSuccessMessage(
        `Moved "${selectedBook.title}" back to Draft. It is hidden from parents until published again.`
      );
    } finally {
      setPublishingBookAction(null);
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

          {user && (accountRole === 'admin' || accountRole === 'parent') && (
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
              {accountRole === 'admin' && (
                <>
                  <button
                    type="button"
                    onClick={goToBookshelf}
                    className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                      appMode === 'admin' && activeSection === 'bookshelf'
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
                      appMode === 'admin' && activeSection === 'masters'
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
                      appMode === 'admin' && activeSection === 'parents'
                        ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Parents
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => switchMode('family')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  appMode === 'family'
                    ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                    : 'hover:text-slate-900'
                }`}
              >
                {accountRole === 'admin' ? 'Family App' : 'Family Home'}
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
                          {parentDisplayName || user.displayName || 'Paathshala User'}
                        </p>
                        <p className="font-sans text-sm font-normal text-slate-500 truncate">
                          {user.email || ''}
                        </p>
                      </div>
                    </div>

                    {(accountRole === 'admin' || accountRole === 'parent') && (
                      <>
                        <div className="border-t border-slate-100 my-3" />
                        <div className="space-y-1">
                          {accountRole === 'admin' && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => switchMode('admin')}
                              className={`w-full min-h-[40px] px-3 py-1.5 font-sans text-sm font-medium rounded-xl transition-colors flex items-center justify-between ${
                                appMode === 'admin'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Shield className="w-4 h-4 shrink-0" />
                                Admin Studio
                              </span>
                              {appMode === 'admin' && <Check className="w-4 h-4 shrink-0" />}
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => switchMode('family')}
                            className={`w-full min-h-[40px] px-3 py-1.5 font-sans text-sm font-medium rounded-xl transition-colors flex items-center justify-between ${
                              appMode === 'family'
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Users className="w-4 h-4 shrink-0" />
                              {accountRole === 'admin' ? 'Family App' : 'Family Home'}
                            </span>
                            {appMode === 'family' && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        </div>
                      </>
                    )}

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
        {/* Mobile Section Switcher for Admin Mode (visible < md when not inside a chapter scanner) */}
        {authReady && user && accountRole === 'admin' && appMode === 'admin' && !selectedChapter && (
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
              Paathshala Studio · Parent, Child &amp; Admin
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3 text-balance">
              School textbooks organized for your family
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
              Sign in with your Google account. Registered parents can add child profiles with 4-digit child login codes and access textbooks made available by Admin.
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
        ) : accountRole === 'checking' ? (
          <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking account permissions...
          </div>
        ) : accountRole === 'unauthorized' ? (
          <section className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mt-4 sm:mt-10">
            <p className="text-xs font-medium text-amber-700 mb-2">
              Registered Account Required
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2 text-balance">
              Signed in as {user.email}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              This Gmail address is not registered as a Parent or Admin yet. Ask the Admin (<strong>director@spmniwas.in</strong>) to add your Gmail under Parents, or switch to a registered Google account.
            </p>

            {authError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                {authError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="flex-1 min-h-[48px] px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                Switch Google Account
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[48px] px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </section>
        ) : appMode === 'family' ? (
          <FamilyPortalApp
            userId={user.uid}
            userEmail={user.email || ''}
            parentName={parentDisplayName || user.displayName || 'Parent'}
            accessSynced={parentAccessSynced}
            parentSettings={parentSettings}
            parentSettingsLoading={parentSettingsLoading}
            childrenList={childrenList}
            childrenLoading={childrenLoading}
            books={publishedBooks}
            booksLoading={booksLoading}
            boards={boards}
            classes={classes}
            homeResetNonce={familyHomeResetNonce}
            onReauthenticateWithGoogle={handleReauthenticateWithGoogle}
          />
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
            onBack={() => {
              setSelectedChapterId(null);
            }}
            onSaved={(savedTitle) => {
              setSelectedChapterId(null);
              setIndexSuccessMessage(`Saved "${savedTitle}" to ${selectedBook.title}.`);
            }}
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

            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 text-balance">
                    {selectedBook.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBook(selectedBook);
                      setShowBookModal(true);
                    }}
                    aria-label={`Edit ${selectedBook.title}`}
                    title="Edit book details"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
                  <span>{selectedBook.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedBook.language === 'hi' ? 'हिन्दी (Hindi)' : 'English'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedBook.board} {selectedBook.grade}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{chapters.length} chapters</span>
                  <span aria-hidden="true">·</span>
                  {selectedBook.publishStatus === 'published' ? (
                    selectedBook.hasUnpublishedChanges ? (
                      <span className="text-amber-700 font-medium">
                        Published · Edited since last publish
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 shrink-0" />
                        Published ({formatEditedLabel(selectedBook.publishedAt, selectedBook.updatedAt)})
                      </span>
                    )
                  ) : (
                    <span className="text-slate-600 font-medium">
                      Draft · Hidden from parents
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {selectedBook.publishStatus === 'published' ? (
                  <>
                    <button
                      type="button"
                      disabled={publishingBookAction !== null}
                      onClick={handlePublishSelectedBook}
                      className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60 ${
                        selectedBook.hasUnpublishedChanges
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {publishingBookAction === 'publish' ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <RefreshCw className="w-4 h-4 shrink-0" />
                      )}
                      {publishingBookAction === 'publish' ? 'Republishing...' : 'Republish Book'}
                    </button>
                    <button
                      type="button"
                      disabled={publishingBookAction !== null}
                      onClick={handleUnpublishSelectedBook}
                      className="min-h-[44px] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <EyeOff className="w-4 h-4 shrink-0" />
                      {publishingBookAction === 'unpublish' ? 'Hiding...' : 'Unpublish'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={publishingBookAction !== null}
                    onClick={handlePublishSelectedBook}
                    className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    {publishingBookAction === 'publish' ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <UploadCloud className="w-4 h-4 shrink-0" />
                    )}
                    {publishingBookAction === 'publish' ? 'Publishing...' : 'Publish Book'}
                  </button>
                )}
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
                      onClick={() => {
                        setIndexSuccessMessage(null);
                        setSelectedChapterId(ch.id);
                      }}
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
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            itemName: `Chapter ${ch.chapterNumber}: ${ch.title}`,
                            description: 'and all of its scanned pages',
                            onConfirm: () => deleteChapter(selectedBook.id, ch.id),
                          })
                        }
                        aria-label={`Delete chapter ${ch.title}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIndexSuccessMessage(null);
                          setSelectedChapterId(ch.id);
                        }}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredBooks.map((book) => {
                  const openBookEditWorkspace = () => {
                    setIndexSuccessMessage(null);
                    setSelectedBookId(book.id);
                  };

                  return (
                    <article
                      key={book.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        openBookEditWorkspace();
                      }}
                      className="group cursor-pointer bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-blue-400 hover:shadow-sm transition-all"
                    >
                      <button
                        type="button"
                        onClick={openBookEditWorkspace}
                        className="text-left w-full flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                      >
                        <BookCoverGraphic
                          subject={book.subject}
                          title={book.title}
                          topLabel={book.board}
                        />

                        <div className="p-3 sm:p-3.5 w-full flex-1 flex flex-col justify-between">
                          <div>
                            <h2 className="font-display text-sm sm:text-[15px] font-semibold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug line-clamp-2">
                              {book.title}
                            </h2>
                            <p className="mt-1.5 text-xs text-slate-600 truncate">
                              {book.grade}
                              <span aria-hidden="true" className="mx-1 text-slate-300">
                                ·
                              </span>
                              {book.subject}
                            </p>
                          </div>

                          <p className="mt-2 text-[11px] text-slate-400 tabular-nums truncate">
                            {book.chapterCount} {book.chapterCount === 1 ? 'ch' : 'chs'}
                            <span aria-hidden="true" className="mx-1 text-slate-300">
                              ·
                            </span>
                            {book.publishStatus === 'published' ? (
                              book.hasUnpublishedChanges ? (
                                <span className="text-amber-600 font-medium">Edited</span>
                              ) : (
                                <span className="text-emerald-700 font-medium">Published</span>
                              )
                            ) : (
                              <span className="text-slate-500">Draft</span>
                            )}
                            <span aria-hidden="true" className="mx-1 text-slate-300">
                              ·
                            </span>
                            {formatEditedLabel(book.updatedAt, book.createdAt)}
                          </p>
                        </div>
                      </button>

                      <div className="px-2.5 sm:px-3 py-1 border-t border-slate-100 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={openBookEditWorkspace}
                          className="min-h-[40px] px-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-0.5 whitespace-nowrap"
                        >
                          Edit
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </button>

                        <div className="flex items-center shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBook(book);
                              setShowBookModal(true);
                            }}
                            aria-label={`Edit details for ${book.title}`}
                            title="Edit book details"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                itemName: book.title,
                                description: 'and all of its chapters and scanned pages',
                                onConfirm: () => deleteBookWithContents(book.id),
                              });
                            }}
                            aria-label={`Delete ${book.title}`}
                            title="Delete book"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
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

      <ConfirmDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
