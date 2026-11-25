import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { sortBooksByLatestEdited } from '../services/firestoreBooks';
import { verifyChildLoginCode } from '../services/firestoreChildren';
import {
  saveParentPasspin,
  verifyParentPasspin,
} from '../services/firestoreParents';
import { isValidFourDigitCode } from '../services/passcodeCrypto';
import {
  CHILD_AVATAR_COLORS,
  type Book,
  type ChildProfile,
  type MasterBoard,
  type MasterClass,
  type ParentSettings,
} from '../types/book';
import { BookCoverGraphic } from './BookCoverGraphic';
import { BookReaderView } from './BookReaderView';
import { ParentDashboard } from './ParentDashboard';

interface FamilyPortalAppProps {
  userId: string;
  userEmail: string;
  parentName: string;
  accessSynced: boolean;
  parentSettings: ParentSettings | null;
  parentSettingsLoading: boolean;
  childrenList: ChildProfile[];
  childrenLoading: boolean;
  books: Book[];
  booksLoading: boolean;
  boards: MasterBoard[];
  classes: MasterClass[];
  homeResetNonce: number;
  onReauthenticateWithGoogle: () => Promise<void>;
}

type PortalRoute =
  | { view: 'home' }
  | { view: 'setupPasspin'; mode: 'create' | 'reset'; returnTo: 'home' | 'parent' }
  | { view: 'parentPinPrompt' }
  | { view: 'parentWorkspace' }
  | { view: 'childPinPrompt'; childId: string }
  | { view: 'childUnlocked'; childId: string };

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

export const FamilyPortalApp: React.FC<FamilyPortalAppProps> = ({
  userId,
  userEmail,
  parentName,
  accessSynced,
  parentSettings,
  parentSettingsLoading,
  childrenList,
  childrenLoading,
  books,
  booksLoading,
  boards,
  classes,
  homeResetNonce,
  onReauthenticateWithGoogle,
}) => {
  const [route, setRoute] = useState<PortalRoute>({ view: 'home' });

  // Keypad state shared for parent & child 4-digit entry
  const [codeDigits, setCodeDigits] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [reauthing, setReauthing] = useState(false);

  // Setup / Change Parent Passpin form state
  const [newPasspin, setNewPasspin] = useState('');
  const [confirmPasspin, setConfirmPasspin] = useState('');
  const [showPasspin, setShowPasspin] = useState(false);
  const [savingPasspin, setSavingPasspin] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Child bookshelf state
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [readingBookId, setReadingBookId] = useState<string | null>(null);

  useEffect(() => {
    if (homeResetNonce > 0) {
      setRoute({ view: 'home' });
      setCodeDigits('');
      setPinError(null);
      setReadingBookId(null);
      setSubjectFilter('All');
    }
  }, [homeResetNonce]);

  useEffect(() => {
    if (
      (route.view === 'childPinPrompt' || route.view === 'childUnlocked') &&
      !childrenList.some((c) => c.id === route.childId)
    ) {
      setRoute({ view: 'home' });
      setCodeDigits('');
      setPinError(null);
      setReadingBookId(null);
    }
  }, [childrenList, route]);

  const activeChild = useMemo(() => {
    if (route.view !== 'childPinPrompt' && route.view !== 'childUnlocked') {
      return null;
    }
    return childrenList.find((c) => c.id === route.childId) ?? null;
  }, [childrenList, route]);

  const childBooks = useMemo(() => {
    if (!activeChild) return [];
    return sortBooksByLatestEdited(
      books.filter((book) => doesBookMatchChild(book, activeChild))
    );
  }, [books, activeChild]);

  const availableSubjects = useMemo(() => {
    const names = new Set<string>();
    for (const b of childBooks) {
      if (b.subject) names.add(b.subject);
    }
    return ['All', ...Array.from(names)];
  }, [childBooks]);

  const filteredChildBooks = useMemo(() => {
    if (subjectFilter === 'All') return childBooks;
    return childBooks.filter((b) => b.subject === subjectFilter);
  }, [childBooks, subjectFilter]);

  const readingBook = useMemo(
    () => books.find((b) => b.id === readingBookId) ?? null,
    [books, readingBookId]
  );

  const goHome = useCallback(() => {
    setRoute({ view: 'home' });
    setCodeDigits('');
    setPinError(null);
    setSetupError(null);
    setReadingBookId(null);
    setSubjectFilter('All');
  }, []);

  const submitKeypadCode = useCallback(
    async (enteredCode: string) => {
      setVerifying(true);
      setPinError(null);
      try {
        if (route.view === 'parentPinPrompt') {
          const ok = await verifyParentPasspin(parentSettings, enteredCode);
          if (ok) {
            setRoute({ view: 'parentWorkspace' });
            setCodeDigits('');
          } else {
            setPinError('Incorrect 4-digit Parent Passpin. Please try again.');
            setCodeDigits('');
          }
          return;
        }

        if (route.view === 'childPinPrompt' && activeChild) {
          const matchesChild = await verifyChildLoginCode(activeChild, enteredCode);
          const matchesParent = !matchesChild
            ? await verifyParentPasspin(parentSettings, enteredCode)
            : false;

          if (matchesChild || matchesParent) {
            setRoute({ view: 'childUnlocked', childId: activeChild.id });
            setCodeDigits('');
            setSubjectFilter('All');
            setReadingBookId(null);
          } else {
            setPinError('Incorrect 4-digit code. Please try again.');
            setCodeDigits('');
          }
        }
      } catch {
        setPinError('Could not verify code right now. Please try again.');
        setCodeDigits('');
      } finally {
        setVerifying(false);
      }
    },
    [route, activeChild, parentSettings]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (route.view !== 'parentPinPrompt' && route.view !== 'childPinPrompt') return;
      if (verifying || codeDigits.length >= 4) return;
      const next = `${codeDigits}${digit}`;
      setPinError(null);
      setCodeDigits(next);
      if (next.length === 4) {
        void submitKeypadCode(next);
      }
    },
    [route.view, verifying, codeDigits, submitKeypadCode]
  );

  const handleBackspace = useCallback(() => {
    if (verifying) return;
    setPinError(null);
    setCodeDigits((prev) => prev.slice(0, -1));
  }, [verifying]);

  const handleClear = useCallback(() => {
    if (verifying) return;
    setPinError(null);
    setCodeDigits('');
  }, [verifying]);

  useEffect(() => {
    if (route.view !== 'parentPinPrompt' && route.view !== 'childPinPrompt') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        handleDigitPress(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        goHome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [route.view, handleDigitPress, handleBackspace, goHome]);

  const handleOpenParentProfile = () => {
    if (parentSettingsLoading) return;
    setCodeDigits('');
    setPinError(null);
    setSetupError(null);
    if (!parentSettings) {
      setNewPasspin('');
      setConfirmPasspin('');
      setShowPasspin(false);
      setRoute({ view: 'setupPasspin', mode: 'create', returnTo: 'parent' });
    } else {
      setRoute({ view: 'parentPinPrompt' });
    }
  };

  const handleSavePasspinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (route.view !== 'setupPasspin') return;

    const pin = newPasspin.trim();
    const confirm = confirmPasspin.trim();
    if (!isValidFourDigitCode(pin)) {
      setSetupError('Please enter a 4-digit numeric passpin (0-9).');
      return;
    }
    if (pin !== confirm) {
      setSetupError('Both 4-digit passpins must match.');
      return;
    }

    setSavingPasspin(true);
    setSetupError(null);
    try {
      await saveParentPasspin(userId, userEmail, pin);
      setNewPasspin('');
      setConfirmPasspin('');
      setRoute({ view: 'parentWorkspace' });
    } catch (err) {
      setSetupError(
        err instanceof Error ? err.message : 'Could not save Parent Passpin.'
      );
    } finally {
      setSavingPasspin(false);
    }
  };

  const handleForgotPasspin = async () => {
    setReauthing(true);
    setPinError(null);
    try {
      await onReauthenticateWithGoogle();
      setNewPasspin('');
      setConfirmPasspin('');
      setShowPasspin(false);
      setSetupError(null);
      setRoute({ view: 'setupPasspin', mode: 'reset', returnTo: 'home' });
    } catch (err) {
      setPinError(
        err instanceof Error
          ? err.message
          : 'Google verification was cancelled or failed.'
      );
    } finally {
      setReauthing(false);
    }
  };

  // 1. Unlocked Child App View
  if (route.view === 'childUnlocked' && activeChild) {
    if (readingBook) {
      return (
        <BookReaderView
          book={readingBook}
          userId={userId}
          userEmail={userEmail}
          backLabel="My Books"
          onBack={() => setReadingBookId(null)}
        />
      );
    }

    const colorStyle = getAvatarColorStyle(activeChild.avatarColor);

    return (
      <div className="pb-12 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${colorStyle.bgClass} text-white font-display text-xl font-bold flex items-center justify-center shrink-0`}
            >
              {activeChild.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-700">
                Child Profile
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 truncate">
                Hi, {activeChild.name}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {activeChild.board} · {activeChild.grade}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={goHome}
            className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-medium rounded-xl inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Lock className="w-4 h-4 shrink-0" />
            Switch Profile
          </button>
        </div>

        {availableSubjects.length > 2 && (
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-full">
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
            Loading your books...
          </div>
        ) : filteredChildBooks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <BookOpen className="w-9 h-9 text-slate-400 mx-auto mb-3" />
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-1.5">
              No books added for {activeChild.board} {activeChild.grade} yet
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Ask your parent or teacher to add books for your board and class.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {filteredChildBooks.map((book) => (
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

                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="text-slate-400 tabular-nums">
                        {book.chapterCount} {book.chapterCount === 1 ? 'ch' : 'chs'}
                      </span>
                      <span className="font-semibold text-blue-600 group-hover:text-blue-700 inline-flex items-center gap-0.5">
                        Open
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </span>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 2. Parent Workspace (after Parent Passpin verification)
  if (route.view === 'parentWorkspace') {
    return (
      <ParentDashboard
        userId={userId}
        userEmail={userEmail}
        parentName={parentName}
        accessSynced={accessSynced}
        childrenList={childrenList}
        childrenLoading={childrenLoading}
        books={books}
        booksLoading={booksLoading}
        boards={boards}
        classes={classes}
        onLockToFamilyHome={goHome}
        onChangePasspin={() => {
          setNewPasspin('');
          setConfirmPasspin('');
          setShowPasspin(false);
          setSetupError(null);
          setRoute({ view: 'setupPasspin', mode: 'reset', returnTo: 'parent' });
        }}
        onOpenChildView={(childId) => {
          setSubjectFilter('All');
          setReadingBookId(null);
          setRoute({ view: 'childUnlocked', childId });
        }}
      />
    );
  }

  // 3. Create or Change 4-Digit Parent Passpin
  if (route.view === 'setupPasspin') {
    const isCreate = route.mode === 'create';
    return (
      <div className="pb-12">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => {
              if (route.returnTo === 'parent' && parentSettings) {
                setRoute({ view: 'parentWorkspace' });
              } else {
                goHome();
              }
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {route.returnTo === 'parent' && parentSettings
              ? 'Back to Parent Mode'
              : 'All Profiles'}
          </button>
        </div>

        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6" />
          </div>

          <h1 className="font-display text-xl font-bold text-slate-900 text-center">
            {isCreate ? 'Create Parent Passpin' : 'Change Parent Passpin'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 text-center mt-1.5 mb-6 leading-relaxed">
            {parentName}, set a 4-digit passpin. It protects Parent Mode on this shared phone and lets you open any child&apos;s app anytime.
          </p>

          <form onSubmit={handleSavePasspinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="parent-passpin-new"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                4-Digit Passpin
              </label>
              <div className="relative">
                <input
                  id="parent-passpin-new"
                  type={showPasspin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                  value={newPasspin}
                  onChange={(e) =>
                    setNewPasspin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  className="w-full min-h-[44px] pl-3.5 pr-12 py-2.5 text-sm tracking-[0.35em] font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPasspin((prev) => !prev)}
                  aria-label={showPasspin ? 'Hide passpin' : 'Show passpin'}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 absolute right-0 top-0"
                >
                  {showPasspin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="parent-passpin-confirm"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Confirm 4-Digit Passpin
              </label>
              <input
                id="parent-passpin-confirm"
                type={showPasspin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                required
                value={confirmPasspin}
                onChange={(e) =>
                  setConfirmPasspin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm tracking-[0.35em] font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {setupError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {setupError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingPasspin}
              className="w-full min-h-[48px] px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {savingPasspin ? 'Saving...' : 'Save Passpin & Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 4. 4-Digit Keypad Screen (for Parent Passpin OR Child Code + Parent Passpin)
  if (
    route.view === 'parentPinPrompt' ||
    (route.view === 'childPinPrompt' && activeChild)
  ) {
    const isParentPrompt = route.view === 'parentPinPrompt';
    const childColorStyle = activeChild
      ? getAvatarColorStyle(activeChild.avatarColor)
      : null;

    return (
      <div className="pb-12">
        <div className="mb-6">
          <button
            type="button"
            onClick={goHome}
            className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 -ml-3 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            All Profiles
          </button>
        </div>

        <div className="max-w-sm mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center">
          {isParentPrompt ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-display text-2xl font-bold flex items-center justify-center mx-auto mb-3">
                {parentName.charAt(0).toUpperCase()}
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                {parentName}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 mb-5">
                Parent Account
              </p>
              <p className="text-sm font-medium text-slate-700 mb-4 flex items-center justify-center gap-1.5">
                <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                Enter your 4-digit Parent Passpin
              </p>
            </>
          ) : (
            activeChild &&
            childColorStyle && (
              <>
                <div
                  className={`w-16 h-16 rounded-2xl ${childColorStyle.bgClass} text-white font-display text-2xl font-bold flex items-center justify-center mx-auto mb-3`}
                >
                  {activeChild.name.charAt(0).toUpperCase()}
                </div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  {activeChild.name}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  {activeChild.board} · {activeChild.grade}
                </p>
                <p className="text-sm font-medium text-slate-700 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  Enter your 4-digit login code
                </p>
                {parentSettings && (
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Parent can also enter her 4-digit Passpin
                  </p>
                )}
                {!parentSettings && <div className="mb-4" />}
              </>
            )
          )}

          {/* 4 Code Dots */}
          <div
            className="flex items-center justify-center gap-3.5 mb-5"
            aria-live="polite"
            aria-label={`${codeDigits.length} of 4 digits entered`}
          >
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < codeDigits.length;
              return (
                <div
                  key={idx}
                  className={`w-11 h-12 rounded-xl border flex items-center justify-center transition-all ${
                    filled
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full transition-transform ${
                      filled ? 'bg-blue-600 scale-100' : 'bg-slate-300 scale-75'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {pinError && (
            <p className="text-xs sm:text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2 mb-4">
              {pinError}
            </p>
          )}

          {verifying ? (
            <div className="py-12 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking code...
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigitPress(digit)}
                  className="min-h-[56px] rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-display text-xl font-semibold tabular-nums transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="min-h-[56px] rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDigitPress('0')}
                className="min-h-[56px] rounded-2xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-display text-xl font-semibold tabular-nums transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="Delete last digit"
                className="min-h-[56px] rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          )}

          {isParentPrompt && (
            <button
              type="button"
              disabled={reauthing}
              onClick={handleForgotPasspin}
              className="mt-5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {reauthing
                ? 'Verifying Google account...'
                : 'Forgot passpin? Verify with Google to reset'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. Unified Family Home Screen (Parent + Children names popup together)
  return (
    <div className="pb-12">
      {!accessSynced && (
        <div className="max-w-4xl mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          Your parent account is verified, and shared textbook permissions are finishing sync. Ask the school Admin (<strong>director@spmniwas.in</strong>) to open Paathshala Studio once if books do not appear yet.
        </div>
      )}

      <div className="text-center max-w-xl mx-auto mb-8">
        <p className="text-xs font-medium text-blue-700 mb-1.5">
          Family Profiles
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Who is learning today?
        </h1>
        <p className="text-sm text-slate-600 mt-1.5">
          Tap your name to enter with your 4-digit code.
        </p>
      </div>

      {childrenLoading || parentSettingsLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading family profiles...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {/* Parent Card (Name from Admin -> Add Parent) */}
          <button
            type="button"
            onClick={handleOpenParentProfile}
            className="group bg-white border border-slate-200 hover:border-slate-900 hover:shadow-sm rounded-2xl p-6 text-center flex flex-col items-center transition-all"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-display text-2xl font-bold flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              {parentName.charAt(0).toUpperCase()}
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {parentName}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Parent · Manage children &amp; books
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              {parentSettings ? (
                <>
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  Enter Parent Passpin
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  Set 4-digit Passpin
                </>
              )}
            </span>
          </button>

          {/* Child Cards (Created by Parent inside Parent Mode) */}
          {childrenList.map((child) => {
            const colorStyle = getAvatarColorStyle(child.avatarColor);
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => {
                  setCodeDigits('');
                  setPinError(null);
                  setRoute({ view: 'childPinPrompt', childId: child.id });
                }}
                className="group bg-white border border-slate-200 hover:border-blue-500 hover:shadow-sm rounded-2xl p-6 text-center flex flex-col items-center transition-all"
              >
                <div
                  className={`w-16 h-16 rounded-2xl ${colorStyle.bgClass} text-white font-display text-2xl font-bold flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}
                >
                  {child.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {child.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {child.board} · {child.grade}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Enter 4-digit code
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!childrenLoading && childrenList.length === 0 && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-6 max-w-md mx-auto">
          No children added yet. Tap <strong>{parentName}</strong> above to add your children and their 4-digit login codes.
        </p>
      )}
    </div>
  );
};
