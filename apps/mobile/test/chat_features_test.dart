import 'package:flutter/cupertino.dart' show CupertinoTextField;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/core/network/video_meta.dart';
import 'package:qchat/features/chats/chat_screen.dart';
import 'package:qchat/features/chats/chat_details_screen.dart';
import 'package:qchat/features/chats/chat_composer.dart';
import 'package:qchat/features/chats/home_screen.dart';
import 'package:qchat/features/chats/message_status.dart';
import 'package:qchat/features/groups/groups_screen.dart';
import 'package:qchat/features/chats/message_attachment.dart';
import 'package:qchat/features/profile/user_profile_screen.dart';
import 'package:qchat/features/moments/moments_screen.dart';
import 'test_app.dart';

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
      child: qchatHarness(screen, locale: const Locale('vi')),
    ),
  );
  await tester.pumpAndSettle();
}

class ForwardClient extends FakeClient {
  static const second = {
    'id': 'chat2',
    'kind': 'DIRECT',
    'sequence': 0,
    'members': [
      {
        'userId': 'self',
        'user': {'id': 'self', 'nickname': 'Tôi'},
      },
      {
        'userId': 'peer2',
        'user': {'id': 'peer2', 'nickname': 'Linh'},
      },
    ],
    'messages': <Map<String, dynamic>>[],
  };

  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/conversations') return [conversation, second];
    return super.get(path, cached: cached);
  }
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

class GroupsClient extends FakeClient {
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/conversations') {
      calls.add(path);
      return [
        {
          'id': 'g1',
          'kind': 'GROUP',
          'title': 'Nhóm cũ',
          'sequence': 1,
          'messages': [],
          'members': [
            {
              'userId': 'self',
              'role': 'MEMBER',
              'readSequence': 1,
              'user': {'id': 'self', 'nickname': 'Tôi'},
            },
          ],
        },
        {
          'id': 'd1',
          'kind': 'DIRECT',
          'sequence': 1,
          'messages': [],
          'members': [
            {
              'userId': 'self',
              'role': 'MEMBER',
              'readSequence': 1,
              'user': {'id': 'self', 'nickname': 'Tôi'},
            },
            {'userId': 'peer', 'role': 'MEMBER', 'readSequence': 0, 'user': peer},
          ],
        },
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
    expect(find.byType(CupertinoTextField), findsNothing);
    expect(
      find.byWidgetPredicate((w) => w is QChatIconButton && w.icon == 'plus'),
      findsNothing,
    );
  });
  testWidgets(
    'three dots opens details and message avatars use media IDs',
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
      expect(find.byType(QChatSwitch), findsOneWidget);
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
    await tester.scrollUntilVisible(
      find.text('Giải tán nhóm'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
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
    expect(find.byKey(const ValueKey('message-action-forward')), findsNothing);
    expect(find.text('Hủy'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
  testWidgets('forward opens the share sheet and sends to a recent chat', (
    tester,
  ) async {
    final client = ForwardClient();
    await mount(tester, client, const ChatScreen(id: 'chat'));
    await tester.longPress(find.text('Xin chào'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('message-action-forward')));
    await tester.pumpAndSettle();

    expect(find.byType(QChatShareSheet), findsOneWidget);
    expect(find.text('Chuyển tiếp đến'), findsOneWidget);
    expect(find.text('Gửi đến Trò chuyện'), findsOneWidget);
    expect(find.text('Sao chép'), findsOneWidget);
    expect(find.text('Báo cáo'), findsOneWidget);

    await tester.tap(find.text('Linh').last);
    await tester.pumpAndSettle();
    expect(client.calls, contains('/messages/message/forward'));
    expect(tester.takeException(), isNull);
  });
  testWidgets('send in chat opens the full picker from the bottom', (
    tester,
  ) async {
    final client = ForwardClient();
    await mount(tester, client, const ChatScreen(id: 'chat'));
    await tester.longPress(find.text('Xin chào'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('message-action-forward')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gửi đến Trò chuyện'));
    await tester.pumpAndSettle();

    expect(find.byType(QChatForwardPicker), findsOneWidget);
    expect(find.text('Chọn cuộc trò chuyện'), findsOneWidget);
    // The chat the user is already in cannot receive the forward.
    expect(find.text('Trò chuyện hiện tại'), findsOneWidget);
    // The picker is a sheet that climbs from the bottom, not a pushed page.
    expect(
      tester.getRect(find.byType(QChatForwardPicker)).top,
      lessThan(120),
    );

    await tester.tap(find.text('Linh').last);
    await tester.pumpAndSettle();
    expect(client.calls, contains('/messages/message/forward'));
    expect(tester.takeException(), isNull);
  });
  testWidgets('message action popover animates and keeps a screen margin', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    await tester.longPress(find.text('Xin chào'));
    await tester.pump();
    // The panel fades and scales in from the bubble instead of popping.
    final fade = tester.widget<FadeTransition>(
      find.byKey(const ValueKey('message-menu-fade')),
    );
    expect(fade.opacity.value, lessThan(1));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FadeTransition>(
            find.byKey(const ValueKey('message-menu-fade')),
          )
          .opacity
          .value,
      1,
    );
    // QChat surface plus a tap region so taps outside dismiss it.
    final panel = tester.widget<Container>(
      find.byKey(const Key('message-action-menu')),
    );
    expect(
      (panel.decoration! as BoxDecoration).color,
      QChatColors.white,
    );
    expect(
      find.byKey(const ValueKey('message-action-tap-region')),
      findsOneWidget,
    );
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
    // The panel keeps a margin from both screen edges.
    final panelRect = tester.getRect(
      find.byKey(const Key('message-action-menu')),
    );
    expect(panelRect.left, greaterThanOrEqualTo(12));
    expect(panelRect.right, lessThanOrEqualTo(screenWidth - 12));
    // Stacked rows, and the bubble stays a small popover, not a sheet.
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
    expect(find.byType(QChatSwipeCell), findsOneWidget);
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
          builder: (_, _) =>
              const ColoredBox(color: QChatColors.background, child: HomeScreen()),
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
        child: qchatRouterHarness(
          routerConfig: router,
          locale: const Locale('vi'),
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
  testWidgets('group chats in Contacts lists the groups already joined', (
    tester,
  ) async {
    final client = GroupsClient();
    String? opened;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) =>
              const ColoredBox(color: QChatColors.background, child: HomeScreen()),
        ),
        GoRoute(path: '/groups', builder: (_, _) => const GroupsScreen()),
        GoRoute(
          path: '/chat/:id',
          builder: (_, s) {
            opened = s.pathParameters['id'];
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
        child: qchatRouterHarness(
          routerConfig: router,
          locale: const Locale('vi'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Danh bạ').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Trò chuyện nhóm'));
    await tester.pumpAndSettle();

    // Only groups this account joined: direct chats stay in the Chats tab.
    expect(find.text('Nhóm cũ'), findsOneWidget);
    expect(find.byType(QChatListTile), findsOneWidget);
    await tester.tap(find.text('Nhóm cũ'));
    await tester.pumpAndSettle();
    expect(opened, 'g1');
    expect(tester.takeException(), isNull);
  });
  testWidgets('the keyboard takes over the attachment panel while it rises', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    addTearDown(tester.view.resetViewInsets);

    // The keyboard has been up once, so the composer knows where it settles.
    // That height is the target the band aims at when the panel steps aside.
    tester.view.viewInsets = const FakeViewPadding(bottom: 200);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    tester.view.viewInsets = FakeViewPadding.zero;
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('chat-plus')));
    await tester.pumpAndSettle();
    final open = tester.getRect(find.byType(ChatInputBar)).bottom;
    expect(find.byType(PageView), findsOneWidget);

    // Tapping "+" again asks for the keyboard to replace the panel.
    await tester.tap(find.byKey(const ValueKey('chat-plus')));
    await tester.pump(); // the tap's focus request lands this frame

    // The keyboard rises over the panel, frame by frame. The panel must start
    // sliding away on the first frame, so the bar is already on its way down
    // while the keyboard is still rising, not after it has settled.
    for (final bottom in [40.0, 90.0, 140.0, 200.0]) {
      tester.view.viewInsets = FakeViewPadding(bottom: bottom);
      await tester.pump(const Duration(milliseconds: 25));
    }
    final middle = tester.getRect(find.byType(ChatInputBar)).bottom;
    // The panel is still in the tree, sliding down behind the keyboard.
    expect(find.byType(PageView), findsOneWidget);
    await tester.pumpAndSettle();
    final done = tester.getRect(find.byType(ChatInputBar)).bottom;

    // The bar ends lower (the keyboard is shorter than the panel) and was
    // already between the two positions before the keyboard had settled.
    expect(done, greaterThan(open));
    expect(middle, greaterThan(open));
    expect(middle, lessThan(done));
    // Once the keyboard owns the space, the panel is gone from the tree.
    expect(find.byType(PageView), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('a keyboard measured once is ready for the next app start', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    forgetKeyboardRest();
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    addTearDown(tester.view.resetViewInsets);

    tester.view.viewInsets = const FakeViewPadding(bottom: 210);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    final saved = await SharedPreferences.getInstance();
    expect(
      saved.getDouble('chat.keyboardRest'),
      closeTo(210 / tester.view.devicePixelRatio, 0.01),
    );    expect(tester.takeException(), isNull);
  });

  testWidgets('a new app start knows where the keyboard will stop', (
    tester,
  ) async {
    // What the last run left behind: the keyboard's resting height, in logical
    // pixels (the harness mounts at a pixel ratio of 1).
    tester.view.devicePixelRatio = 1;
    SharedPreferences.setMockInitialValues({'chat.keyboardRest': 210.0});
    forgetKeyboardRest();
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('chat-plus')));
    await tester.pumpAndSettle();
    final open = tester.getRect(find.byType(ChatInputBar)).bottom;
    expect(find.byType(PageView), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('chat-plus')));
    await tester.pump();
    tester.view.viewInsets = const FakeViewPadding(bottom: 210);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40));

    // The bar is already sliding on the first keyboard frame: nothing waits for
    // the keyboard to settle before the panel steps out of the way.
    final sliding = tester.getRect(find.byType(ChatInputBar)).bottom;
    expect(sliding, greaterThan(open));

    await tester.pumpAndSettle();
    final done = tester.getRect(find.byType(ChatInputBar)).bottom;
    // The keyboard is 210 px, the panel 250: the bar ends 40 px lower, and it
    // was already between the two positions before the keyboard had settled.
    expect(done, closeTo(open + 40, 0.5));
    expect(done, greaterThan(sliding));
    expect(find.byType(PageView), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('only a chat wallpaper puts a plate behind the status', (
    tester,
  ) async {
    void retry() {}
    await mount(
      tester,
      FakeClient(),
      MessageStatus(status: 'sent', onRetry: retry),
    );
    expect(find.text('Đã gửi'), findsOneWidget);
    expect(find.byType(WallpaperPlate), findsNothing);

    // Over a wallpaper the same label gets a light plate so it stays readable.
    await mount(
      tester,
      FakeClient(),
      MessageStatus(status: 'sent', onRetry: retry, plated: true),
    );
    expect(find.byType(WallpaperPlate), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('the composer stays on the keyboard edge until it is gone', (
    tester,
  ) async {
    await mount(tester, FakeClient(), const ChatScreen(id: 'chat'));
    addTearDown(tester.view.resetViewInsets);
    final closed = tester.getRect(find.byType(ChatInputBar)).bottom;

    tester.view.viewInsets = const FakeViewPadding(bottom: 220);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(
      tester.getRect(find.byType(ChatInputBar)).bottom,
      closeTo(closed - 220, .5),
    );

    // Closing the keyboard is the same story: on every frame the bar sits on
    // the keyboard's edge, including the frame where the keyboard has just
    // gone. Animating that last frame glides the bar down for another beat and
    // reads as a jolt.
    for (final bottom in [170.0, 120.0, 60.0, 0.0]) {
      tester.view.viewInsets = FakeViewPadding(bottom: bottom);
      await tester.pump(const Duration(milliseconds: 16));
      expect(
        tester.getRect(find.byType(ChatInputBar)).bottom,
        closeTo(closed - bottom, .5),
        reason: 'keyboard at $bottom',
      );
    }
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




