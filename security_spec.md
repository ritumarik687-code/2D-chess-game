# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Identity & Email Verification**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
2. **PII Split Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/info` and are only readable/writable by `request.auth.uid == userId`. Public leaderboard profiles in `/users_public/{userId}` never contain email or phone fields.
3. **Path Variable Hardening**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates document IDs via `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **Master Gate Relational Sync**: Access to `/matches/{matchId}/messages/{messageId}` requires fetching `/matches/$(matchId)` via `get()` and verifying the caller is either `whiteUid` or `blackUid` of that parent match.
5. **Terminal State Locking**: Once a `Match` reaches `status == 'finished'` or a `FriendRequest` reaches `status == 'accepted'` or `'declined'`, no further updates are permitted.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`. Immutable fields (`uid`, `whiteUid`, `createdAt`, `fromUid`, `toUid`) cannot be altered during `update`.
7. **Secure List Queries**: Every `allow list` rule enforces constraints against `resource.data` (e.g., `resource.data.elo >= 0` for public leaderboard queries, `resource.data.status in ['waiting', 'active', 'finished']` for matches, or `resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid` for friend requests).

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection (`UserPublic`)**: Adding `"isAdmin": true` to `/users_public/{userId}` -> Rejected by `hasOnly()`.
2. **Identity Spoofing (`UserPublic`)**: Creating `/users_public/victimUid` while authenticated as `attackerUid` -> Rejected by `userId == request.auth.uid && data.uid == request.auth.uid`.
3. **Unverified Email Spoof**: Writing to `/users_public/{userId}` with `email_verified: false` -> Rejected by `isVerifiedUser()`.
4. **PII Leak (`UserPrivate`)**: Authenticated non-owner reading `/users/victimUid/private/info` -> Rejected by `request.auth.uid == userId`.
5. **Value Poisoning (`UserPublic.elo`)**: Updating `elo` to `"999999"` (string) or `999999` (out of range) -> Rejected by `isValidUserPublic(incoming())`.
6. **Timestamp Forgery (`Match.createdAt`)**: Creating a match with a past client timestamp -> Rejected by `incoming().createdAt == request.time`.
7. **Terminal State Resurrection (`Match`)**: Updating a match where `resource.data.status == 'finished'` back to `'active'` -> Rejected by `existing().status != 'finished'`.
8. **Unauthorized Match Move (`Match`)**: A third-party user updating `fen` on an active match -> Rejected because caller is neither `whiteUid` nor `blackUid`.
9. **Orphaned Chat Message (`MatchChatMessage`)**: Writing a message to `/matches/nonExistentMatch/messages/msg1` -> Rejected by parent `exists()` and `get()` check on `/matches/$(matchId)`.
10. **Non-Participant Match Chat (`MatchChatMessage`)**: Spectator posting in `/matches/{matchId}/messages/{messageId}` -> Rejected by parent participant check (`parent.whiteUid == request.auth.uid || parent.blackUid == request.auth.uid`).
11. **Friend Request Self-Acceptance (`FriendRequest`)**: Sender `fromUid` updating `status` from `'pending'` to `'accepted'` -> Rejected because only `toUid` can accept/decline.
12. **ID Poisoning Attack**: Creating `/matches/invalid..id$$` or 500-char ID -> Rejected by `isValidId(matchId)`.
