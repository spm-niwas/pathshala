import React, { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import {
  CHILD_AVATAR_COLORS,
  CHILD_LIMITS,
  DEFAULT_BOARDS,
  DEFAULT_CLASSES,
  type ChildAvatarColor,
  type ChildProfile,
  type MasterBoard,
  type MasterClass,
} from '../types/book';
import { isValidFourDigitCode } from '../services/firestoreChildren';
import { formatTitleCaseInput } from '../services/firestoreParents';

interface ChildFormModalProps {
  initialChild?: ChildProfile | null;
  boards: MasterBoard[];
  classes: MasterClass[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    board: string;
    grade: string;
    avatarColor: ChildAvatarColor;
    loginCode: string;
  }) => Promise<void>;
}

export const ChildFormModal: React.FC<ChildFormModalProps> = ({
  initialChild,
  boards,
  classes,
  onClose,
  onSave,
}) => {
  const boardOptions = useMemo(() => {
    const names = boards.length > 0 ? boards.map((b) => b.name) : DEFAULT_BOARDS;
    if (initialChild?.board && !names.includes(initialChild.board)) {
      return [initialChild.board, ...names];
    }
    return names;
  }, [boards, initialChild?.board]);

  const classOptions = useMemo(() => {
    const names = classes.length > 0 ? classes.map((c) => c.name) : DEFAULT_CLASSES;
    if (initialChild?.grade && !names.includes(initialChild.grade)) {
      return [initialChild.grade, ...names];
    }
    return names;
  }, [classes, initialChild?.grade]);

  const [name, setName] = useState(initialChild?.name ?? '');
  const [board, setBoard] = useState(initialChild?.board ?? boardOptions[0] ?? 'CBSE');
  const [grade, setGrade] = useState(initialChild?.grade ?? classOptions[0] ?? 'Class 3');
  const [avatarColor, setAvatarColor] = useState<ChildAvatarColor>(
    initialChild?.avatarColor ?? 'blue'
  );
  const [loginCode, setLoginCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedName = formatTitleCaseInput(name.trim());
    if (!formattedName) {
      setError("Please enter the child's name.");
      return;
    }

    const trimmedCode = loginCode.trim();
    if (!initialChild && !isValidFourDigitCode(trimmedCode)) {
      setError('Please enter a 4-digit numeric login code (e.g., 1234).');
      return;
    }
    if (initialChild && trimmedCode.length > 0 && !isValidFourDigitCode(trimmedCode)) {
      setError('New login code must be exactly 4 digits (0-9).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: formattedName,
        board,
        grade,
        avatarColor,
        loginCode: trimmedCode,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save child profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 id="child-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {initialChild ? 'Edit Child Profile' : 'Add Child'}
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
            <label htmlFor="child-name-input" className="block text-sm font-medium text-slate-700 mb-1.5">
              Child Name
            </label>
            <input
              id="child-name-input"
              type="text"
              required
              maxLength={CHILD_LIMITS.nameMax}
              value={name}
              onChange={(e) => setName(formatTitleCaseInput(e.target.value))}
              placeholder="e.g., Aanya"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="child-board-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                Board
              </label>
              <select
                id="child-board-select"
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
              <label htmlFor="child-grade-select" className="block text-sm font-medium text-slate-700 mb-1.5">
                Class
              </label>
              <select
                id="child-grade-select"
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

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Profile Color
            </span>
            <div className="flex items-center gap-2.5">
              {CHILD_AVATAR_COLORS.map((swatch) => {
                const selected = avatarColor === swatch.id;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setAvatarColor(swatch.id)}
                    aria-label={`Select ${swatch.label} profile color`}
                    aria-pressed={selected}
                    className={`w-10 h-10 rounded-full ${swatch.bgClass} text-white flex items-center justify-center transition-transform ${
                      selected ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {selected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="child-code-input" className="block text-sm font-medium text-slate-700 mb-1.5">
              4-Digit Child Login Code{' '}
              {initialChild && (
                <span className="text-xs font-normal text-slate-400">(leave blank to keep current)</span>
              )}
            </label>
            <div className="relative">
              <input
                id="child-code-input"
                type={showCode ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={CHILD_LIMITS.codeLength}
                required={!initialChild}
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={initialChild ? '•••• (enter 4 digits to change)' : 'e.g., 1234'}
                className="w-full min-h-[44px] pl-3.5 pr-12 py-2.5 text-sm tracking-[0.35em] font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowCode((prev) => !prev)}
                aria-label={showCode ? 'Hide login code' : 'Show login code'}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 absolute right-0 top-0"
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Your child enters this 4-digit code to sign into their profile in the Child App.
            </p>
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
              {saving ? 'Saving...' : initialChild ? 'Save Changes' : 'Add Child'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
