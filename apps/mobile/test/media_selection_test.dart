import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/core/design_system/media_widgets.dart';
import 'package:qchat/core/design_system/qchat_theme.dart';
import 'package:qchat/core/media/media_picker_fallback.dart';
import 'package:qchat/core/network/media_upload.dart';

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
        MaterialApp(
          locale: const Locale('vi'),
          supportedLocales: const [Locale('vi')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: Builder(
            builder: (c) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  result = await pickDeviceMedia(
                    c,
                    imagesOnly: true,
                    maxAssets: 1,
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
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
      await tester.tap(find.text('Ảnh và video'));
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
            builder: (c, s) => Scaffold(
              body: Column(
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
            builder: (_, _) => const Scaffold(body: Text('profile')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        MaterialApp.router(routerConfig: router, theme: qchatTheme(false)),
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
        MaterialApp(
          theme: qchatTheme(false),
          home: const Scaffold(
            body: Center(child: QChatButton('Gửi', loading: true)),
          ),
        ),
      );
      expect(find.text('Đang tải…'), findsNothing);
      final button = tester.getRect(find.byType(QChatButton));
      final progress = tester.getRect(find.byType(CircularProgressIndicator));
      expect(button.contains(progress.topLeft), isTrue);
      expect(button.contains(progress.bottomRight), isTrue);
      expect(progress.size, const Size(20, 20));
      await tester.pumpWidget(const SizedBox());
    },
  );
}
