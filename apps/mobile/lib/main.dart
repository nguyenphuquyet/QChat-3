import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/cupertino.dart' show CupertinoPage;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:go_router/go_router.dart';

import 'app/providers.dart';
import 'core/network/connection_banner.dart';
import 'core/design_system/qchat_theme.dart';
import 'core/design_system/components.dart';
import 'core/design_system/reference_widgets.dart';
import 'features/auth/auth_screen.dart';
import 'features/chats/home_screen.dart';
import 'features/chats/chat_screen.dart';
import 'features/chats/media_screen.dart';
import 'features/contacts/friends_screen.dart';
import 'features/groups/group_screen.dart';
import 'features/moments/moments_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/profile/user_profile_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/calls/call_screen.dart';
import 'features/payments/payments_screen.dart';
import 'features/payments/money_screen.dart';
import 'features/payments/balance_screen.dart';
import 'features/payments/wallet_screen.dart';
import 'features/payments/transfer_screen.dart';
import 'features/search/search_screen.dart';

GoRoute qchatRoute({
  required String path,
  required Widget Function(BuildContext, GoRouterState) builder,
}) => GoRoute(
  path: path,
  pageBuilder: (context, state) =>
      CupertinoPage<void>(key: state.pageKey, child: builder(context, state)),
);

/// The image/video viewer moves its media with a shared element (Hero). It must
/// not use the Cupertino slide transition as well, otherwise the slide and the
/// media zoom play on top of each other on open and on dismiss. Only the black
/// backdrop fades, so the media zoom stays the single visible motion.
GoRoute qchatMediaRoute() => GoRoute(
  path: '/media/:id',
  pageBuilder: (context, state) => CustomTransitionPage<void>(
    key: state.pageKey,
    child: MediaScreen(
      id: state.pathParameters['id']!,
      sourceTag: state.extra is String ? state.extra as String : null,
    ),
    transitionDuration: const Duration(milliseconds: 240),
    reverseTransitionDuration: const Duration(milliseconds: 240),
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        FadeTransition(opacity: animation, child: child),
  ),
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }
  runApp(const ProviderScope(child: QChatApp()));
}

class QChatApp extends ConsumerStatefulWidget {
  const QChatApp({super.key});
  @override
  ConsumerState<QChatApp> createState() => _QChatAppState();
}

class _QChatAppState extends ConsumerState<QChatApp> {
  late final GoRouter router;
  @override
  void initState() {
    super.initState();
    router = GoRouter(
      initialLocation: '/login',
      refreshListenable: ref.read(clientProvider).sessionExpired,
      redirect: (_, state) =>
          ref.read(clientProvider).sessionExpired.value &&
              state.uri.path != '/login'
          ? '/login'
          : null,
      routes: [
        qchatRoute(path: '/login', builder: (_, s) => const AuthScreen()),
        qchatRoute(path: '/home', builder: (_, s) => const HomeScreen()),
        qchatRoute(path: '/search', builder: (_, s) => const SearchScreen()),
        qchatRoute(
          path: '/chat/:id',
          builder: (_, s) => ChatScreen(id: s.pathParameters['id']!),
        ),
        qchatRoute(
          path: '/friends',
          builder: (_, s) => FriendsScreen(query: s.uri.queryParameters['q']),
        ),
        qchatRoute(
          path: '/friends/requests',
          builder: (_, s) => const FriendsScreen(requestsOnly: true),
        ),
        qchatRoute(path: '/groups/new', builder: (_, s) => const GroupScreen()),
        qchatRoute(
          path: '/moments',
          builder: (_, s) =>
              MomentsScreen(authorId: s.uri.queryParameters['authorId']),
        ),
        qchatRoute(path: '/profile', builder: (_, s) => const ProfileScreen()),
        qchatRoute(
          path: '/user',
          builder: (_, s) => UserProfileScreen(
            qchatId: s.uri.queryParameters['q'],
            from: s.uri.queryParameters['from'],
          ),
        ),
        qchatRoute(
          path: '/user/:id',
          builder: (_, s) => UserProfileScreen(id: s.pathParameters['id']),
        ),
        qchatRoute(
          path: '/qr',
          builder: (_, s) => const ProfileScreen(qr: true),
        ),
        qchatRoute(path: '/scan', builder: (_, s) => const ScanScreen()),
        qchatRoute(
          path: '/payments',
          builder: (_, s) => const PaymentsScreen(),
        ),
        qchatRoute(
          path: '/payments/money',
          builder: (_, s) => const MoneyScreen(),
        ),
        qchatRoute(
          path: '/payments/balance',
          builder: (_, s) => const BalanceScreen(),
        ),
        qchatRoute(
          path: '/payments/wallet',
          builder: (_, s) => const WalletScreen(),
        ),
        qchatRoute(
          path: '/payments/transfer',
          builder: (_, s) => TransferScreen(
            to: s.uri.queryParameters['to'] ?? '',
            conversationId: s.uri.queryParameters['conversation'],
            redPacket: s.uri.queryParameters['red'] == '1',
          ),
        ),
        qchatRoute(
          path: '/settings',
          builder: (_, s) => const SettingsScreen(),
        ),
        qchatRoute(
          path: '/settings/:kind',
          builder: (_, s) =>
              SettingsDetailScreen(kind: s.pathParameters['kind']!),
        ),
        qchatRoute(
          path: '/feature/:kind',
          builder: (_, s) => FeatureScreen(kind: s.pathParameters['kind']!),
        ),
        qchatRoute(
          path: '/sessions',
          builder: (_, s) => const DataListScreen(kind: 'sessions'),
        ),
        qchatRoute(
          path: '/favorites',
          builder: (_, s) => const DataListScreen(kind: 'favorites'),
        ),
        qchatMediaRoute(),
        qchatRoute(
          path: '/call/:id',
          builder: (_, s) => CallScreen(
            conversationId: s.pathParameters['id']!,
            video: s.uri.queryParameters['video'] == 'true',
          ),
        ),
        qchatRoute(
          path: '/about',
          builder: (c, s) => QChatPage(
            title: 'QChat',
            glassHeader: false,
            leading: QChatIconButton(
              'back',
              label: 'Back',
              onTap: () => c.pop(),
            ),
            child: const Padding(
              padding: EdgeInsets.all(24),
              child: Text(
                'QChat 1.1.0\n\nIndependent messaging software. Messages are stored on your QChat server. This release does not provide end-to-end encryption.\n\nMedia, camera and microphone access require your explicit permission.',
              ),
            ),
          ),
        ),
      ],
    );
    restore();
  }

  Future<void> restore() async {
    try {
      if (await ref.read(clientProvider).restore() && mounted) {
        router.go('/home');
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    final prefs = ref.watch(preferencesProvider);
    return MaterialApp.router(
      title: 'QChat',
      debugShowCheckedModeBanner: false,
      builder: (context, child) => Material(
        type: MaterialType.transparency,
        child: ConnectionBanner(
          client: ref.read(clientProvider),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
      theme: qchatTheme(prefs.dark),
      locale: Locale(prefs.locale),
      supportedLocales: const [Locale('en'), Locale('vi'), Locale('zh')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      routerConfig: router,
    );
  }
}
