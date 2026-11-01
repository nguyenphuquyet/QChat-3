import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/app/providers.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/network/client.dart';
import 'package:qchat/features/stickers/sticker_library_screen.dart';
import 'package:qchat/features/stickers/sticker_models.dart';
import 'package:qchat/features/stickers/sticker_pack_screen.dart';
import 'package:qchat/features/stickers/sticker_panel.dart';
import 'package:qchat/features/stickers/sticker_view.dart';

import 'test_app.dart';

/// A pack with one wide cover, one square avatar and a handful of stickers, so
/// the two screens render their real shapes without a server.
class _StickerClient extends QChatClient {
  _StickerClient({this.mine = false, this.extraPacks = 0}) {
    userId = 'self';
  }

  final bool mine;

  /// Extra packs in the library, so the panel row can be tested with more tabs
  /// than fit on a phone screen.
  final int extraPacks;
  String? sentTo;
  String? sentMedia;
  final posted = <String>[];

  Map<String, dynamic> get pack => {
    'id': 'p1',
    'name': 'Bộ mèo lười',
    'description': '',
    'coverMediaId': 'cover',
    'avatarMediaId': 'avatar',
    'published': true,
    'mine': mine,
    'added': false,
    'ownerName': 'Mộc Hắc Hắc',
    'stickers': [
      for (var i = 0; i < 8; i++)
        {
          'id': 's$i',
          'mediaId': 's$i',
          'label': i == 2 ? 'Giận' : '',
          'animated': false,
          'packId': 'p1',
          'packName': 'Bộ mèo lười',
          'position': i,
        },
    ],
  };

  @override
  Future<dynamic> get(String path, {bool cached = true}) async {
    if (path == '/stickers') {
      return {
        'packs': [
          pack,
          for (var i = 0; i < extraPacks; i++)
            {
              'id': 'x$i',
              'name': 'Bộ phụ $i',
              'description': '',
              'coverMediaId': null,
              'avatarMediaId': null,
              'published': true,
              'mine': false,
              'added': true,
              'ownerName': 'Mộc Hắc Hắc',
              'stickers': [
                {
                  'id': 'x$i-s0',
                  'mediaId': 's$i',
                  'label': '',
                  'animated': false,
                  'packId': 'x$i',
                  'packName': 'Bộ phụ $i',
                  'position': 0,
                },
              ],
            },
        ],
        'market': [],
        'recent': [],
      };
    }
    if (path == '/stickers/packs/p1') return pack;
    if (path == '/conversations') {
      return [
        {
          'id': 'chat',
          'kind': 'DIRECT',
          'members': [
            {
              'userId': 'self',
              'user': {'nickname': 'Tôi'},
            },
            {
              'userId': 'peer',
              'user': {'nickname': 'Linh'},
            },
          ],
        },
      ];
    }
    return const {};
  }

  @override
  Future<dynamic> post(String path, Object data) async {
    posted.add(path);
    if (path == '/stickers/packs/p1/add') return pack;
    return {'ok': true};
  }

  @override
  Future<void> send(
    String conversation,
    String text, {
    String kind = 'TEXT',
    String? mediaId,
    String? replyToId,
  }) async {
    sentTo = conversation;
    sentMedia = mediaId;
  }
}

Future<Uint8List> _art(Color color) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(const Rect.fromLTWH(0, 0, 120, 120), Paint()..color = color);
  final image = await recorder.endRecording().toImage(120, 120);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

/// Records the requests the screen sends straight through `dio`, such as the
/// DELETE that takes one sticker out of a pack.
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

void main() {
  // Every test starts with the artwork in the cache: a missing picture swaps in
  // a retry gesture, which would steal taps from the control under test.
  setUp(() async {
    MediaCache.put('cover', await _art(const Color(0xfff4e3b2)));
    MediaCache.put('avatar', await _art(const Color(0xffffd166)));
    for (var i = 0; i < 8; i++) {
      MediaCache.put('s$i', await _art(const Color(0xffdddddd)));
    }
  });

  tearDown(() => MediaCache.clear());

  Future<_StickerClient> mount(
    WidgetTester tester,
    Widget screen, {
    bool mine = false,
    int extraPacks = 0,
  }) async {
    final client = _StickerClient(mine: mine, extraPacks: extraPacks);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [clientProvider.overrideWithValue(client)],
        child: qchatHarness(screen, locale: const Locale('vi')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    return client;
  }

  testWidgets('library tabs share one text size and show the pack avatar', (
    tester,
  ) async {
    await mount(tester, const StickerLibraryScreen());

    final selected = tester.widget<Text>(find.text('Những nhãn dán đã chọn'));
    final gallery = tester.widget<Text>(find.text('Nhãn dán khéo'));
    expect(selected.style?.fontSize, 17);
    expect(gallery.style?.fontSize, selected.style?.fontSize);

    expect(find.byKey(const ValueKey('sticker-pack-p1')), findsOneWidget);
    expect(
      find.byWidgetPredicate((w) => w is MediaImage && w.id == 'avatar'),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('sticker-pack-p1')),
        matching: find.text('Mộc Hắc Hắc'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a pack opens as its own page with a sticker sheet', (
    tester,
  ) async {
    await mount(tester, const StickerPackScreen(packId: 'p1'));

    expect(find.text('Bộ mèo lười'), findsOneWidget);
    expect(find.text('Mộc Hắc Hắc'), findsOneWidget);
    expect(find.byKey(const ValueKey('studio-sticker-s0')), findsOneWidget);
    expect(find.byKey(const ValueKey('studio-sticker-s7')), findsOneWidget);
    expect(
      find.byWidgetPredicate((w) => w is MediaImage && w.id == 'cover'),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('studio-sticker-s2')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Giận'), findsOneWidget);
    expect(find.byKey(const ValueKey('sticker-sheet-add')), findsOneWidget);
    expect(find.byKey(const ValueKey('sticker-sheet-send')), findsOneWidget);
    expect(find.text('Gửi đến Trò chuyện'), findsOneWidget);
    // Someone else's pack: the artwork is not the viewer's to take out.
    expect(find.byKey(const ValueKey('sticker-sheet-remove')), findsNothing);
  });

  testWidgets('the owner can remove a sticker from its preview sheet', (
    tester,
  ) async {
    final client = await mount(
      tester,
      const StickerPackScreen(packId: 'p1'),
      mine: true,
    );
    final transport = _RecordingTransport();
    client.dio.httpClientAdapter = transport;

    await tester.tap(find.byKey(const ValueKey('studio-sticker-s2')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    await tester.ensureVisible(
      find.byKey(const ValueKey('sticker-sheet-remove')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('sticker-sheet-remove')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Xoá nhãn dán này khỏi bộ?'), findsOneWidget);

    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();

    expect(transport.calls, ['DELETE /stickers/packs/p1/stickers/s2']);
    // The sheet is gone with the sticker it showed.
    expect(find.byKey(const ValueKey('sticker-sheet-remove')), findsNothing);
    // Let the confirmation toast expire before the tree is torn down.
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('the sheet sends a sticker to the picked conversation', (
    tester,
  ) async {
    final client = await mount(tester, const StickerPackScreen(packId: 'p1'));

    await tester.tap(find.byKey(const ValueKey('studio-sticker-s2')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byKey(const ValueKey('sticker-sheet-send')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Linh'), findsOneWidget);
    await tester.tap(find.text('Linh'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(client.sentTo, 'chat');
    expect(client.sentMedia, 's2');
    // Let the confirmation toast expire before the tree is torn down.
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('the owner sees the cover and avatar tools', (tester) async {
    await mount(tester, const StickerPackScreen(packId: 'p1'), mine: true);

    expect(find.text('Ảnh bìa'), findsWidgets);
    expect(find.text('Ảnh đại diện'), findsWidgets);
    expect(
      find.byWidgetPredicate((w) => w is QChatIcon && w.name == 'more'),
      findsOneWidget,
    );
    expect(
      find.byWidgetPredicate((w) => w is QChatIcon && w.name == 'camera'),
      findsWidgets,
    );
  });

  testWidgets('a library pack gets its own icon in the emoji panel', (
    tester,
  ) async {
    final sent = <Sticker>[];
    await mount(
      tester,
      SizedBox(
        height: 360,
        child: StickerPanel(
          safeBottom: 0,
          onEmoji: (_) {},
          onSticker: sent.add,
          onOpenStudio: ({String? packId, bool create = false}) {},
          onOpenLibrary: () {},
        ),
      ),
    );
    expect(tester.takeException(), isNull);

    // The row keeps its four fixed tabs and adds one icon per pack after them.
    expect(find.byKey(const ValueKey('sticker-tab-3')), findsOneWidget);
    // The row stays pinned to the leading edge instead of drifting inward when
    // a few packs leave room to spare.
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('sticker-tab-0'))).dx,
      20,
    );
    expect(find.byKey(const ValueKey('sticker-pack-tab-p1')), findsOneWidget);
    // The icon is the pack's own square picture, not a generic glyph.
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('sticker-pack-tab-p1')),
        matching: find.byType(MediaImage),
      ),
      findsOneWidget,
    );
    // The panel opens on the emoji tab, so the pack's stickers are not up yet.
    expect(find.byKey(const ValueKey('sticker-pack-sticker-s0')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('sticker-pack-tab-p1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('Bộ mèo lười'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('sticker-pack-sticker-s0')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('sticker-pack-sticker-s2')));
    await tester.pump();
    expect(sent.map((sticker) => sticker.id), ['s2']);
  });

  testWidgets('a long row of packs scrolls instead of overflowing', (
    tester,
  ) async {
    await mount(
      tester,
      SizedBox(
        height: 360,
        child: StickerPanel(
          safeBottom: 0,
          onEmoji: (_) {},
          onSticker: (_) {},
          onOpenStudio: ({String? packId, bool create = false}) {},
          onOpenLibrary: () {},
        ),
      ),
      extraPacks: 8,
    );
    expect(tester.takeException(), isNull);

    final last = find.byKey(const ValueKey('sticker-pack-tab-x7'));
    expect(last, findsOneWidget);
    await tester.ensureVisible(last);
    await tester.pump();
    await tester.tap(last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(tester.takeException(), isNull);
    expect(find.text('Bộ phụ 7'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('sticker-pack-sticker-x7-s0')),
      findsOneWidget,
    );
    // A pack with no avatar falls back to its first sticker.
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('sticker-pack-tab-x7')),
        matching: find.byType(StickerView),
      ),
      findsOneWidget,
    );
  });
}
