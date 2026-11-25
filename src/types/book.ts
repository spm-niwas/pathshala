export type Subject = string;
export type BookLanguage = 'en' | 'hi';
export type ChapterStatus = 'draft' | 'ready';
export type BookPublishStatus = 'draft' | 'published';

export const DEFAULT_BOARDS = ['CBSE'];
export const DEFAULT_CLASSES = ['Class 3'];
export const DEFAULT_SUBJECTS: Array<{ name: string; defaultLanguage: BookLanguage }> = [
  { name: 'English', defaultLanguage: 'en' },
  { name: 'Hindi', defaultLanguage: 'hi' },
  { name: 'Maths', defaultLanguage: 'en' },
  { name: 'EVS', defaultLanguage: 'en' },
];

export const MASTER_LIMITS = {
  boardMax: 40,
  classMax: 40,
  subjectMax: 60,
} as const;

export const PARENT_LIMITS = {
  nameMax: 100,
  emailMin: 11,
  emailMax: 160,
} as const;

export const GMAIL_REGEX = /^[a-z0-9](?:[a-z0-9._%+\-]*[a-z0-9])?@gmail\.com$/;

export const BOOK_LIMITS = {
  titleMin: 1,
  titleMax: 120,
  subjectMax: 60,
  boardMax: 40,
  gradeMax: 40,
} as const;

export const CHAPTER_LIMITS = {
  titleMin: 1,
  titleMax: 160,
  combinedTextMax: 80000,
  maxPages: 200,
} as const;

export const PAGE_LIMITS = {
  diagramNoteMax: 1000,
  imageDataUrlMax: 450000,
} as const;

export interface MasterBoard {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MasterClass {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MasterSubject {
  id: string;
  name: string;
  defaultLanguage: BookLanguage;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParentAccount {
  id: string;
  name: string;
  email: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ChildAvatarColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'teal';

export const CHILD_AVATAR_COLORS: Array<{
  id: ChildAvatarColor;
  label: string;
  bgClass: string;
  softBgClass: string;
  textClass: string;
}> = [
  { id: 'blue', label: 'Blue', bgClass: 'bg-blue-600', softBgClass: 'bg-blue-50', textClass: 'text-blue-700' },
  { id: 'emerald', label: 'Emerald', bgClass: 'bg-emerald-600', softBgClass: 'bg-emerald-50', textClass: 'text-emerald-700' },
  { id: 'amber', label: 'Amber', bgClass: 'bg-amber-600', softBgClass: 'bg-amber-50', textClass: 'text-amber-700' },
  { id: 'rose', label: 'Rose', bgClass: 'bg-rose-600', softBgClass: 'bg-rose-50', textClass: 'text-rose-700' },
  { id: 'indigo', label: 'Indigo', bgClass: 'bg-indigo-600', softBgClass: 'bg-indigo-50', textClass: 'text-indigo-700' },
  { id: 'teal', label: 'Teal', bgClass: 'bg-teal-600', softBgClass: 'bg-teal-50', textClass: 'text-teal-700' },
];

export const CHILD_LIMITS = {
  nameMax: 80,
  boardMax: 40,
  gradeMax: 40,
  codeLength: 4,
} as const;

export interface ChildProfile {
  id: string;
  name: string;
  board: string;
  grade: string;
  avatarColor: ChildAvatarColor;
  loginCodeHash: string;
  loginCodeSalt: string;
  parentEmail: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ParentSettings {
  ownerId: string;
  parentEmail: string;
  passpinHash: string;
  passpinSalt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Book {
  id: string;
  title: string;
  subject: Subject;
  language: BookLanguage;
  board: string;
  grade: string;
  chapterCount: number;
  publishStatus?: BookPublishStatus;
  hasUnpublishedChanges?: boolean;
  publishedAt?: unknown;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string;
  combinedText: string;
  pageCount: number;
  savedImageCount: number;
  status: ChapterStatus;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ScannedPageRecord {
  id: string;
  bookId: string;
  chapterId: string;
  pageNumber: number;
  hasDiagram: boolean;
  diagramNote: string;
  keepImage: boolean;
  imageDataUrl: string;
  ownerId: string;
  createdAt?: unknown;
}

export interface PendingPhoto {
  localId: string;
  pageNumber: number;
  previewUrl: string;
  ocrBase64: string;
  ocrMimeType: string;
  archivalDataUrl: string;
  keepImage: boolean;
  hasDiagram: boolean;
  diagramNote: string;
  extractedText: string;
}

export interface ScanPageApiResult {
  pageNumber: number;
  extractedText: string;
  hasDiagram: boolean;
  diagramNote: string;
}

export interface ScanPagesApiResponse {
  pages: ScanPageApiResult[];
  combinedText: string;
  suggestedChapterNumber?: number;
  suggestedChapterTitle?: string;
}

export interface IndexChapterCandidate {
  chapterNumber: number;
  title: string;
  pageRange?: string;
}

export interface ScanIndexApiResponse {
  chapters: IndexChapterCandidate[];
}

