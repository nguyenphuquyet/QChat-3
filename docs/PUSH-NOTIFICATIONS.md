# Push notifications (Firebase Cloud Messaging)

QChat uses FCM for new-message notifications on Android and iOS. The Android
client config is committed, so a fresh checkout builds with push support; iOS
still needs an Apple developer account for APNs. The server key is not in the
repository (GitHub rejects Google Cloud credentials in a push) and is placed on
the host instead.

The code degrades gracefully: `PushNotifications.start` treats a failed
`Firebase.initializeApp` as "not configured", and the server sends no push when it
cannot find a service account. The app, the API and the realtime worker keep
working either way.

## What is wired

| Piece | Where |
| --- | --- |
| Client registration, foreground banner, tap routing | `apps/mobile/lib/core/notifications/push_notifications.dart` |
| Token upload / removal | `POST /devices`, `DELETE /devices` in `apps/server/src/services/api.ts` |
| Sender | `apps/server/src/services/push.ts`, called by the outbox loop in `apps/realtime/src/index.ts` |
| Android channel and icon | `qchat_messages`, `res/drawable/ic_stat_qchat.xml` |

- The device is registered after sign-in and when the installation id changes.
  Signing out calls `DELETE /devices` before the session is cleared.
- A message is pushed to every member except the sender, and is skipped for a
  muted conversation.
- `previewPush` (Settings → Notifications) decides whether the text of the
  message is shown; when off, the body is `Bạn có tin nhắn mới`.
- Tapping a notification opens `/chat/<conversationId>`.
- A foreground message is drawn with `flutter_local_notifications` on the
  QChat channel, except for the chat currently on screen.

## Android

1. Create a project in the [Firebase console](https://console.firebase.google.com).
2. Add an **Android** app with package name `com.nguyenphuquyet.chat`.
3. Download `google-services.json` and save it as
   `apps/mobile/android/app/google-services.json`. The current test project's
   file is committed, so this step only matters for a different project;
   `google-services.json.example` documents the shape.
4. Build and run. The Gradle plugin is applied when the file exists
   (`android/app/build.gradle.kts`), so a checkout without it still builds.

The app asks for `POST_NOTIFICATIONS` on Android 13+ on first launch.

## Server

The key is resolved in this order:

1. `FIREBASE_SERVICE_ACCOUNT` — the JSON document itself.
2. `FIREBASE_SERVICE_ACCOUNT_FILE` — a path to the JSON.
3. `apps/server/secrets/firebase-service-account.json` — the file on the host.

Both variables are in `.env.example` and are passed to the `server` and
`realtime` containers by `env_file`. Leaving them empty uses the third path.

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }
# or
FIREBASE_SERVICE_ACCOUNT_FILE=/run/secrets/qchat-firebase.json
```

`apps/server/secrets/` is git-ignored: GitHub push protection rejects a service
account JSON as a Google Cloud credential, so it can never be committed. Copy it
to the server once, from **Project settings → Service accounts** in Firebase:

```bash
scp qchat-6dd06-firebase-adminsdk-*.json \
  user@vps:/path/to/QChat-3/apps/server/secrets/firebase-service-account.json
```

Compose builds from that checkout, so `COPY . .` puts the file in the image; if
you rebuild on the VPS the file stays in place. The current key belongs to the
`qchat-6dd06` test project. **For production, create a separate Firebase project
and rotate this test key** in the Firebase console.

The realtime worker is the component that sends the push: it already consumes
each `Outbox` row for `message:new` exactly once. A dead installation id is
deleted from `PushDevice` automatically.

## iOS

iOS needs an Apple developer account, so these steps are documented but not done
yet. Until then the iOS build compiles and runs; it just receives no push.

1. In Xcode → Runner → Signing & Capabilities, pick the team and add:
   - **Push Notifications**
   - **Background Modes → Remote notifications** (the `UIBackgroundModes` entry
     is already in `Info.plist`; the capability adds the APS entitlement).
2. In Firebase, add an **iOS** app with bundle id `com.nguyenphuquyet.chat`, download
   `GoogleService-Info.plist` and save it as
   `apps/mobile/ios/Runner/GoogleService-Info.plist` (git-ignored). Add it to the
   Runner target in Xcode with "Copy items if needed".
3. In Firebase → Project settings → Cloud Messaging, upload the APNs
   authentication key (`.p8`) from the Apple developer portal.
4. `open apps/mobile/ios/Runner.xcworkspace` and build on a real device: the
   simulator cannot receive remote push.

`AppDelegate.swift` sets the notification-centre delegate and keeps Firebase
swizzling enabled (`FirebaseAppDelegateProxyEnabled` in `Info.plist`).
