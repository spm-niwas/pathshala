import React, { useState } from 'react';
import { Check, ChevronRight, Edit3, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  MASTER_LIMITS,
  type BookLanguage,
  type MasterBoard,
  type MasterClass,
  type MasterSubject,
} from '../types/book';
import {
  createBoard,
  createClass,
  createSubject,
  deleteBoard,
  deleteClass,
  deleteSubject,
  updateBoard,
  updateClass,
  updateSubject,
} from '../services/firestoreMasters';

interface MastersPageProps {
  userId: string;
  boards: MasterBoard[];
  classes: MasterClass[];
  subjects: MasterSubject[];
  loading: boolean;
}

type MasterTab = 'boards' | 'classes' | 'subjects';

export const MastersPage: React.FC<MastersPageProps> = ({
  userId,
  boards,
  classes,
  subjects,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<MasterTab>('boards');

  // Add inputs
  const [boardInput, setBoardInput] = useState('');
  const [classInput, setClassInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [subjectLang, setSubjectLang] = useState<BookLanguage>('en');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSubjectLang, setEditingSubjectLang] = useState<BookLanguage>('en');

  // Delete confirm state
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Busy & feedback states
  const [submitting, setSubmitting] = useState<'add' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const switchTab = (tab: MasterTab) => {
    setActiveTab(tab);
    setEditingId(null);
    setConfirmDeleteKey(null);
    setErrorMsg(null);
  };

  const handleAddBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = boardInput.trim();
    if (!trimmed) return;
    if (boards.some((b) => b.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Board "${trimmed}" already exists.`);
      return;
    }

    setSubmitting('add');
    setErrorMsg(null);
    try {
      await createBoard(userId, trimmed);
      setBoardInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add board.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = classInput.trim();
    if (!trimmed) return;
    if (classes.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Class "${trimmed}" already exists.`);
      return;
    }

    setSubmitting('add');
    setErrorMsg(null);
    try {
      await createClass(userId, trimmed);
      setClassInput('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add class.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subjectInput.trim();
    if (!trimmed) return;
    if (subjects.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Subject "${trimmed}" already exists.`);
      return;
    }

    setSubmitting('add');
    setErrorMsg(null);
    try {
      await createSubject(userId, trimmed, subjectLang);
      setSubjectInput('');
      setSubjectLang('en');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add subject.');
    } finally {
      setSubmitting(null);
    }
  };

  const categories: Array<{
    id: MasterTab;
    label: string;
    subtitle: string;
    count: number;
  }> = [
    { id: 'boards', label: 'Boards', subtitle: 'CBSE, ICSE, State', count: boards.length },
    { id: 'classes', label: 'Classes', subtitle: 'Class 1 to Class 12', count: classes.length },
    { id: 'subjects', label: 'Subjects', subtitle: 'English, Hindi, Maths, EVS', count: subjects.length },
  ];

  const activeCategory = categories.find((c) => c.id === activeTab)!;

  return (
    <div className="pb-6">
      {/* Compact single-row page header */}
      <div className="mb-4">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Masters
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Configure Boards, Classes, and Subjects for your textbook catalog.
        </p>
      </div>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {errorMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading masters...
        </div>
      ) : (
        /* Two-Pane Master-Detail Layout */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Left Pane: Master Category List */}
          <aside className="md:col-span-4 lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-2 md:p-3">
            <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5">
              {categories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => switchTab(cat.id)}
                    className={`min-h-[44px] w-full px-3 py-2.5 rounded-xl text-left transition-colors flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold truncate">
                        {cat.label}
                      </div>
                      <div className="hidden md:block text-xs text-slate-500 truncate mt-0.5">
                        {cat.subtitle}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-xs tabular-nums font-medium ${
                          isActive ? 'text-blue-700' : 'text-slate-500'
                        }`}
                      >
                        {cat.count}
                      </span>
                      <ChevronRight
                        className={`hidden md:block w-4 h-4 ${
                          isActive ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Pane: Active Master Management */}
          <section className="md:col-span-8 lg:col-span-9 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="font-display text-base sm:text-lg font-semibold text-slate-900">
                  {activeCategory.label}
                </h2>
                <p className="text-xs text-slate-500">{activeCategory.subtitle}</p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {activeCategory.count} {activeCategory.count === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Active Category Add Form */}
            {activeTab === 'boards' && (
              <form onSubmit={handleAddBoard} className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  maxLength={MASTER_LIMITS.boardMax}
                  value={boardInput}
                  onChange={(e) => setBoardInput(e.target.value)}
                  placeholder="Enter board name (e.g., CBSE, ICSE)"
                  aria-label="New board name"
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={submitting !== null || !boardInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add Board
                </button>
              </form>
            )}

            {activeTab === 'classes' && (
              <form onSubmit={handleAddClass} className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  maxLength={MASTER_LIMITS.classMax}
                  value={classInput}
                  onChange={(e) => setClassInput(e.target.value)}
                  placeholder="Enter class name (e.g., Class 3, Class 4)"
                  aria-label="New class name"
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={submitting !== null || !classInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add Class
                </button>
              </form>
            )}

            {activeTab === 'subjects' && (
              <form onSubmit={handleAddSubject} className="flex flex-wrap items-center gap-2 mb-4">
                <input
                  type="text"
                  maxLength={MASTER_LIMITS.subjectMax}
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="Enter subject name (e.g., English, Hindi, EVS)"
                  aria-label="New subject name"
                  className="flex-1 min-w-[180px] min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl min-h-[44px] shrink-0">
                  <button
                    type="button"
                    onClick={() => setSubjectLang('en')}
                    className={`px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      subjectLang === 'en'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectLang('hi')}
                    className={`px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      subjectLang === 'hi'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={submitting !== null || !subjectInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Add Subject
                </button>
              </form>
            )}

            {/* Active Category List (compact single-screen scroll area) */}
            <div className="md:max-h-[calc(100vh-310px)] md:overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
              {activeTab === 'boards' && (
                boards.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No boards added yet. Add one above.
                  </p>
                ) : (
                  boards.map((board) => {
                    const isEditing = editingId === board.id;
                    const deleteKey = `board-${board.id}`;
                    return (
                      <div key={board.id} className="py-2.5 flex items-center justify-between gap-2">
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={MASTER_LIMITS.boardMax}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await updateBoard(board.id, editingName);
                                setEditingId(null);
                              }}
                              aria-label="Save board name"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel editing board"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {board.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(board.id);
                                  setEditingName(board.name);
                                }}
                                aria-label={`Edit ${board.name}`}
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteKey === deleteKey ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteBoard(board.id);
                                      setConfirmDeleteKey(null);
                                    }}
                                    className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="min-h-[36px] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  aria-label={`Delete ${board.name}`}
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
                  })
                )
              )}

              {activeTab === 'classes' && (
                classes.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No classes added yet. Add one above.
                  </p>
                ) : (
                  classes.map((cls) => {
                    const isEditing = editingId === cls.id;
                    const deleteKey = `class-${cls.id}`;
                    return (
                      <div key={cls.id} className="py-2.5 flex items-center justify-between gap-2">
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={MASTER_LIMITS.classMax}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await updateClass(cls.id, editingName);
                                setEditingId(null);
                              }}
                              aria-label="Save class name"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel editing class"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {cls.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(cls.id);
                                  setEditingName(cls.name);
                                }}
                                aria-label={`Edit ${cls.name}`}
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteKey === deleteKey ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteClass(cls.id);
                                      setConfirmDeleteKey(null);
                                    }}
                                    className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="min-h-[36px] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  aria-label={`Delete ${cls.name}`}
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
                  })
                )
              )}

              {activeTab === 'subjects' && (
                subjects.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No subjects added yet. Add one above.
                  </p>
                ) : (
                  subjects.map((subj) => {
                    const isEditing = editingId === subj.id;
                    const deleteKey = `subject-${subj.id}`;
                    return (
                      <div key={subj.id} className="py-2.5 flex items-center justify-between gap-2">
                        {isEditing ? (
                          <div className="flex-1 flex flex-wrap items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={MASTER_LIMITS.subjectMax}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 min-w-[140px] min-h-[40px] px-3 py-1.5 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <div className="inline-grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg min-h-[40px]">
                              <button
                                type="button"
                                onClick={() => setEditingSubjectLang('en')}
                                className={`px-2.5 text-xs font-medium rounded-md ${
                                  editingSubjectLang === 'en'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600'
                                }`}
                              >
                                English
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSubjectLang('hi')}
                                className={`px-2.5 text-xs font-medium rounded-md ${
                                  editingSubjectLang === 'hi'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600'
                                }`}
                              >
                                हिन्दी
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await updateSubject(subj.id, editingName, editingSubjectLang);
                                setEditingId(null);
                              }}
                              aria-label="Save subject"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel editing subject"
                              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-slate-900 truncate">
                                {subj.name}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="text-xs text-slate-500 whitespace-nowrap">
                                {subj.defaultLanguage === 'hi' ? 'हिन्दी' : 'English'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(subj.id);
                                  setEditingName(subj.name);
                                  setEditingSubjectLang(subj.defaultLanguage);
                                }}
                                aria-label={`Edit ${subj.name}`}
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteKey === deleteKey ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteSubject(subj.id);
                                      setConfirmDeleteKey(null);
                                    }}
                                    className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="min-h-[36px] px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  aria-label={`Delete ${subj.name}`}
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
                  })
                )
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
