import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';
import 'package:qchat/features/scan/scan_screen.dart';
import 'test_app.dart';

void main() {
  Widget chrome({
    VoidCallback? onBack,
    VoidCallback? onSwitchCamera,
    VoidCallback? onMyQr,
    VoidCallback? onGallery,
    VoidCallback? onFeature,
  }) => qchatHarness(
    // A phone's safe areas, so the chrome sits where it does on a device.
    MediaQuery(
      data: const MediaQueryData(
        size: Size(390, 844),
        padding: EdgeInsets.only(top: 47, bottom: 34),
      ),
      child: ScanChrome(
        preview: const ColoredBox(color: QChatColors.black),
        glow: const AlwaysStoppedAnimation(1),
        onBack: onBack ?? () {},
        onSwitchCamera: onSwitchCamera ?? () {},
        onMyQr: onMyQr ?? () {},
        onGallery: onGallery ?? () {},
        onFeature: onFeature ?? () {},
      ),
    ),
    locale: const Locale('vi'),
  );

  Finder circle(String icon) => find.byWidgetPredicate(
    (w) => w is QChatCircleButton && w.icon == icon,
  );

  testWidgets('the scanner draws the reference chrome', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(chrome());
    await tester.pumpAndSettle();

    // Back disc, the QR and gallery shortcuts.
    expect(find.byType(QChatCircleButton), findsNWidgets(3));
    expect(circle('backBold'), findsOneWidget);
    expect(circle('qrFilled'), findsOneWidget);
    expect(circle('imageFilled'), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (w) => w is QChatIconButton && w.icon == 'switchCamera',
      ),
      findsOneWidget,
    );
    // The shortcut pill, exactly as the reference labels it.
    expect(find.text('Chụp ảnh và...'), findsOneWidget);
    expect(find.text('Nhận diện, dịch, ghi nhớ ngay...'), findsOneWidget);
    expect(find.text('Mới'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('every control reports its tap', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var backs = 0, flips = 0, qr = 0, gallery = 0, feature = 0;
    await tester.pumpWidget(
      chrome(
        onBack: () => backs += 1,
        onSwitchCamera: () => flips += 1,
        onMyQr: () => qr += 1,
        onGallery: () => gallery += 1,
        onFeature: () => feature += 1,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(circle('backBold'));
    await tester.tap(
      find.byWidgetPredicate(
        (w) => w is QChatIconButton && w.icon == 'switchCamera',
      ),
    );
    await tester.tap(circle('qrFilled'));
    await tester.tap(circle('imageFilled'));
    await tester.tap(find.text('Chụp ảnh và...'));
    await tester.pumpAndSettle();

    expect([backs, flips, qr, gallery, feature], [1, 1, 1, 1, 1]);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the chrome is laid out where the reference puts it', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(chrome());
    await tester.pumpAndSettle();

    // The back disc is a 24 pt circle 18 pt in from the left, its centre 32 pt
    // below the status bar. It is held in a 48 pt touch target, so the target
    // sits 12 pt outside the drawn circle on every side.
    final back = tester.getRect(circle('backBold'));
    expect(back.left, 6);
    expect(back.top, 47 + 8);
    expect(back.width, 48);
    expect(tester.getRect(circle('qrFilled')).left, 16);
    expect(tester.getRect(circle('imageFilled')).right, 390 - 16);
    expect(tester.getRect(circle('qrFilled')).height, 57);
    // The row of three controls sits 20 pt above the home indicator.
    expect(tester.getRect(circle('qrFilled')).bottom, 844 - 34 - 20);
    expect(tester.getRect(circle('imageFilled')).bottom, 844 - 34 - 20);
  });
}
