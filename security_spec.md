# Veloxis Firestore Security Specification (Phase 0)

## Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`settings`, `tests`, `devices`) belongs strictly to the verified authenticated owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
2. `ownerUid` / `uid` inside any document must equal `request.auth.uid` on create and remain immutable on update.
3. All document IDs (`userId`, `settingId`, `testId`, `deviceId`) must pass `^[a-zA-Z0-9_\-]+$` with max length 128.
4. No unverified accounts, no cross-user reads or list queries, and no extra/ghost fields (`keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update).
5. Server timestamps (`request.time`) are enforced on `createdAt` / `updatedAt` fields; `createdAt` is immutable on update.

## Dirty Dozen Adversarial Payloads
1. Unauthenticated read/write to `/users/{uid}/tests/{testId}` -> `PERMISSION_DENIED`.
2. Authenticated user A reading `/users/{uidB}/tests/{testId}` -> `PERMISSION_DENIED`.
3. Authenticated user A listing `/users/{uidB}/tests` -> `PERMISSION_DENIED`.
4. Unverified email user (`email_verified == false`) writing to own `/users/{uid}/tests/{testId}` -> `PERMISSION_DENIED`.
5. Spoofed `ownerUid` (`ownerUid: uidB`) when creating `/users/{uidA}/tests/{testId}` -> `PERMISSION_DENIED`.
6. Ghost/privilege field injection (`isAdmin: true`) on `/users/{uid}` -> `PERMISSION_DENIED`.
7. Oversized `isp` or `serverNode` string (> 120 chars) -> `PERMISSION_DENIED`.
8. Invalid `testId` containing path traversal or > 128 chars -> `PERMISSION_DENIED`.
9. Client-spoofed `createdAt` timestamp instead of `request.time` -> `PERMISSION_DENIED`.
10. Updating immutable `createdAt` or `ownerUid` on an existing `/tests/{testId}` -> `PERMISSION_DENIED`.
11. Negative `downloadMbps` or out-of-range `veloxisScore` (> 100) -> `PERMISSION_DENIED`.
12. Root catch-all read/write on arbitrary `/admin/config` -> `PERMISSION_DENIED`.
