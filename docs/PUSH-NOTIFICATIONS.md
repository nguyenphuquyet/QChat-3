# Push notifications (Firebase Cloud Messaging)

QChat uses FCM for new-message notifications on Android and iOS. The code is
already wired; only the Firebase project files are missing, because they belong
to one project and are not in the repository.

Without those files everything still builds and runs: `PushNotifications.start`
treats a failed `Firebase.initializeApp` as "not configured" and the server sends
no push when no service account is set. Adding the files below switches it on
with no code change.

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
   `apps/mobile/android/app/google-services.json`.
   `apps/mobile/android/app/google-services.json.example` shows the shape of the
   file; the real one is git-ignored.
4. Build and run. The Gradle plugin is applied only when the file exists
   (`android/app/build.gradle.kts`), so a checkout without it still builds.

The app asks for `POST_NOTIFICATIONS` on Android 13+ on first launch.

## Server

Download a service account key from **Project settings → Service accounts** and
either paste the JSON into `FIREBASE_SERVICE_ACCOUNT` or point
`FIREBASE_SERVICE_ACCOUNT_FILE` at it. Both variables are in `.env.example` and
are passed to the `server` and `realtime` containers by `env_file`.

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }
# or
FIREBASE_SERVICE_ACCOUNT_FILE=/run/secrets/qchat-firebase.json
```

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
