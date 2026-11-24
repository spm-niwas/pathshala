import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';

export interface ConfirmDeleteTarget {
  itemName: string;
  description?: string;
  onConfirm: () => Promise<void> | void;
}

interface ConfirmDeleteDialogProps {
  target: ConfirmDeleteTarget | null;
  onClose: () => void;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  target,
  onClose,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDeleting(false);
    setErrorMsg(null);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [target, deleting, onClose]);

  if (!target) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    setErrorMsg(null);
    try {
      await target.onConfirm();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete item.');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      onClick={() => {
        if (!deleting) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2
              id="confirm-delete-title"
              className="font-display text-lg font-semibold text-slate-900 truncate"
            >
              Confirm Delete
            </h2>
          </div>

          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            aria-label="Close confirmation dialog"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-40 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          Are you sure you want to delete{' '}
          <strong className="font-semibold text-slate-900">{target.itemName}</strong>
          {target.description ? ` ${target.description}` : ''}? This action cannot be undone.
        </p>

        {errorMsg && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirm}
            className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
