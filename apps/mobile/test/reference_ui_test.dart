import 'package:flutter_test/flutter_test.dart';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/chats/home_screen.dart';
import 'package:qchat/features/chats/chat_screen.dart';
import 'package:qchat/features/profile/profile_screen.dart';
import 'package:qchat/features/settings/settings_screen.dart';
import 'package:qchat/features/contacts/friends_screen.dart';
import 'test_app.dart';

class PreviewClient extends QChatClient {
  final today = DateTime.now();
  PreviewClient() {
    userId = 'self';
  }
  final user = <String, dynamic>{
    'id': 'self',
    'nickname': 'Quyết',
    'qchatId': 'quyet_preview',
    'bio': '',
    'previewPush': true,
    'allowRequests': true,
  };
  Map<String, dynamic> get chat => {
    'id': 'chat',
    'kind': 'DIRECT',
    'sequence': 1,
    'members': [
      {
        'userId': 'self',
        'user': user,
        'readSequence': 1,
        'deliveredSequence': 1,
      },
      {
        'userId': 'peer',
        'user': {'nickname': 'Linh'},
        'readSequence': 0,
        'deliveredSequence': 1,
      },
    ],
    'messages': rows,
  };
  List<Map<String, dynamic>> get rows => [
    {
      'id': 'msg',
      'clientId': 'client-msg',
      'conversationId': 'chat',
      'senderId': 'self',
      'sequence': 1,
      'kind': 'TEXT',
      'text': 'hi',
      'createdAt': DateTime(
        today.year,
        today.month,
        today.day,
        12,
        45,
      ).toIso8601String(),
    },
  ];
  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/conversations') return [chat];
    if (path == '/conversations/chat') return chat;
    if (path == '/friends') {
      return [
        {
          'friend': {
            'id': 'peer',
            'nickname': 'Linh',
            'qchatId': 'linh_preview',
          },
          'remark': '',
        },
      ];
    }
    if (path == '/friends/requests') return [];
    return user;
  }

  @override
  Future<List<Map<String, dynamic>>> messages(String id) async => rows;
  @override
  Future<dynamic> post(String path, Object data) async => {};
}

void main() {
  setUpAll(() async {
    await (FontLoader('packages/cupertino_icons/CupertinoIcons')..addFont(
          rootBundle.load('packages/cupertino_icons/assets/CupertinoIcons.ttf'),
        ))
        .load();
    if (Platform.isWindows) {
      await (FontLoader('Arial')..addFont(
            File(
              'C:/Windows/Fonts/arial.ttf',
            ).readAsBytes().then((b) => ByteData.sublistView(b)),
          ))
          .load();
    }
    await (FontLoader('packages/tdesign_flutter_icons/TIcons')..addFont(
          rootBundle.load('packages/tdesign_flutter_icons/fonts/t.ttf'),
        ))
        .load();
    await (FontLoader('packages/lucide_icons_flutter/Lucide')..addFont(
          rootBundle.load('packages/lucide_icons_flutter/assets/lucide.ttf'),
        ))
        .load();
  });
  testWidgets('reference layouts and attachment panel render at phone width', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final client = PreviewClient();
    const captureKey = Key('capture');
    Future<void> mount(Widget screen) async {
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        ProviderScope(
          overrides: [clientProvider.overrideWithValue(client)],
          child: qchatHarness(
            RepaintBoundary(key: captureKey, child: screen),
            locale: const Locale('vi'),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> snapshot(String name) async {
      expect(tester.takeException(), isNull);
      if (Platform.isWindows) {
        await expectLater(
          find.byKey(captureKey),
          matchesGoldenFile('goldens/$name.png'),
        );
      }
    }

    await mount(const HomeScreen());
    await snapshot('chats');
    await tester.tap(
      find.byWidgetPredicate((w) => w is QChatIconButton && w.icon == 'plus'),
    );
    await tester.pumpAndSettle();
    expect(find.text('Trò chuyện mới'), findsOneWidget);
    // Dialog is rendered by the root overlay, outside the screen boundary.
    await tester.tapAt(const Offset(30, 400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Danh bạ').last);
    await tester.pumpAndSettle();
    await snapshot('contacts');
    await tester.tap(find.text('Khám phá').last);
    await tester.pumpAndSettle();
    await snapshot('discover');
    await tester.tap(find.text('Tôi').last);
    await tester.pumpAndSettle();
    await snapshot('me');
    await mount(const SettingsScreen());
    await snapshot('settings');
    await mount(const ProfileScreen());
    await snapshot('profile');
    await mount(const FriendsScreen());
    await snapshot('add-friend');
    await mount(const ChatScreen(id: 'chat'));
    await snapshot('conversation');
    await tester.tap(find.byKey(const ValueKey('chat-plus')));
    await tester.pumpAndSettle();
    expect(find.text('Vị trí'), findsOneWidget);
    // TODO: bật lại khi có tính năng Thẻ liên hệ
    // expect(find.text('Thẻ liên hệ'), findsOneWidget);
    await snapshot('attachments');
    await mount(const _ShareSheetPreview());
    await snapshot('share-sheet');
    await mount(const _ForwardPickerPreview());
    await snapshot('forward-picker');
    await mount(const _SendConfirmPreview());
    await snapshot('send-confirm');
    await tester.pumpWidget(const SizedBox());
    await client.changes.close();
    await client.messageChanges.close();
  });
}

class _ShareSheetPreview extends StatelessWidget {
  const _ShareSheetPreview();
  @override
  Widget build(BuildContext c) => Stack(
    children: [
      const Positioned.fill(child: ColoredBox(color: QChatColors.background)),
      Align(
        alignment: Alignment.bottomCenter,
        child: QChatShareSheet(
          title: 'Chuyển tiếp đến',
          targets: const [
            QChatShareTarget(
              id: 'a',
              name: 'Quyết',
              avatar: QChatAvatar('Quyết', size: 66),
            ),
            QChatShareTarget(
              id: 'b',
              name: 'Linh',
              avatar: QChatAvatar('Linh', size: 66),
            ),
          ],
          onAdd: _noop,
          actions: const [
            QChatShareAction(
              icon: 'share',
              label: 'Gửi đến Trò chuyện',
              color: QChatColors.green,
            ),
            QChatShareAction(
              icon: 'favorites',
              label: 'Mục ưa thích',
              color: Color(0xfff0a020),
            ),
            QChatShareAction(
              icon: 'copy',
              label: 'Sao chép',
              color: Color(0xff168fe5),
            ),
            QChatShareAction(
              icon: 'report',
              label: 'Báo cáo',
              color: Color(0xffff9c38),
              badge: 'Mới',
            ),
          ],
        ),
      ),
    ],
  );
}

class _ForwardPickerPreview extends StatelessWidget {
  const _ForwardPickerPreview();
  @override
  Widget build(BuildContext c) => Stack(
    children: [
      const Positioned.fill(child: ColoredBox(color: QChatColors.background)),
      Positioned.fill(
        child: QChatForwardPicker(
          recent: const [
            QChatShareTarget(
              id: 'a',
              name: 'Quyết',
              avatar: QChatAvatar('Quyết', size: 56),
            ),
          ],
          entries: const [
            QChatForwardEntry(
              id: 'a',
              name: 'Quyết',
              avatar: QChatAvatar('Quyết', size: 48),
              note: 'Trò chuyện hiện tại',
              disabled: true,
            ),
            QChatForwardEntry(
              id: 'b',
              name: 'Linh',
              avatar: QChatAvatar('Linh', size: 48),
            ),
            QChatForwardEntry(
              id: 'c',
              name: 'Minh',
              avatar: QChatAvatar('Minh', size: 48),
            ),
          ],
        ),
      ),
    ],
  );
}

/// The send sheet: recipient, preview card, note field and the two buttons.
class _SendConfirmPreview extends StatelessWidget {
  const _SendConfirmPreview();
  @override
  Widget build(BuildContext c) => Stack(
    children: [
      const Positioned.fill(child: ColoredBox(color: QChatColors.background)),
      Positioned.fill(
        child: QChatSendConfirmSheet(
          recipient: const QChatShareTarget(
            id: 'a',
            name: 'Quyết',
            avatar: QChatAvatar('Quyết', size: 56),
          ),
          preview: const QChatSendPreview(
            source: '安徽省科技馆',
            sourceIcon: QChatAvatar('安', size: 16),
            title: '安徽省科技馆',
            image: ColoredBox(color: Color(0xff8899cc)),
            footer: 'Chương trình nhỏ',
          ),
        ),
      ),
    ],
  );
}

void _noop() {}
