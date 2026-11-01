import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart' show CupertinoTextField;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/profile/contact_note_screen.dart';
import 'package:qchat/features/profile/contact_settings_screen.dart';
import 'package:qchat/features/profile/user_profile_screen.dart';

import 'test_app.dart';

class ContactClient extends QChatClient {
  ContactClient({this.remark = '', this.isFriend = true}) {
    userId = 'self';
  }
  final String remark;
  final bool isFriend;
  final patches = <String, Object>{};
  final peer = {
    'id': 'peer',
    'nickname': 'Quyết',
    'qchatId': 'quyetguic',
    'avatarId': 'photo',
  };

  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/users/peer') return peer;
    if (path == '/friends') {
      return isFriend
          ? [
              {'friendId': 'peer', 'friend': peer, 'remark': remark},
            ]
          : [];
    }
    if (path.startsWith('/moments')) return [];
    if (path == '/users/me') {
      return {'id': 'self', 'nickname': 'Tôi', 'qchatId': 'me'};
    }
    return [];
  }

  @override
  Future<dynamic> patch(String path, Object data) async {
    patches[path] = data;
    return {'ok': true};
  }
}

/// Records the calls the contact controls send straight through `dio`, such as
/// the block toggle and the DELETE that removes the friendship.
class _RecordingTransport implements HttpClientAdapter {
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    calls.add('${options.method} ${options.path}');
    return ResponseBody.fromString(
      '',
      204,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Future<void> mount(
  WidgetTester tester,
  ContactClient client,
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

Future<void> mountRouter(
  WidgetTester tester,
  ContactClient client,
  GoRouter router,
) async {
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
}

GoRouter profileRouter(String start) => GoRouter(
  initialLocation: start,
  routes: [
    GoRoute(
      path: '/user/:id',
      builder: (_, s) => UserProfileScreen(id: s.pathParameters['id']),
    ),
    GoRoute(
      path: '/user/:id/note',
      builder: (_, s) => ContactNoteScreen(userId: s.pathParameters['id']!),
    ),
    GoRoute(
      path: '/user/:id/settings',
      builder: (_, s) => ContactSettingsScreen(userId: s.pathParameters['id']!),
    ),
  ],
);

void main() {
  testWidgets('the note page loads the saved alias and saves a new one', (
    tester,
  ) async {
    final client = ContactClient(remark: 'Sếp');
    await mount(tester, client, const ContactNoteScreen(userId: 'peer'));

    final field = find.byKey(const ValueKey('contact-note-field'));
    expect(field, findsOneWidget);
    expect(find.text('Sếp'), findsOneWidget);

    // Nothing changed yet, so "Done" must not send anything.
    await tester.tap(find.byKey(const ValueKey('contact-note-done')));
    await tester.pump();
    expect(client.patches, isEmpty);

    await tester.enterText(find.byType(CupertinoTextField), 'Ông chủ');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('contact-note-done')));
    await tester.pumpAndSettle();

    expect(client.patches['/friends/peer'], {'remark': 'Ông chủ'});
  });

  testWidgets('the nickname under the field fills the alias', (tester) async {
    final client = ContactClient();
    await mount(tester, client, const ContactNoteScreen(userId: 'peer'));

    await tester.tap(find.byKey(const ValueKey('contact-note-nickname')));
    await tester.pump();
    expect(find.text('Quyết'), findsWidgets);

    await tester.tap(find.byKey(const ValueKey('contact-note-done')));
    await tester.pumpAndSettle();
    expect(client.patches['/friends/peer'], {'remark': 'Quyết'});
  });

  testWidgets('the profile shows the alias and both contact controls', (
    tester,
  ) async {
    await mount(
      tester,
      ContactClient(remark: 'Sếp'),
      const UserProfileScreen(id: 'peer'),
    );

    expect(find.text('Sếp'), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-note')), findsOneWidget);
    expect(find.byKey(const ValueKey('profile-more')), findsOneWidget);
    // Deleting a contact lives in the three dots now, not on the profile.
    expect(find.text('Xóa bạn bè'), findsNothing);
  });

  testWidgets('a stranger profile has neither contact control', (tester) async {
    await mount(
      tester,
      ContactClient(isFriend: false),
      const UserProfileScreen(id: 'peer'),
    );

    expect(find.byKey(const ValueKey('profile-note')), findsNothing);
    expect(find.byKey(const ValueKey('profile-more')), findsNothing);
  });

  testWidgets('the people-and-pencil control opens the note page', (
    tester,
  ) async {
    await mountRouter(
      tester,
      ContactClient(remark: 'Sếp'),
      profileRouter('/user/peer'),
    );

    await tester.tap(find.byKey(const ValueKey('profile-note')));
    await tester.pumpAndSettle();
    expect(find.text('Bí danh'), findsOneWidget);
    expect(find.byKey(const ValueKey('contact-note-field')), findsOneWidget);
  });

  testWidgets('the three dots open the contact settings', (tester) async {
    await mountRouter(
      tester,
      ContactClient(remark: 'Sếp'),
      profileRouter('/user/peer'),
    );

    await tester.tap(find.byKey(const ValueKey('profile-more')));
    await tester.pumpAndSettle();
    expect(find.text('Chặn'), findsOneWidget);
    expect(find.text('Xóa số liên lạc'), findsOneWidget);
  });

  testWidgets('the block switch blocks and unblocks the contact', (
    tester,
  ) async {
    final client = ContactClient(remark: 'Sếp');
    final transport = _RecordingTransport();
    client.dio.httpClientAdapter = transport;
    await mount(tester, client, const ContactSettingsScreen(userId: 'peer'));

    final toggle = find.byKey(const ValueKey('contact-settings-block'));
    expect(toggle, findsOneWidget);

    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(transport.calls, ['POST /blocks']);

    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(transport.calls.last, 'DELETE /blocks/peer');
  });

  testWidgets('deleting the contact confirms first and removes the friend', (
    tester,
  ) async {
    final client = ContactClient(remark: 'Sếp');
    final transport = _RecordingTransport();
    client.dio.httpClientAdapter = transport;
    await mount(tester, client, const ContactSettingsScreen(userId: 'peer'));

    await tester.tap(find.byKey(const ValueKey('contact-settings-delete')));
    await tester.pumpAndSettle();
    expect(transport.calls, isEmpty);

    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    expect(transport.calls, ['DELETE /friends/peer']);
  });

  testWidgets('the settings row opens the note editor', (tester) async {
    await mountRouter(
      tester,
      ContactClient(remark: 'Sếp'),
      profileRouter('/user/peer/settings'),
    );

    await tester.tap(find.text('Chỉnh sửa Ghi chú'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('contact-note-field')), findsOneWidget);
  });
}
