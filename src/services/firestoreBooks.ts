import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BOOK_LIMITS,
  CHAPTER_LIMITS,
  PAGE_LIMITS,
  type Book,
  type BookLanguage,
  type Chapter,
  type ChapterStatus,
  type PendingPhoto,
  type ScannedPageRecord,
  type Subject,
} from '../types/book';

const BOOTSTRAPPED_ADMIN_EMAIL = 'director@spmniwas.in';

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'object') {
    const maybe = ts as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof maybe.toMillis === 'function') {
      return maybe.toMillis();
    }
    if (typeof maybe.seconds === 'number') {
      return maybe.seconds * 1000 + Math.floor((maybe.nanoseconds ?? 0) / 1e6);
    }
  }
  return 0;
}

export function sortBooksByLatestEdited(items: Book[]): Book[] {
  return [...items].sort((a, b) => {
    const aTime = Math.max(getTimestampMillis(a.updatedAt), getTimestampMillis(a.createdAt));
    const bTime = Math.max(getTimestampMillis(b.updatedAt), getTimestampMillis(b.createdAt));
    if (bTime !== aTime) return bTime - aTime;
    return a.title.localeCompare(b.title);
  });
}

export function subscribeToBooks(
  userId: string,
  userEmail: string | null | undefined,
  onData: (books: Book[]) => void
): Unsubscribe {
  const path = 'books';
  const booksRef = collection(db, path);
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q = isBootstrapped
    ? query(booksRef, orderBy('updatedAt', 'desc'))
    : query(booksRef, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Book[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data({ serverTimestamps: 'estimate' }) as Omit<Book, 'id'>),
      }));
      onData(sortBooksByLatestEdited(items));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createBook(
  userId: string,
  input: {
    title: string;
    subject: Subject;
    language: BookLanguage;
    board: string;
    grade: string;
  }
): Promise<string> {
  const path = 'books';
  const title = clampString(input.title, BOOK_LIMITS.titleMax);
  const board = clampString(input.board || 'CBSE', BOOK_LIMITS.boardMax);
  const grade = clampString(input.grade || 'Class 3', BOOK_LIMITS.gradeMax);

  if (!title) {
    throw new Error('Please enter a book title.');
  }

  try {
    const newDocRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newDocRef, {
      title,
      subject: input.subject,
      language: input.language,
      board,
      grade,
      chapterCount: 0,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBook(
  bookId: string,
  input: {
    title: string;
    subject: Subject;
    language: BookLanguage;
    board: string;
    grade: string;
  }
): Promise<void> {
  const path = `books/${bookId}`;
  const title = clampString(input.title, BOOK_LIMITS.titleMax);
  const board = clampString(input.board || 'CBSE', BOOK_LIMITS.boardMax);
  const grade = clampString(input.grade || 'Class 3', BOOK_LIMITS.gradeMax);

  if (!title) {
    throw new Error('Please enter a book title.');
  }

  try {
    await updateDoc(doc(db, 'books', bookId), {
      title,
      subject: input.subject,
      language: input.language,
      board,
      grade,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookWithContents(bookId: string): Promise<void> {
  const path = `books/${bookId}`;
  try {
    const chaptersSnap = await getDocs(collection(db, 'books', bookId, 'chapters'));
    const batch = writeBatch(db);

    for (const chapterDoc of chaptersSnap.docs) {
      const pagesSnap = await getDocs(
        collection(db, 'books', bookId, 'chapters', chapterDoc.id, 'pages')
      );
      for (const pageDoc of pagesSnap.docs) {
        batch.delete(pageDoc.ref);
      }
      batch.delete(chapterDoc.ref);
    }

    batch.delete(doc(db, 'books', bookId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToChapters(
  bookId: string,
  userId: string,
  userEmail: string | null | undefined,
  onData: (chapters: Chapter[]) => void
): Unsubscribe {
  const path = `books/${bookId}/chapters`;
  const chaptersRef = collection(db, 'books', bookId, 'chapters');
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q = isBootstrapped
    ? query(chaptersRef, orderBy('chapterNumber', 'asc'))
    : query(chaptersRef, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Chapter[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Chapter, 'id'>),
        }))
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createChapter(
  bookId: string,
  userId: string,
  input: {
    chapterNumber: number;
    title: string;
  }
): Promise<string> {
  const path = `books/${bookId}/chapters`;
  const title = clampString(input.title, CHAPTER_LIMITS.titleMax);
  const chapterNumber = Math.max(1, Math.min(500, Math.round(input.chapterNumber || 1)));

  if (!title) {
    throw new Error('Please enter a chapter title.');
  }

  try {
    const chapterRef = doc(collection(db, 'books', bookId, 'chapters'));
    const bookRef = doc(db, 'books', bookId);
    const batch = writeBatch(db);

    batch.set(chapterRef, {
      bookId,
      chapterNumber,
      title,
      combinedText: '',
      pageCount: 0,
      savedImageCount: 0,
      status: 'draft' as ChapterStatus,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(bookRef, {
      chapterCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return chapterRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createChaptersBatch(
  bookId: string,
  userId: string,
  items: Array<{ chapterNumber: number; title: string }>
): Promise<number> {
  const path = `books/${bookId}/chapters`;
  const validItems = items
    .map((item) => ({
      chapterNumber: Math.max(1, Math.min(500, Math.round(item.chapterNumber || 1))),
      title: clampString(item.title, CHAPTER_LIMITS.titleMax),
    }))
    .filter((item) => item.title.length > 0);

  if (validItems.length === 0) {
    throw new Error('Please keep at least one chapter with a title.');
  }

  try {
    const batch = writeBatch(db);
    const chaptersCol = collection(db, 'books', bookId, 'chapters');
    const bookRef = doc(db, 'books', bookId);

    for (const item of validItems) {
      const chapterRef = doc(chaptersCol);
      batch.set(chapterRef, {
        bookId,
        chapterNumber: item.chapterNumber,
        title: item.title,
        combinedText: '',
        pageCount: 0,
        savedImageCount: 0,
        status: 'draft' as ChapterStatus,
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.update(bookRef, {
      chapterCount: increment(validItems.length),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return validItems.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToChapterPages(
  bookId: string,
  chapterId: string,
  userId: string,
  userEmail: string | null | undefined,
  onData: (pages: ScannedPageRecord[]) => void
): Unsubscribe {
  const path = `books/${bookId}/chapters/${chapterId}/pages`;
  const pagesRef = collection(db, 'books', bookId, 'chapters', chapterId, 'pages');
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q = isBootstrapped
    ? query(pagesRef, orderBy('pageNumber', 'asc'))
    : query(pagesRef, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ScannedPageRecord[] = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ScannedPageRecord, 'id'>),
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveChapterContent(
  bookId: string,
  chapterId: string,
  userId: string,
  input: {
    chapterNumber: number;
    title: string;
    combinedText: string;
    status: ChapterStatus;
    pendingPhotos?: PendingPhoto[];
    existingPageCount: number;
    existingSavedImageCount: number;
  }
): Promise<void> {
  const path = `books/${bookId}/chapters/${chapterId}`;
  const title = clampString(input.title, CHAPTER_LIMITS.titleMax);
  const combinedText = input.combinedText.slice(0, CHAPTER_LIMITS.combinedTextMax);
  const chapterNumber = Math.max(1, Math.min(500, Math.round(input.chapterNumber || 1)));

  if (!title) {
    throw new Error('Chapter title cannot be empty.');
  }

  try {
    const batch = writeBatch(db);
    const chapterRef = doc(db, 'books', bookId, 'chapters', chapterId);

    let pageCount = input.existingPageCount;
    let savedImageCount = input.existingSavedImageCount;

    if (input.pendingPhotos && input.pendingPhotos.length > 0) {
      const existingPagesSnap = await getDocs(
        collection(db, 'books', bookId, 'chapters', chapterId, 'pages')
      );
      for (const oldPage of existingPagesSnap.docs) {
        batch.delete(oldPage.ref);
      }

      pageCount = input.pendingPhotos.length;
      savedImageCount = input.pendingPhotos.filter((p) => p.keepImage).length;

      for (let i = 0; i < input.pendingPhotos.length; i++) {
        const photo = input.pendingPhotos[i];
        const pageRef = doc(collection(db, 'books', bookId, 'chapters', chapterId, 'pages'));
        const safeImage =
          photo.keepImage && photo.archivalDataUrl.length <= PAGE_LIMITS.imageDataUrlMax
            ? photo.archivalDataUrl
            : '';
        batch.set(pageRef, {
          bookId,
          chapterId,
          pageNumber: i + 1,
          hasDiagram: Boolean(photo.hasDiagram),
          diagramNote: (photo.diagramNote || '').slice(0, PAGE_LIMITS.diagramNoteMax),
          keepImage: Boolean(photo.keepImage && safeImage.length > 0),
          imageDataUrl: safeImage,
          ownerId: userId,
          createdAt: serverTimestamp(),
        });
      }
    }

    batch.update(chapterRef, {
      chapterNumber,
      title,
      combinedText,
      pageCount,
      savedImageCount,
      status: input.status,
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'books', bookId), {
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChapter(bookId: string, chapterId: string): Promise<void> {
  const path = `books/${bookId}/chapters/${chapterId}`;
  try {
    const pagesSnap = await getDocs(
      collection(db, 'books', bookId, 'chapters', chapterId, 'pages')
    );
    const batch = writeBatch(db);

    for (const pageDoc of pagesSnap.docs) {
      batch.delete(pageDoc.ref);
    }

    batch.delete(doc(db, 'books', bookId, 'chapters', chapterId));
    batch.update(doc(db, 'books', bookId), {
      chapterCount: increment(-1),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteSavedPageImage(
  bookId: string,
  chapterId: string,
  pageId: string
): Promise<void> {
  const path = `books/${bookId}/chapters/${chapterId}/pages/${pageId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'books', bookId, 'chapters', chapterId, 'pages', pageId), {
      keepImage: false,
      imageDataUrl: '',
    });
    batch.update(doc(db, 'books', bookId, 'chapters', chapterId), {
      savedImageCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'books', bookId), {
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
