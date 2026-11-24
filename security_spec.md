# Security Specification — Paathshala Studio (Step 1)

## 1. Data Invariants
1. **Identity & Admin Isolation:** Only verified authenticated admins (`director@spmniwas.in` or UID present in `/admins/{uid}`) may create, update, or delete books, chapters, and scanned pages.
2. **Owner Integrity:** Every created `Book`, `Chapter`, and `ScannedPage` must set `ownerId == request.auth.uid`, and `ownerId` is immutable on updates.
3. **Referential Hierarchy (Master Gate):** A `Chapter` cannot exist without an existing parent `Book` (`exists(/books/{bookId})`) and matching `bookId`. A `ScannedPage` cannot exist without an existing parent `Chapter` (`exists(/books/{bookId}/chapters/{chapterId})`) and matching `bookId` / `chapterId`.
4. **Temporal Integrity:** `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on creation and update.
5. **Volumetric & Type Bounds:** All IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), `combinedText <= 80000` chars, `imageDataUrl <= 450000` chars, and `imageDataUrl` must be empty when `keepImage == false`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Book Create:** `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof:** `email == 'director@spmniwas.in'`, `email_verified == false` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Escalation:** Non-admin attempts `setDoc(/admins/{uid}, ...)` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Book:** Create `Book` with extra `isPublished: true` key -> `PERMISSION_DENIED` (`hasOnly` check).
5. **Owner Spoofing on Book:** Create `Book` with `ownerId: 'other-uid'` != `request.auth.uid` -> `PERMISSION_DENIED`.
6. **Backdated Timestamp Attack:** Create `Book` with client-supplied past `createdAt` != `request.time` -> `PERMISSION_DENIED`.
7. **Orphan Chapter Creation:** Create `/books/nonexistent/chapters/ch1` -> `PERMISSION_DENIED` (`exists()` parent check).
8. **Cross-Book Chapter Spoof:** Create `/books/bookA/chapters/ch1` with `data.bookId: 'bookB'` -> `PERMISSION_DENIED`.
9. **Oversized ID Poisoning:** Target `/books/<200-char-id>` -> `PERMISSION_DENIED` (`isValidId()` check).
10. **1MB Document Exhaustion on Page:** `ScannedPage` with `imageDataUrl` > 450000 chars or non-empty `imageDataUrl` when `keepImage == false` -> `PERMISSION_DENIED`.
11. **Immutable `ownerId` Hijack on Update:** Update `Book` attempting to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
12. **Blanket List Scraping by Non-Owner:** Non-admin attempts `list` on `/books` without owning the documents -> `PERMISSION_DENIED`.
