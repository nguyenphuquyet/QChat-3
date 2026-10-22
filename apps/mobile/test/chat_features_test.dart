import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/design_system/qchat_theme.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/core/network/video_meta.dart';
import 'package:qchat/features/chats/chat_screen.dart';
import 'package:qchat/features/chats/chat_details_screen.dart';
import 'package:qchat/features/chats/home_screen.dart';
import 'package:qchat/features/chats/message_attachment.dart';
import 'package:qchat/features/profile/user_profile_screen.dart';
import 'package:qchat/features/moments/moments_screen.dart';

class FakeClient extends QChatClient {
  FakeClient({this.isFriend = false, this.group = false, this.owner = false}) {
    userId = 'self';
  }
  final bool isFriend, group, owner;
  final calls = <String>[];
  final peer = {
    'id': 'peer',
    'nickname': 'Quyết',
    'qchatId': 'quyetguic',
    'avatarId': 'photo',
  };
  Map<String, dynamic> get conversation => {
    'id': 'chat',
    'kind': group ? 'GROUP' : 'DIRECT',
    'title': 'Nhóm thử',
    'sequence': 1,
    'members': [
      {
        'userId': 'self',
        'role': owner ? 'OWNER' : 'MEMBER',
        'readSequence': 1,
        'user': {'id': 'self', 'nickname': 'Tôi', 'avatarId': 'my-photo'},
      },
      {'userId': 'peer', 'role': 'MEMBER', 'readSequence': 0, 'user': peer},
    ],
    'messages': rows,
  };
  List<Map<String, dynamic>> get rows => [
    {
      'id': 'message',
      'clientId': 'client',
      'conversationId': 'chat',
      'senderId': 'self',
      'text': 'Xin chào',
      'sequence': 1,
      'createdAt': DateTime.now().toIso8601String(),
    },
  ];
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    calls.add(path);
    if (path == '/users/peer') return peer;
    if (path.startsWith('/users/search')) return [peer];
    if (path == '/friends') {
      return isFriend
          ? [
              {'friendId': 'peer', 'friend': peer},
            ]
          : [];
    }
    if (path == '/conversations') return [conversation];
    if (path == '/conversations/chat') return conversation;
    if (path == '/users/me') {
      return {'id': 'self', 'nickname': 'Tôi', 'qchatId': 'me'};
    }
    if (path.contains('/messages?')) return rows;
    if (path.contains('/media/')) throw Exception('offline photo');
    return [];
  }

  @override
  Future<List<Map<String, dynamic>>> messages(String id) async => rows;
  @override
  Future<dynamic> post(String path, Object data) async {
    calls.add(path);
    return {'id': 'chat'};
  }
}

Future<void> mount(
  WidgetTester tester,
  FakeClient client,
  Widget screen,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [clientProvider.overrideWithValue(client)],
      child: MaterialApp(
        locale: const Locale('vi'),
        supportedLocales: const [Locale('vi')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        theme: qchatTheme(false),
        home: Material(child: screen),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class RequestsClient extends FakeClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/friends/requests') {
      calls.add(path);
      return [
        {'id': 'request-1', 'sender': peer},
        {'id': 'request-2', 'sender': peer},
      ];
    }
    return super.get(path, cached: cached);
  }
}

class MomentsClient extends FakeClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path.startsWith('/moments')) {
      calls.add(path);
      return [
        {
          'id': 'post',
          'authorId': 'peer',
          'author': peer,
          'text': 'A moment',
          'createdAt': '2026-10-21T00:00:00Z',
          'media': [],
          'likes': [],
          'comments': [
            {'text': 'Legacy comment'},
          ],
        },
      ];
    }
    return super.get(path, cached: cached);
  }
}

void main() {
  testWidgets('friend moments request only that author and hide comments', (
    tester,
  ) async {
    final client = MomentsClient();
    await mount(tester, client, const MomentsScreen(authorId: 'peer'));
    expect(client.calls, contains('/moments?authorId=peer'));
    expect(find.text('A moment'), findsOneWidget);
    expect(find.text('Legacy comment'), findsNothing);
    expect(find.byType(TInput), findsNothing);
    expect(
      find.byWidgetPredicate((w) => w is QChatIconButton && w.icon == 'plus'),
      findsNothing,
    );
  });
  testWidgets(
    'three dots opens TDesign details and message avatars use media IDs',
    (tester) async {
      final client = FakeClient();
      await mount(tester, client, const ChatScreen(id: 'chat'));
      expect(find.byType(UserAvatar), findsOneWidget);
      expect(tester.widget<MediaImage>(find.byType(MediaImage)).id, 'my-photo');
      await tester.tap(
        find.byWidgetPredicate((w) => w is QChatIconButton && w.icon == 'more'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chi tiết'), findsOneWidget);
      expect(find.byType(TSwitch), findsOneWidget);
      expect(find.text('Xóa lịch sử trò chuyện'), findsOneWidget);
      expect(find.text('Giải tán nhóm'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('QR lookup shows Add friend and sends request only when tapped', (
    tester,
  ) async {
    final client = FakeClient();
    await mount(tester, client, const UserProfileScreen(qchatId: 'quyetguic'));
    expect(client.calls, contains('/users/search?q=quyetguic'));
    expect(find.text('Thêm bạn'), findsOneWidget);
    expect(client.calls, isNot(contains('/friends/requests')));
    await tester.tap(find.text('Thêm bạn'));
    await tester.pumpAndSettle();
    expect(client.calls, contains('/friends/requests'));
    expect(find.text('Đã gửi lời mời'), findsOneWidget);
  });
  testWidgets('friend profile shows message and both call actions', (
    tester,
  ) async {
    await mount(
      tester,
      FakeClient(isFriend: true),
      const UserProfileScreen(id: 'peer'),
    );
    expect(find.text('Nhắn tin'), findsOneWidget);
    expect(find.text('Gọi thoại'), findsOneWidget);
    expect(find.text('Gọi video'), findsOneWidget);
    expect(find.text('Thêm bạn'), findsNothing);
    expect(find.text('QChat ID: quyetguic'), findsOneWidget);
    expect(find.text('Khoảnh khắc'), findsOneWidget);
  });
  testWidgets('only group owner sees dissolve action', (tester) async {
    await mount(
      tester,
      FakeClient(group: true, owner: true),
      const ChatDetailsScreen(id: 'chat'),
    );
    expect(find.text('Thành viên'), findsOneWidget);
    expect(find.text('Giải tán nhóm'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await mount(
      tester,
      FakeClient(group: true),
      const ChatDetailsScreen(id: 'chat'),
    );
    expect(find.text('Thành viên'), findsOneWidget);
    expect(find.text('Giải tán nhóm'), findsNothing);
  });
  testWidgets('long press opens the message action menu and selection', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    await tester.longPress(find.text('Xin chào'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('message-action-quoteMessage')),
      findsOneWidget,
    );
    expect(find.text('Chuyển tiếp'), findsOneWidget);
    expect(find.text('Trích dẫn'), findsOneWidget);
    await tester.tap(find.text('Chọn'));
    await tester.pumpAndSettle();
    // The menu closes; the remaining "Chuyển tiếp" is the selection bar.
    expect(
      find.byKey(const ValueKey('message-action-forward')),
      findsNothing,
    );
    expect(find.text('Hủy'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
  testWidgets('message action popover stays compact next to the bubble', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    await tester.longPress(find.text('Xin chào'));
    await tester.pumpAndSettle();
    Rect action(String key) =>
        tester.getRect(find.byKey(ValueKey('message-action-$key')));
    final first = action('quoteMessage');
    final last = action('delete');
    final screenWidth =
        tester.view.physicalSize.width / tester.view.devicePixelRatio;
    final screenHeight =
        tester.view.physicalSize.height / tester.view.devicePixelRatio;
    // Rows share one narrow column instead of spreading into a grid.
    for (final key in [
      'copy',
      'forward',
      'favorites',
      'search',
      'selectMessages',
      'delete',
    ]) {
      expect(action(key).left, closeTo(first.left, 0.5));
      expect(action(key).width, closeTo(first.width, 0.5));
    }
    expect(first.width, lessThanOrEqualTo(232));
    expect(first.left, greaterThanOrEqualTo(0));
    expect(first.right, lessThanOrEqualTo(screenWidth));
    // Stacked rows, and the menu stays a small popover, not a sheet.
    expect(action('copy').top, greaterThan(first.top));
    expect(last.top, greaterThan(action('search').top));
    expect(last.bottom - first.top, lessThan(screenHeight * .7));
    expect(tester.takeException(), isNull);
  });
  testWidgets('recall keeps the conversation loaded', (tester) async {
    final client = FakeClient();
    await mount(tester, client, const ChatScreen(id: 'chat'));
    final loads = client.calls.where((p) => p == '/conversations/chat').length;
    await tester.longPress(find.text('Xin chào'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('message-action-recall')));
    await tester.pumpAndSettle();
    expect(client.calls, contains('/messages/message/recall'));
    expect(client.calls.where((p) => p == '/conversations/chat').length, loads);
    expect(find.text('Xin chào'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('video preview keeps the real shape while it loads', (
    tester,
  ) async {
    addTearDown(VideoMetaCache.clear);
    VideoMetaCache.remember(
      'landscape',
      const VideoMeta(width: 1920, height: 1080),
    );
    VideoMetaCache.remember(
      'portrait',
      const VideoMeta(width: 1080, height: 1920),
    );
    await mount(
      tester,
      FakeClient(),
      const Align(
        alignment: Alignment.topLeft,
        child: MessageAttachment(
          key: ValueKey('landscape'),
          id: 'landscape',
          kind: 'VIDEO',
          name: 'clip.mp4',
        ),
      ),
    );
    final landscape = tester.getSize(
      find.byKey(const ValueKey('video-frame-landscape')),
    );
    expect(landscape.width, greaterThan(landscape.height));
    expect(landscape.width, closeTo(210, 0.1));
    expect(landscape.height, closeTo(210 * 9 / 16, 0.1));

    await mount(
      tester,
      FakeClient(),
      const Align(
        alignment: Alignment.topLeft,
        child: MessageAttachment(
          key: ValueKey('portrait'),
          id: 'portrait',
          kind: 'VIDEO',
          name: 'clip.mp4',
        ),
      ),
    );
    final portrait = tester.getSize(
      find.byKey(const ValueKey('video-frame-portrait')),
    );
    expect(portrait.height, greaterThan(portrait.width));
    expect(portrait.height, closeTo(260, 0.1));
    expect(tester.takeException(), isNull);
  });
  testWidgets('contacts mark how many friend requests are waiting', (
    tester,
  ) async {
    final client = RequestsClient();
    await mount(tester, client, const HomeScreen());
    await tester.tap(find.text('Danh bạ').last);
    await tester.pumpAndSettle();
    expect(client.calls, contains('/friends/requests'));
    final badge = tester.widget<QChatUnreadBadge>(
      find.byType(QChatUnreadBadge),
    );
    expect(badge.count, 2);
    // The count sits in a round dot, not a stretched rectangle.
    final size = tester.getSize(find.byType(QChatUnreadBadge));
    expect(size.width, closeTo(size.height, 0.1));
    expect(tester.takeException(), isNull);
  });
  testWidgets('conversation swipe exposes unread hide and delete', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const HomeScreen());
    await tester.drag(
      find.byType(QChatConversationTile),
      const Offset(-300, 0),
    );
    await tester.pumpAndSettle();
    expect(find.byType(TSwipeCellAction), findsNWidgets(3));
    expect(find.text('Đánh dấu chưa đọc'), findsOneWidget);
    expect(find.text('Ẩn'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Me opens only the moments I posted', (tester) async {
    final client = FakeClient();
    String? opened;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Material(child: HomeScreen()),
        ),
        GoRoute(
          path: '/moments',
          builder: (_, s) {
            opened = s.uri.toString();
            return const SizedBox();
          },
        ),
      ],
    );
    addTearDown(router.dispose);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: MaterialApp.router(
          locale: const Locale('vi'),
          supportedLocales: const [Locale('vi')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          theme: qchatTheme(false),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tôi').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Khoảnh khắc'));
    await tester.pumpAndSettle();
    expect(opened, '/moments?authorId=self');
    expect(tester.takeException(), isNull);
  });
  test(
    'cleared messages cannot return from confirmed cache and newer messages survive',
    () async {
      final client = FakeClient();
      client.confirmed['old'] = {
        'id': 'old',
        'clientId': 'old',
        'conversationId': 'chat',
        'sequence': 1,
      };
      client.confirmed['new'] = {
        'id': 'new',
        'clientId': 'new',
        'conversationId': 'chat',
        'sequence': 3,
      };
      await client.applyClearedSequence('chat', 2);
      await client.applyClearedSequence('chat', 0);
      expect(client.visibleMessages('chat', client.rows).map((m) => m['id']), [
        'new',
      ]);
    },
  );
}
