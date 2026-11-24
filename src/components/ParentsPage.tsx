import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { PARENT_LIMITS, type ParentAccount } from '../types/book';
import {
  createParent,
  deleteParent,
  formatTitleCaseInput,
  getGmailValidationError,
  normalizeGmail,
  normalizeParentName,
  updateParent,
} from '../services/firestoreParents';

interface ParentsPageProps {
  userId: string;
  parents: ParentAccount[];
  loading: boolean;
}

const PAGE_SIZE = 25;

export const ParentsPage: React.FC<ParentsPageProps> = ({
  userId,
  parents,
  loading,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const liveEmailError = useMemo(() => {
    if (!emailTouched && !emailInput.trim()) return null;
    if (!emailTouched && emailInput.trim()) return null;
    return getGmailValidationError(emailInput);
  }, [emailInput, emailTouched]);

  const filteredParents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [parents, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredParents.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedParents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredParents.slice(start, start + PAGE_SIZE);
  }, [filteredParents, currentPage]);

  const showPagination = filteredParents.length > PAGE_SIZE;
  const rangeStart = filteredParents.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredParents.length);

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    const formattedName = normalizeParentName(nameInput);
    const normalizedEmail = normalizeGmail(emailInput);

    if (!formattedName) {
      setErrorMsg('Please enter the parent name.');
      return;
    }

    const emailValidationError = getGmailValidationError(normalizedEmail);
    if (emailValidationError) {
      setErrorMsg(emailValidationError);
      return;
    }

    if (parents.some((p) => p.email.toLowerCase() === normalizedEmail)) {
      setErrorMsg(`"${normalizedEmail}" is already added.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createParent(userId, formattedName, normalizedEmail);
      setNameInput('');
      setEmailInput('');
      setEmailTouched(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add parent.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (parentId: string) => {
    const formattedName = normalizeParentName(editingName);
    const normalizedEmail = normalizeGmail(editingEmail);

    if (!formattedName) {
      setErrorMsg('Parent name cannot be empty.');
      return;
    }

    const emailValidationError = getGmailValidationError(normalizedEmail);
    if (emailValidationError) {
      setErrorMsg(emailValidationError);
      return;
    }

    if (parents.some((p) => p.id !== parentId && p.email.toLowerCase() === normalizedEmail)) {
      setErrorMsg(`"${normalizedEmail}" is already added.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await updateParent(parentId, formattedName, normalizedEmail);
      setEditingId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update parent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-4">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Parents
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Add parent accounts
        </p>
      </div>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {errorMsg}
        </p>
      )}

      {/* Add Parent Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-5">
        <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
          Add Parent
        </h2>
        <form onSubmit={handleAddParent} noValidate className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
          <div className="sm:col-span-4">
            <label htmlFor="parent-name-input" className="block text-xs font-medium text-slate-600 mb-1.5">
              Name
            </label>
            <input
              id="parent-name-input"
              type="text"
              required
              maxLength={PARENT_LIMITS.nameMax}
              value={nameInput}
              onChange={(e) => setNameInput(formatTitleCaseInput(e.target.value))}
              placeholder="e.g., Priya Sharma"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="sm:col-span-5">
            <label htmlFor="parent-email-input" className="block text-xs font-medium text-slate-600 mb-1.5">
              Email
            </label>
            <input
              id="parent-email-input"
              type="email"
              required
              maxLength={PARENT_LIMITS.emailMax}
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              onBlur={() => setEmailTouched(true)}
              placeholder="Gmail accounts only"
              className={`w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border rounded-xl focus:outline-none focus:ring-2 ${
                liveEmailError
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-slate-300 focus:ring-blue-600'
              }`}
            />
            {liveEmailError && (
              <p className="mt-1 text-xs text-red-600">{liveEmailError}</p>
            )}
          </div>

          <div className="sm:col-span-3 sm:pt-6">
            <button
              type="submit"
              disabled={submitting || !nameInput.trim() || !emailInput.trim()}
              className="w-full min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Add Parent
            </button>
          </div>
        </form>
      </section>

      {/* Registered Parents List */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Parent Directory
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {filteredParents.length} {filteredParents.length === 1 ? 'parent' : 'parents'}
            </span>
          </div>

          <div className="relative w-full sm:w-72 sm:ml-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or Gmail..."
              aria-label="Search parents"
              className="w-full min-h-[40px] pl-9 pr-8 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading parents...
          </div>
        ) : filteredParents.length === 0 ? (
          <div className="py-10 text-center">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
            <p className="text-sm text-slate-500">
              {parents.length === 0
                ? 'No parents added yet. Enter a name and @gmail.com address above.'
                : `No parents match "${searchQuery.trim()}".`}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {paginatedParents.map((parent) => {
                const isEditing = editingId === parent.id;
                return (
                  <div key={parent.id} className="py-3 flex items-center justify-between gap-3">
                    {isEditing ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          maxLength={PARENT_LIMITS.nameMax}
                          value={editingName}
                          onChange={(e) => setEditingName(formatTitleCaseInput(e.target.value))}
                          aria-label="Edit parent name"
                          className="sm:col-span-4 min-h-[40px] px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <input
                          type="email"
                          maxLength={PARENT_LIMITS.emailMax}
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          aria-label="Edit parent Gmail"
                          className="sm:col-span-6 min-h-[40px] px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <div className="sm:col-span-2 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSaveEdit(parent.id)}
                            aria-label="Save parent"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setErrorMsg(null);
                            }}
                            aria-label="Cancel editing parent"
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {parent.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {parent.email}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(parent.id);
                              setEditingName(formatTitleCaseInput(parent.name));
                              setEditingEmail(parent.email);
                              setErrorMsg(null);
                            }}
                            aria-label={`Edit ${parent.name}`}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {confirmDeleteId === parent.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteParent(parent.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[36px] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(parent.id)}
                              aria-label={`Delete ${parent.name}`}
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {showPagination && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 tabular-nums">
                  Showing {rangeStart}–{rangeEnd} of {filteredParents.length} · Page {currentPage} of {totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
