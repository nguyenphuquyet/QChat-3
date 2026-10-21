# QChat architecture

Flutter (Android, iOS, web) calls Next.js App Router REST handlers. A standalone Socket.IO process handles authenticated delivery, receipts, typing and WebRTC signaling. Both services use the same PostgreSQL schema and session verifier. Redis backs distributed socket broadcasting and rate limits. S3-compatible storage stays private.

## Trust boundaries

JWT subjects come from verified signatures. Every request checks that its database session remains active and its user is not disabled. Socket events repeat that check. Conversation IDs are checked against membership; callers cannot supply a sender ID. Admin endpoints require the ADMIN role and do not expose message content.

Messages are committed in a serializable transaction with a conversation sequence, a unique `(senderId, clientId)` key and durable outbox records. Retrying the same client ID returns the existing message. The gateway reads the outbox; delivery is at-least-once, so consumers deduplicate by ID. REST pagination remains the source of truth after reconnect. Redis is not the message database.

Flutter stores account-scoped caches and an outbox through Drift/SQLite. The web runner uses the matching SQLite WASM and Drift worker, with OPFS/IndexedDB selected by Drift. Refresh tokens use Flutter Secure Storage; access tokens remain in memory. Browser secure storage does not protect against script compromise; production web hardening remains required.

## Schema decisions

Profile fields are on User. Membership and per-conversation user state share ConversationMember. Read/delivered high-water marks avoid one receipt row per message. Media is normalized and referenced from Message and MomentMedia. UserSession holds device labels; PushDevice holds push addresses. ADMIN role is stored on User. These intentionally combine several models listed separately in the brief.

## Design

QChat uses original line icons, square avatars with 5px corners, thin separators, neutral headers, a four-tab navigation bar and green/white conversation bubbles. TDesign 1.0.0 provides TButton and TInput. MaterialApp is only the Flutter/TDesign compatibility host; default Material or Cupertino navigation, cards, dialogs, and buttons are not used.

## Boundaries still requiring work

See STATUS.md. This is a working source baseline under active implementation, not a production-ready or fully verified messaging product. Do not treat a successful compilation as evidence of push, call, deployment or end-to-end correctness.
