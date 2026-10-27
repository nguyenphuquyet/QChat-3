import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/media/media_picker_fallback.dart';
import 'package:qchat/core/network/media_upload.dart';
import 'test_app.dart';

class PickerFiles extends FilePickerPlatform {
  List<String>? extensions;
  @override
  Future<List<PlatformFile>> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    int compressionQuality = 0,
    AndroidOptions androidOptions = const AndroidOptions(),
    DarwinOptions darwinOptions = const DarwinOptions(),
    WindowsOptions windowsOptions = const WindowsOptions(),
    LinuxOptions linuxOptions = const LinuxOptions(),
    WebOptions webOptions = const WebOptions(),
  }) async {
    extensions = allowedExtensions;
    final bytes = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXfoAAAAASUVORK5CYII=',
    );
    return [
      for (final name in ['one.png', 'two.png'])
        XFilePlatformFile(XFile.fromData(bytes, name: name, path: name)),
    ];
  }
}

void main() {
  testWidgets(
    'picker slides vertically, limits selections and returns only on confirmation',
    (tester) async {
      final original = FilePickerPlatform.instance;
      final picker = PickerFiles();
      FilePickerPlatform.instance = picker;
      addTearDown(() => FilePickerPlatform.instance = original);
      List<XFile>? result;
      await tester.pumpWidget(
        qchatHarness(
          Builder(
            builder: (c) => GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () async {
                result = await pickDeviceMedia(
                  c,
                  imagesOnly: true,
                  maxAssets: 1,
                );
              },
              child: const ColoredBox(
                color: QChatColors.background,
                child: Center(child: Text('open')),
              ),
            ),
          ),
          locale: const Locale('vi'),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(
        tester.getTopLeft(find.byType(LocalMediaPicker)).dy,
        greaterThan(0),
      );
      expect(tester.getTopLeft(find.byType(LocalMediaPicker)).dx, 0);
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(QChatButton, 'Ảnh và video'),
      );
      await tester.pumpAndSettle();
      expect(picker.extensions, isNot(contains('mp4')));
      expect(result, isNull);
      expect(find.text('Chọn (1)'), findsOneWidget);
      await tester.tap(find.text('Chọn (1)'));
      await tester.pumpAndSettle();
      expect(result!.map((f) => f.name), ['one.png']);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'avatar lets its parent handle taps unless profile navigation is enabled',
    (tester) async {
      var selected = 0;
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (c, s) => ColoredBox(
              color: QChatColors.background,
              child: Column(
                children: [
                  GestureDetector(
                    onTap: () => selected++,
                    child: const UserAvatar({'id': 'peer', 'nickname': 'Peer'}),
                  ),
                  const UserAvatar({
                    'id': 'peer',
                    'nickname': 'Peer',
                  }, openProfile: true),
                ],
              ),
            ),
          ),
          GoRoute(
            path: '/user/:id',
            builder: (_, _) => const ColoredBox(
              color: QChatColors.background,
              child: Center(child: Text('profile')),
            ),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        qchatRouterHarness(routerConfig: router),
      );
      await tester.tap(find.byType(UserAvatar).first);
      await tester.pumpAndSettle();
      expect(selected, 1);
      expect(find.text('profile'), findsNothing);
      await tester.tap(find.byType(UserAvatar).last);
      await tester.pumpAndSettle();
      expect(find.text('profile'), findsOneWidget);
    },
  );

  testWidgets(
    'busy button keeps progress inside its own bounds without loading text',
    (tester) async {
      await tester.pumpWidget(
        qchatHarness(
          const Center(child: QChatButton('Gửi', loading: true)),
        ),
      );
      expect(find.text('Đang tải…'), findsNothing);
      final button = tester.getRect(find.byType(QChatButton));
      final progress = tester.getRect(find.byType(RotationTransition));
      expect(button.contains(progress.topLeft), isTrue);
      expect(button.contains(progress.bottomRight), isTrue);
      expect(progress.size, const Size(18, 18));
      await tester.pumpWidget(const SizedBox());
    },
  );
}
