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
import { GMAIL_REGEX, PARENT_LIMITS, type ParentAccount } from '../types/book';

const BOOTSTRAPPED_ADMIN_EMAIL = 'director@spmniwas.in';

export function formatTitleCaseInput(value: string): string {
  return value.replace(/(?:^|\s)\S/g, (match) => match.toUpperCase());
}

export function normalizeParentName(nameInput: string): string {
  return formatTitleCaseInput(nameInput.trim().replace(/\s+/g, ' ')).slice(
    0,
    PARENT_LIMITS.nameMax
  );
}

export function normalizeGmail(emailInput: string): string {
  return emailInput.trim().toLowerCase();
}

export function getGmailValidationError(emailInput: string): string | null {
  const normalized = normalizeGmail(emailInput);
  if (!normalized) {
    return 'Please enter a Gmail address.';
  }
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) {
    return 'Enter a valid Gmail address (e.g., name@gmail.com).';
  }
  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  if (domainPart !== 'gmail.com') {
    return 'Only @gmail.com email addresses are allowed.';
  }
  if (localPart.includes('..')) {
    return 'Gmail address cannot contain consecutive dots (..).';
  }
  if (
    normalized.length < PARENT_LIMITS.emailMin ||
    normalized.length > PARENT_LIMITS.emailMax ||
    !GMAIL_REGEX.test(normalized)
  ) {
    return 'Enter a valid Gmail address (e.g., name@gmail.com).';
  }
  return null;
}

export function isValidGmail(emailInput: string): boolean {
  return getGmailValidationError(emailInput) === null;
}

export function subscribeToParents(
  userId: string,
  userEmail: string | null | undefined,
  onData: (parents: ParentAccount[]) => void
): Unsubscribe {
  const path = 'parents';
  const ref = collection(db, path);
  const q =
    userEmail === BOOTSTRAPPED_ADMIN_EMAIL
      ? query(ref, orderBy('name', 'asc'))
      : query(ref, where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ParentAccount, 'id'>) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createParent(
  userId: string,
  nameInput: string,
  emailInput: string
): Promise<void> {
  const path = 'parents';
  const name = normalizeParentName(nameInput);
  const email = normalizeGmail(emailInput);

  if (!name) {
    throw new Error('Please enter the parent name.');
  }
  const emailError = getGmailValidationError(email);
  if (emailError) {
    throw new Error(emailError);
  }

  try {
    const newRef = doc(collection(db, path));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      email,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateParent(
  parentId: string,
  nameInput: string,
  emailInput: string
): Promise<void> {
  const path = `parents/${parentId}`;
  const name = normalizeParentName(nameInput);
  const email = normalizeGmail(emailInput);

  if (!name) {
    throw new Error('Parent name cannot be empty.');
  }
  const emailError = getGmailValidationError(email);
  if (emailError) {
    throw new Error(emailError);
  }

  try {
    await updateDoc(doc(db, 'parents', parentId), {
      name,
      email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteParent(parentId: string): Promise<void> {
  const path = `parents/${parentId}`;
  try {
    await deleteDoc(doc(db, 'parents', parentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
