# QChat architecture

Flutter (Android, iOS, web) calls Next.js App Router REST handlers. A standalone Socket.IO process handles authenticated delivery, receipts, typing and WebRTC signaling. Both services use the same PostgreSQL schema and session verifier. Redis backs distributed socket broadcasting and rate limits. S3-compatible storage stays private.

## Trust boundaries

JWT subjects come from verified signatures. Every request checks that its database session remains active and its user is not disabled. Socket events repeat that check. Conversation IDs are checked against membership; callers cannot supply a sender ID. Admin endpoints require the ADMIN role and do not expose message content.

Messages are committed in a serializable transaction with a conversation sequence, a unique `(senderId, clientId)` key and durable outbox records. Retrying the same client ID returns the existing message. The gateway reads the outbox; delivery is at-least-once, so consumers deduplicate by ID. REST pagination remains the source of truth after reconnect. Redis is not the message database.

Flutter stores account-scoped caches and an outbox through Drift/SQLite. The web runner uses the matching SQLite WASM and Drift worker, with OPFS/IndexedDB selected by Drift. Refresh tokens use Flutter Secure Storage; access tokens remain in memory. Browser secure storage does not protect against script compromise; production web hardening remains required.

## Schema decisions

Profile fields are on User. Membership and per-conversation user state share ConversationMember. Read/delivered high-water marks avoid one receipt row per message. Media is normalized and referenced from Message and MomentMedia. UserSession holds device labels; PushDevice holds push addresses. ADMIN role is stored on User. These intentionally combine several models listed separately in the brief.

## Design

QChat uses original line icons, square avatars with 5px corners, thin separators, neutral headers, a four-tab navigation bar and green/white conversation bubbles. Every screen is drawn by the QChat design system in `apps/mobile/lib/core/design_system` on top of a plain `WidgetsApp.router`; there is no `MaterialApp`, no Material theme, and no Material widget in the chat UI. Text fields use `CupertinoTextField`, and navigation uses custom routes, so no Google Material visual language reaches the user. Two exceptions are scoped to one file each. A Mini App frame's leaf controls are drawn by TDesign (`tdesign_flutter`) in `apps/mobile/lib/features/miniapps/qapp/qapp_tdesign.dart`, because the UI belongs to the Mini App author, while overlay motion stays Cupertino. The photo picker is `wechat_assets_picker` in `lib/core/media/media_picker_native.dart`: it is the WeChat-style grid, album switcher and viewer the app has always shown, wrapped in a `Theme` built from `QChatColors` so the palette and light/dark switch stay QChat's, and desktop keeps the QChat-drawn file chooser.

This rule is enforced for contributors and coding agents by `AGENTS.md` and `apps/mobile/AGENTS.md`.

## Boundaries still requiring work

See STATUS.md. This is a working source baseline under active implementation, not a production-ready or fully verified messaging product. Do not treat a successful compilation as evidence of push, call, deployment or end-to-end correctness.
