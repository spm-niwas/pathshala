import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  GMAIL_REGEX,
  PARENT_LIMITS,
  type ParentAccount,
  type ParentSettings,
} from '../types/book';
import {
  generateSaltHex,
  hashFourDigitCode,
  isValidFourDigitCode,
  verifySaltedFourDigitCode,
} from './passcodeCrypto';

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

export function emailToAccessId(emailInput: string): string {
  return normalizeGmail(emailInput)
    .replace(/_/g, '_u_')
    .replace(/@/g, '_at_')
    .replace(/\./g, '_dot_')
    .replace(/\+/g, '_plus_')
    .replace(/%/g, '_pct_');
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

export async function checkParentAuthorization(
  emailInput: string | null | undefined
): Promise<{ authorized: boolean; accessSynced: boolean; parentName?: string }> {
  const email = normalizeGmail(emailInput || '');
  if (!email || !GMAIL_REGEX.test(email)) {
    return { authorized: false, accessSynced: false };
  }

  try {
    const accessSnap = await getDoc(doc(db, 'parentAccess', emailToAccessId(email)));
    if (accessSnap.exists()) {
      const data = accessSnap.data() as { name?: string };
      return { authorized: true, accessSynced: true, parentName: data.name };
    }
  } catch {
    // Fall back to parents query check below
  }

  try {
    const parentsSnap = await getDocs(
      query(collection(db, 'parents'), where('email', '==', email))
    );
    if (!parentsSnap.empty) {
      const first = parentsSnap.docs[0].data() as { name?: string };
      return { authorized: true, accessSynced: false, parentName: first.name };
    }
  } catch {
    // Not authorized
  }

  return { authorized: false, accessSynced: false };
}

export function subscribeToParentAccessRecord(
  emailInput: string,
  onData: (record: { name: string; accessSynced: boolean } | null) => void
): Unsubscribe {
  const email = normalizeGmail(emailInput);
  const accessId = emailToAccessId(email);
  const path = `parentAccess/${accessId}`;

  return onSnapshot(
    doc(db, 'parentAccess', accessId),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as { name?: string };
        onData({
          name: (data.name || '').trim() || 'Parent',
          accessSynced: true,
        });
      } else {
        onData(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToParentSettings(
  userId: string,
  onData: (settings: ParentSettings | null) => void
): Unsubscribe {
  const path = `parentSettings/${userId}`;
  return onSnapshot(
    doc(db, 'parentSettings', userId),
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data({ serverTimestamps: 'estimate' }) as ParentSettings);
      } else {
        onData(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveParentPasspin(
  userId: string,
  emailInput: string,
  passpin: string
): Promise<void> {
  const path = `parentSettings/${userId}`;
  const trimmedPin = passpin.trim();
  if (!isValidFourDigitCode(trimmedPin)) {
    throw new Error('Parent passpin must be exactly 4 digits (0-9).');
  }

  const parentEmail = normalizeGmail(emailInput);
  if (!parentEmail) {
    throw new Error('Verified parent email is required.');
  }

  try {
    const ref = doc(db, 'parentSettings', userId);
    const existing = await getDoc(ref);
    const passpinSalt = generateSaltHex();
    const passpinHash = await hashFourDigitCode(passpinSalt, trimmedPin);

    if (existing.exists()) {
      await updateDoc(ref, {
        passpinHash,
        passpinSalt,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: userId,
        parentEmail,
        passpinHash,
        passpinSalt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function verifyParentPasspin(
  settings: Pick<ParentSettings, 'passpinHash' | 'passpinSalt'> | null | undefined,
  passpin: string
): Promise<boolean> {
  if (!settings) return false;
  return verifySaltedFourDigitCode(settings.passpinSalt, settings.passpinHash, passpin);
}

export async function ensureParentAccessSynced(
  userId: string,
  parents: ParentAccount[]
): Promise<void> {
  if (parents.length === 0) return;

  for (const parent of parents) {
    const email = normalizeGmail(parent.email);
    if (!GMAIL_REGEX.test(email)) continue;
    const accessId = emailToAccessId(email);
    try {
      const accessRef = doc(db, 'parentAccess', accessId);
      const existing = await getDoc(accessRef);
      if (!existing.exists()) {
        const batch = writeBatch(db);
        batch.set(accessRef, {
          parentId: parent.id,
          name: normalizeParentName(parent.name) || 'Parent',
          email,
          ownerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
    } catch {
      // Ignore individual sync error; will retry on next load
    }
  }
}

export function subscribeToParents(
  userId: string,
  userEmail: string | null | undefined,
  onData: (parents: ParentAccount[]) => void
): Unsubscribe {
  const path = 'parents';
  const ref = collection(db, path);
  const isBootstrapped = normalizeGmail(userEmail || '') === BOOTSTRAPPED_ADMIN_EMAIL;
  const q = isBootstrapped
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
    const accessRef = doc(db, 'parentAccess', emailToAccessId(email));
    const batch = writeBatch(db);
    batch.set(newRef, {
      name,
      email,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(accessRef, {
      parentId: newRef.id,
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
  emailInput: string,
  previousEmailInput?: string
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
    const parentRef = doc(db, 'parents', parentId);
    let previousEmail = previousEmailInput ? normalizeGmail(previousEmailInput) : '';
    let ownerId = '';
    if (!previousEmail) {
      const snap = await getDoc(parentRef);
      if (snap.exists()) {
        const data = snap.data() as { email?: string; ownerId?: string };
        previousEmail = normalizeGmail(data.email || '');
        ownerId = data.ownerId || '';
      }
    } else {
      const snap = await getDoc(parentRef);
      if (snap.exists()) {
        ownerId = ((snap.data() as { ownerId?: string }).ownerId) || '';
      }
    }

    const batch = writeBatch(db);
    batch.update(parentRef, {
      name,
      email,
      updatedAt: serverTimestamp(),
    });

    const newAccessId = emailToAccessId(email);
    const oldAccessId = previousEmail ? emailToAccessId(previousEmail) : '';

    if (oldAccessId && oldAccessId !== newAccessId) {
      batch.delete(doc(db, 'parentAccess', oldAccessId));
    }

    const accessRef = doc(db, 'parentAccess', newAccessId);
    const accessSnap = await getDoc(accessRef);
    if (accessSnap.exists()) {
      batch.update(accessRef, {
        parentId,
        name,
        email,
        updatedAt: serverTimestamp(),
      });
    } else if (ownerId) {
      batch.set(accessRef, {
        parentId,
        name,
        email,
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteParent(parentId: string, emailInput?: string): Promise<void> {
  const path = `parents/${parentId}`;
  try {
    const parentRef = doc(db, 'parents', parentId);
    let email = emailInput ? normalizeGmail(emailInput) : '';
    if (!email) {
      const snap = await getDoc(parentRef);
      if (snap.exists()) {
        email = normalizeGmail(((snap.data() as { email?: string }).email) || '');
      }
    }

    const batch = writeBatch(db);
    batch.delete(parentRef);
    if (email) {
      batch.delete(doc(db, 'parentAccess', emailToAccessId(email)));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
