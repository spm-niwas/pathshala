import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CHILD_AVATAR_COLORS,
  CHILD_LIMITS,
  type ChildAvatarColor,
  type ChildProfile,
} from '../types/book';
import { formatTitleCaseInput, normalizeGmail } from './firestoreParents';
import {
  generateSaltHex,
  hashFourDigitCode,
  isValidFourDigitCode,
  verifySaltedFourDigitCode,
} from './passcodeCrypto';

export { generateSaltHex, isValidFourDigitCode };

function clampString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export async function hashChildLoginCode(saltHex: string, code: string): Promise<string> {
  return hashFourDigitCode(saltHex, code);
}

export async function verifyChildLoginCode(
  child: Pick<ChildProfile, 'loginCodeHash' | 'loginCodeSalt'>,
  code: string
): Promise<boolean> {
  return verifySaltedFourDigitCode(child.loginCodeSalt, child.loginCodeHash, code);
}

export function subscribeToChildren(
  parentEmail: string,
  onData: (children: ChildProfile[]) => void
): Unsubscribe {
  const path = 'children';
  const normalizedEmail = normalizeGmail(parentEmail);
  const q = query(
    collection(db, path),
    where('parentEmail', '==', normalizedEmail)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<ChildProfile, 'id'>),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createChild(
  userId: string,
  parentEmailInput: string,
  input: {
    name: string;
    board: string;
    grade: string;
    avatarColor: ChildAvatarColor;
    loginCode: string;
  }
): Promise<string> {
  const path = 'children';
  const name = formatTitleCaseInput(clampString(input.name, CHILD_LIMITS.nameMax));
  const board = clampString(input.board || 'CBSE', CHILD_LIMITS.boardMax);
  const grade = clampString(input.grade || 'Class 3', CHILD_LIMITS.gradeMax);
  const parentEmail = normalizeGmail(parentEmailInput);
  const avatarColor = CHILD_AVATAR_COLORS.some((c) => c.id === input.avatarColor)
    ? input.avatarColor
    : 'blue';

  if (!name) {
    throw new Error("Please enter the child's name.");
  }
  if (!isValidFourDigitCode(input.loginCode)) {
    throw new Error('Please enter a 4-digit numeric login code (e.g., 1234).');
  }

  try {
    const loginCodeSalt = generateSaltHex();
    const loginCodeHash = await hashChildLoginCode(loginCodeSalt, input.loginCode);
    const newRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      board,
      grade,
      avatarColor,
      loginCodeHash,
      loginCodeSalt,
      parentEmail,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateChild(
  childId: string,
  input: {
    name: string;
    board: string;
    grade: string;
    avatarColor: ChildAvatarColor;
    loginCode?: string;
  },
  existingChild: Pick<ChildProfile, 'loginCodeHash' | 'loginCodeSalt'>
): Promise<void> {
  const path = `children/${childId}`;
  const name = formatTitleCaseInput(clampString(input.name, CHILD_LIMITS.nameMax));
  const board = clampString(input.board || 'CBSE', CHILD_LIMITS.boardMax);
  const grade = clampString(input.grade || 'Class 3', CHILD_LIMITS.gradeMax);
  const avatarColor = CHILD_AVATAR_COLORS.some((c) => c.id === input.avatarColor)
    ? input.avatarColor
    : 'blue';

  if (!name) {
    throw new Error("Child's name cannot be empty.");
  }

  let loginCodeSalt = existingChild.loginCodeSalt;
  let loginCodeHash = existingChild.loginCodeHash;
  const trimmedCode = (input.loginCode || '').trim();
  if (trimmedCode.length > 0) {
    if (!isValidFourDigitCode(trimmedCode)) {
      throw new Error('Login code must be exactly 4 digits (0-9).');
    }
    loginCodeSalt = generateSaltHex();
    loginCodeHash = await hashChildLoginCode(loginCodeSalt, trimmedCode);
  }

  try {
    await updateDoc(doc(db, 'children', childId), {
      name,
      board,
      grade,
      avatarColor,
      loginCodeSalt,
      loginCodeHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChild(childId: string): Promise<void> {
  const path = `children/${childId}`;
  try {
    await deleteDoc(doc(db, 'children', childId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
