import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../network/client.dart';

/// Android channel that both this file and a background FCM notification use.
/// The same id is declared in AndroidManifest.xml as the default channel.
const pushChannelId = 'qchat_messages';

/// Background and terminated messages arrive on their own isolate. A message
/// that carries a `notification` block is drawn by the system, so there is
/// nothing to do here; the handler exists so data-only messages still reach a
/// registered entry point without throwing.
@pragma('vm:entry-point')
Future<void> qchatBackgroundPush(RemoteMessage message) async {}

/// Registers this device for Firebase Cloud Messaging and turns a foreground
/// message into a system notification.
///
/// Firebase reads its project configuration from `google-services.json` on
/// Android and `GoogleService-Info.plist` on iOS. Neither file is in the
/// repository, so [start] treats a failed [Firebase.initializeApp] as "push is
/// not configured yet": the app still runs, and dropping the file in is the
/// only step left to switch push on.
class PushNotifications {
  PushNotifications(this.client);

  final QChatClient client;
  final _local = FlutterLocalNotificationsPlugin();
  final _subscriptions = <StreamSubscription<dynamic>>[];

  /// Called with a conversation id when the user taps a notification.
  ValueChanged<String>? openConversation;

  /// Whether [conversationId] is already on screen. A message for the chat the
  /// user is reading is visible in the list and does not interrupt.
  bool Function(String conversationId)? isConversationOpen;

  String? _token;
  String? _registered;
  bool _started = false;
  bool _ready = false;

  /// Listens to the session so the token is registered once the user signs in.
  void _onSessionChanged() => unawaited(_syncToken());

  Future<void> start() async {
    if (_started) return;
    _started = true;
    if (kIsWeb ||
        !(defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS)) {
      return;
    }
    try {
      await Firebase.initializeApp();
      await _initLocal();
      _ready = true;
      _listen();
      client.session.addListener(_onSessionChanged);
      await _syncToken();
    } catch (error) {
      // No config file, or a build without the native plugin: push stays off
      // and everything else keeps working.
      debugPrint('Push notifications are not configured: $error');
    }
  }

  Future<void> _initLocal() async {
    const android = AndroidInitializationSettings('ic_stat_qchat');
    const darwin = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _local.initialize(
      settings: const InitializationSettings(android: android, iOS: darwin),
      onDidReceiveNotificationResponse: (response) {
        final id = response.payload;
        if (id != null && id.isNotEmpty) openConversation?.call(id);
      },
    );
    await _android?.createNotificationChannel(
      const AndroidNotificationChannel(
        pushChannelId,
        'Tin nhắn',
        description: 'Tin nhắn mới trong QChat',
        importance: Importance.high,
      ),
    );
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    // Android 13 asks for POST_NOTIFICATIONS separately from FCM's own prompt.
    await _android?.requestNotificationsPermission();
  }

  AndroidFlutterLocalNotificationsPlugin? get _android => _local
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  void _listen() {
    FirebaseMessaging.onBackgroundMessage(qchatBackgroundPush);
    // The app draws its own notification in the foreground, on both platforms,
    // so the OS must not add a second banner on top of it.
    unawaited(
      FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: true,
        sound: false,
      ),
    );
    _subscriptions.add(
      // The installation id is what firebase-admin v14 sends to.
      FirebaseMessaging.instance.onRegistered.listen((token) {
        _token = token;
        unawaited(_register(token));
      }),
    );
    _subscriptions.add(FirebaseMessaging.onMessage.listen(_show));
    _subscriptions.add(FirebaseMessaging.onMessageOpenedApp.listen(_open));
    unawaited(_openInitial());
  }

  /// A notification tap that launched the app from a terminated state.
  Future<void> _openInitial() async {
    try {
      final message = await FirebaseMessaging.instance.getInitialMessage();
      if (message != null) _open(message);
    } catch (_) {
      // Not configured; nothing was launched from a notification.
    }
  }

  Future<void> _syncToken() async {
    if (!_ready || client.session.value == null) return;
    try {
      final token = _token ?? await _installationId();
      if (token != null) await _register(token);
    } catch (_) {
      // Offline or permission refused; a later session/token event retries.
    }
  }

  /// Asks FCM for this install's id. `register` announces it through
  /// `onRegistered`, which is the supported read path since firebase_messaging
  /// 17; the deprecated getter is only the fallback for an engine that never
  /// announces an id that is already cached.
  Future<String?> _installationId() async {
    try {
      final registered = FirebaseMessaging.instance.onRegistered.first
          .timeout(const Duration(seconds: 8));
      await FirebaseMessaging.instance.register();
      return await registered;
    } catch (_) {
      // ignore: deprecated_member_use
      return FirebaseMessaging.instance.getToken();
    }
  }

  Future<void> _register(String token) async {
    final userId = client.session.value;
    if (userId == null || client.token == null) return;
    final marker = '$userId:$token';
    if (_registered == marker) return;
    try {
      await client.post('/devices', {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
      });
      _registered = marker;
    } catch (_) {
      // The request is retried the next time the token or session changes.
    }
  }

  Future<void> _show(RemoteMessage message) async {
    final id = message.data['conversationId'];
    if (id is String && (isConversationOpen?.call(id) ?? false)) return;
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'];
    final body = notification?.body ?? message.data['body'];
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }
    await _local.show(
      id: id is String ? id.hashCode & 0x7fffffff : 0,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          pushChannelId,
          'Tin nhắn',
          channelDescription: 'Tin nhắn mới trong QChat',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_stat_qchat',
          color: Color(0xff07c160),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: id is String ? id : null,
    );
  }

  void _open(RemoteMessage message) {
    final id = message.data['conversationId'];
    if (id is String && id.isNotEmpty) openConversation?.call(id);
  }

  /// Drops this device from the signed-in account. Called before the session is
  /// cleared, while the request can still be authenticated.
  Future<void> unregister() async {
    final token = _token;
    _registered = null;
    if (!_ready || token == null || client.token == null) return;
    try {
      await client.delete('/devices', {'token': token});
    } catch (_) {
      // The token is reassigned on the next sign-in anyway.
    }
  }

  void dispose() {
    client.session.removeListener(_onSessionChanged);
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    _subscriptions.clear();
  }
}
