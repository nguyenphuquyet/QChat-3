import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qchat/core/media/media_library.dart';
import 'package:qchat/core/media/media_picker_sheet.dart';

import 'test_app.dart';

final _pixel = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z'
  '8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
);

class _FakeLibrary implements MediaLibrary {
  _FakeLibrary({
    this.access = MediaAccess.full,
    this.albumsWithAssets = const {},
  });

  final MediaAccess access;
  final Map<String, List<MediaAsset>> albumsWithAssets;
  var opened = 0;
  var widened = 0;

  @override
  Future<MediaAccess> requestAccess() async {
    opened += 1;
    return access;
  }

  @override
  Future<List<MediaAlbum>> albums() async => [
    for (final entry in albumsWithAssets.entries)
      MediaAlbum(
        id: entry.key,
        name: entry.key,
        count: entry.value.length,
        isRecent: entry.key == 'Recent',
      ),
  ];

  @override
  Future<List<MediaAsset>> assets(
    MediaAlbum album, {
    required int page,
    int size = 100,
  }) async => page == 0 ? albumsWithAssets[album.id] ?? const [] : const [];

  @override
  Future<Uint8List?> thumbnail(MediaAsset asset, {required int size}) async =>
      _pixel;

  @override
  Future<XFile> file(MediaAsset asset) async =>
      XFile('/tmp/${asset.id}.jpg');

  @override
  Future<void> openSettings() async {}

  @override
  Future<void> widenAccess() async {
    widened += 1;
  }
}

const _photos = [
  MediaAsset(id: 'a1', isVideo: false),
  MediaAsset(id: 'a2', isVideo: false),
  MediaAsset(id: 'a3', isVideo: true, duration: Duration(seconds: 75)),
  MediaAsset(id: 'a4', isVideo: false),
];

class _Host extends StatelessWidget {
  const _Host({required this.library, this.maxAssets = 9});

  final MediaLibrary library;
  final int maxAssets;

  static List<XFile>? result;

  @override
  Widget build(BuildContext context) => Center(
    child: GestureDetector(
      onTap: () async {
        result = await showMediaPicker(
          context,
          library: library,
          imagesOnly: false,
          maxAssets: maxAssets,
        );
      },
      child: const Text('open'),
    ),
  );
}

Future<_FakeLibrary> _open(
  WidgetTester tester, {
  MediaAccess access = MediaAccess.full,
  int maxAssets = 9,
  Map<String, List<MediaAsset>>? albums,
}) async {
  _Host.result = null;
  final library = _FakeLibrary(
    access: access,
    albumsWithAssets: albums ?? {'Recent': _photos},
  );
  await tester.pumpWidget(
    qchatHarness(_Host(library: library, maxAssets: maxAssets)),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return library;
}

void main() {
  testWidgets('grids the recent album and numbers the selection', (
    tester,
  ) async {
    await _open(tester);

    expect(find.byKey(const ValueKey('a1')), findsOneWidget);
    expect(find.text('Recent'), findsOneWidget);
    // Nothing picked: the send button has no count and the preview is muted.
    expect(find.text('Send'), findsOneWidget);
    expect(find.text('Preview'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('a1')));
    await tester.pump();
    // A single pick is a tick, not the number 1.
    expect(find.text('Send (1)'), findsOneWidget);
    expect(find.text('Preview (1)'), findsOneWidget);
    expect(find.text('1'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('a3')));
    await tester.pump();
    // The second pick takes number 2, in the order the user tapped.
    expect(find.text('1'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('Send (2)'), findsOneWidget);
    expect(find.text('Gửi (2)'), findsNothing);
  });

  testWidgets('sends the picked assets as files', (tester) async {
    await _open(tester);

    await tester.tap(find.byKey(const ValueKey('a2')));
    await tester.pump();
    await tester.tap(find.text('Send (1)'));
    await tester.pumpAndSettle();

    expect(_Host.result, hasLength(1));
    expect(_Host.result!.single.path, endsWith('a2.jpg'));
  });

  testWidgets('one-asset picks move the tick instead of refusing it', (
    tester,
  ) async {
    await _open(tester, maxAssets: 1);

    await tester.tap(find.byKey(const ValueKey('a1')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('a2')));
    await tester.pump();

    expect(find.text('Send (1)'), findsOneWidget);
    expect(find.text('1'), findsNothing);
    expect(find.text('2'), findsNothing);
  });

  testWidgets('stops at the selection limit', (tester) async {
    await _open(tester, maxAssets: 2);

    await tester.tap(find.byKey(const ValueKey('a1')));
    await tester.tap(find.byKey(const ValueKey('a2')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('a4')));
    await tester.pump();

    expect(find.text('Send (2)'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('3'), findsNothing);
    // The refusal toast owns a timer; let it expire before the test ends.
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('offers Settings and Files when access is refused', (
    tester,
  ) async {
    await _open(tester, access: MediaAccess.denied);

    expect(find.byKey(const ValueKey('a1')), findsNothing);
    expect(find.text('Open Settings'), findsOneWidget);
    expect(find.text('Files'), findsOneWidget);
  });

  testWidgets('widens a limited library from the banner', (tester) async {
    final library = await _open(tester, access: MediaAccess.limited);

    expect(find.text('You let QChat see only some photos.'), findsOneWidget);
    expect(find.text('Change'), findsOneWidget);
    await tester.tap(find.text('Change'));
    await tester.pumpAndSettle();

    expect(library.widened, 1);
    expect(library.opened, greaterThan(1));
  });

  testWidgets('switches albums from the pill', (tester) async {
    await _open(
      tester,
      albums: {
        'Recent': _photos,
        'Camera': const [MediaAsset(id: 'c1', isVideo: false)],
      },
    );

    await tester.tap(find.text('Recent'));
    await tester.pumpAndSettle();
    // Rows name the album and its size, and only the current one is ticked.
    expect(find.text('Recent(4)'), findsOneWidget);
    expect(find.text('Camera(1)'), findsOneWidget);

    await tester.tap(find.text('Camera(1)'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('c1')), findsOneWidget);
    expect(find.byKey(const ValueKey('a1')), findsNothing);
    expect(find.text('Camera'), findsOneWidget);
  });

  testWidgets('previews an item and ticks it from the preview page', (
    tester,
  ) async {
    await _open(tester);

    await tester.longPress(find.byKey(const ValueKey('a2')));
    await tester.pumpAndSettle();
    expect(find.text('2/4'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('previewToggle')));
    await tester.pump();
    expect(find.text('Send (1)'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('previewSend')));
    await tester.pumpAndSettle();
    expect(_Host.result, hasLength(1));
    expect(_Host.result!.single.path, endsWith('a2.jpg'));
  });

  test('formats a clip length as m:ss', () {
    expect(formatMediaDuration(const Duration(seconds: 75)), '1:15');
    expect(formatMediaDuration(const Duration(seconds: 5)), '0:05');
  });
}
