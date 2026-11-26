import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/chats/chat_details_screen.dart';
import 'package:qchat/features/chats/chat_screen.dart';
import 'package:qchat/features/chats/group_members_screen.dart';
import 'chat_features_test.dart' show FakeClient, mount;

class SettingsClient extends FakeClient {
  SettingsClient({this.role = 'OWNER', this.adminCount = 0})
    : super(group: true) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.method == 'PATCH') {
            patches.add(options);
            if (options.path.endsWith('/wallpaper')) {
              color = options.data['wallpaperColor'];
            } else if (options.path.endsWith('/members/peer')) {
              peerRole = options.data['role'];
            }
            handler.resolve(
              Response(requestOptions: options, data: {'ok': true}),
            );
          } else {
            handler.reject(DioException(requestOptions: options));
          }
        },
      ),
    );
  }
  final String role;
  final int adminCount;
  String peerRole = 'MEMBER';
  String? color = '#e5edf5';
  final patches = <RequestOptions>[];
  @override
  Map<String, dynamic> get conversation => {
    ...super.conversation,
    'wallpaperColor': color,
    'wallpaperMediaId': null,
    'members': [
      {
        'userId': 'self',
        'role': role,
        'readSequence': 1,
        'user': {'id': 'self', 'nickname': 'Tôi'},
      },
      {'userId': 'peer', 'role': peerRole, 'user': peer},
      for (var i = 0; i < adminCount; i++)
        {
          'userId': 'admin$i',
          'role': 'ADMIN',
          'user': {'id': 'admin$i', 'nickname': 'Admin $i'},
        },
    ],
  };
}

void main() {
  testWidgets('shared wallpaper refreshes while the conversation is open', (
    tester,
  ) async {
    final client = SettingsClient();
    addTearDown(client.dispose);
    await mount(tester, client, const ChatScreen(id: 'chat'));
    expect(
      tester.widget<QChatPage>(find.byType(QChatPage)).background,
      const Color(0xffe5edf5),
    );
    client.color = '#f5e8e1';
    client.changes.add(null);
    await tester.pumpAndSettle();
    expect(
      tester.widget<QChatPage>(find.byType(QChatPage)).background,
      const Color(0xfff5e8e1),
    );
    client.color = null;
    client.changes.add(null);
    await tester.pumpAndSettle();
    expect(tester.widget<QChatPage>(find.byType(QChatPage)).background, isNull);
  });
  testWidgets('group members cannot open the wallpaper editor', (tester) async {
    final client = SettingsClient(role: 'MEMBER');
    addTearDown(client.dispose);
    await mount(tester, client, const ChatDetailsScreen(id: 'chat'));
    final cell = find.byWidgetPredicate(
      (w) =>
          w is QChatCell &&
          w.subtitle is Text &&
          (w.subtitle as Text).data ==
              'Chỉ chủ nhóm và quản trị viên được đổi hình nền.',
    );
    await tester.scrollUntilVisible(
      cell,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(tester.widget<QChatCell>(cell).onTap, isNull);
  });
  testWidgets('owner can appoint an admin through the member menu', (
    tester,
  ) async {
    final client = SettingsClient();
    addTearDown(client.dispose);
    await mount(
      tester,
      client,
      const GroupMembersScreen(conversationId: 'chat'),
    );
    await tester.tap(find.byWidgetPredicate((w) => w is QChatIconButton && w.label == 'Quản lý thành viên').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bổ nhiệm quản trị viên'));
    await tester.pumpAndSettle();
    expect(client.patches.single.data, {'role': 'ADMIN'});
    expect(client.peerRole, 'ADMIN');
  });
  testWidgets('the fourth admin is blocked before sending a request', (
    tester,
  ) async {
    final client = SettingsClient(adminCount: 3);
    addTearDown(client.dispose);
    await mount(
      tester,
      client,
      const GroupMembersScreen(conversationId: 'chat'),
    );
    await tester.tap(find.byWidgetPredicate((w) => w is QChatIconButton && w.label == 'Quản lý thành viên').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bổ nhiệm quản trị viên'));
    await tester.pumpAndSettle();
    expect(client.patches, isEmpty);
    expect(
      find.text(
        'Nhóm có tối đa 3 quản trị viên được bổ nhiệm, không tính chủ nhóm.',
      ),
      findsOneWidget,
    );
  });
}
