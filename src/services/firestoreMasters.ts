import {
  collection,
  deleteDoc,
  doc,
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
  DEFAULT_BOARDS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  MASTER_LIMITS,
  type BookLanguage,
  type MasterBoard,
  type MasterClass,
  type MasterSubject,
} from '../types/book';

const BOOTSTRAPPED_ADMIN_EMAIL = 'director@spmniwas.in';

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function subscribeToBoards(
  userId: string,
  userEmail: string | null | undefined,
  onData: (boards: MasterBoard[]) => void,
  readSharedCatalog = false
): Unsubscribe {
  const path = 'boards';
  const ref = collection(db, path);
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q =
    isBootstrapped || readSharedCatalog
      ? query(ref, orderBy('name', 'asc'))
      : query(ref, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MasterBoard, 'id'>) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToClasses(
  userId: string,
  userEmail: string | null | undefined,
  onData: (classes: MasterClass[]) => void,
  readSharedCatalog = false
): Unsubscribe {
  const path = 'classes';
  const ref = collection(db, path);
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q =
    isBootstrapped || readSharedCatalog
      ? query(ref, orderBy('name', 'asc'))
      : query(ref, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MasterClass, 'id'>) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeToSubjects(
  userId: string,
  userEmail: string | null | undefined,
  onData: (subjects: MasterSubject[]) => void,
  readSharedCatalog = false
): Unsubscribe {
  const path = 'subjects';
  const ref = collection(db, path);
  const isBootstrapped = (userEmail || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const q =
    isBootstrapped || readSharedCatalog
      ? query(ref, orderBy('name', 'asc'))
      : query(ref, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<MasterSubject, 'id'>) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createBoard(userId: string, nameInput: string): Promise<void> {
  const path = 'boards';
  const name = clampString(nameInput, MASTER_LIMITS.boardMax);
  if (!name) throw new Error('Please enter a board name.');

  try {
    const newRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBoard(boardId: string, nameInput: string): Promise<void> {
  const path = `boards/${boardId}`;
  const name = clampString(nameInput, MASTER_LIMITS.boardMax);
  if (!name) throw new Error('Board name cannot be empty.');

  try {
    await updateDoc(doc(db, 'boards', boardId), {
      name,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBoard(boardId: string): Promise<void> {
  const path = `boards/${boardId}`;
  try {
    await deleteDoc(doc(db, 'boards', boardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createClass(userId: string, nameInput: string): Promise<void> {
  const path = 'classes';
  const name = clampString(nameInput, MASTER_LIMITS.classMax);
  if (!name) throw new Error('Please enter a class name.');

  try {
    const newRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClass(classId: string, nameInput: string): Promise<void> {
  const path = `classes/${classId}`;
  const name = clampString(nameInput, MASTER_LIMITS.classMax);
  if (!name) throw new Error('Class name cannot be empty.');

  try {
    await updateDoc(doc(db, 'classes', classId), {
      name,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteClass(classId: string): Promise<void> {
  const path = `classes/${classId}`;
  try {
    await deleteDoc(doc(db, 'classes', classId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createSubject(
  userId: string,
  nameInput: string,
  defaultLanguage: BookLanguage
): Promise<void> {
  const path = 'subjects';
  const name = clampString(nameInput, MASTER_LIMITS.subjectMax);
  if (!name) throw new Error('Please enter a subject name.');

  try {
    const newRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      defaultLanguage,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSubject(
  subjectId: string,
  nameInput: string,
  defaultLanguage: BookLanguage
): Promise<void> {
  const path = `subjects/${subjectId}`;
  const name = clampString(nameInput, MASTER_LIMITS.subjectMax);
  if (!name) throw new Error('Subject name cannot be empty.');

  try {
    await updateDoc(doc(db, 'subjects', subjectId), {
      name,
      defaultLanguage,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const path = `subjects/${subjectId}`;
  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultMasters(
  userId: string,
  existingBoards: MasterBoard[],
  existingClasses: MasterClass[],
  existingSubjects: MasterSubject[]
): Promise<number> {
  const path = 'masters-seed';
  const boardNames = new Set(existingBoards.map((b) => b.name.trim().toLowerCase()));
  const classNames = new Set(existingClasses.map((c) => c.name.trim().toLowerCase()));
  const subjectNames = new Set(existingSubjects.map((s) => s.name.trim().toLowerCase()));

  try {
    const batch = writeBatch(db);
    let added = 0;

    for (const board of DEFAULT_BOARDS) {
      if (!boardNames.has(board.toLowerCase())) {
        batch.set(doc(collection(db, 'boards')), {
          name: board,
          ownerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        added++;
      }
    }

    for (const cls of DEFAULT_CLASSES) {
      if (!classNames.has(cls.toLowerCase())) {
        batch.set(doc(collection(db, 'classes')), {
          name: cls,
          ownerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        added++;
      }
    }

    for (const subj of DEFAULT_SUBJECTS) {
      if (!subjectNames.has(subj.name.toLowerCase())) {
        batch.set(doc(collection(db, 'subjects')), {
          name: subj.name,
          defaultLanguage: subj.defaultLanguage,
          ownerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        added++;
      }
    }

    if (added > 0) {
      await batch.commit();
    }
    return added;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
