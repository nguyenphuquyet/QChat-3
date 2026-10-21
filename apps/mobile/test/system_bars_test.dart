import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';

void main() {
  testWidgets(
    'system insets follow screen surfaces without covering controls',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final color in [Colors.white, Colors.black]) {
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: const MediaQueryData(
                size: Size(390, 844),
                padding: EdgeInsets.only(top: 44, bottom: 34),
              ),
              child: QChatPage(
                statusBackground: color,
                navigationBackground: color,
                bottom: const SizedBox(key: Key('bottom-controls'), height: 50),
                child: const SizedBox.expand(key: Key('body')),
              ),
            ),
          ),
        );
        expect(tester.getTopLeft(find.byKey(const Key('body'))).dy, 44);
        expect(
          tester.getBottomLeft(find.byKey(const Key('bottom-controls'))).dy,
          810,
        );
        final region = tester.widget<AnnotatedRegion<SystemUiOverlayStyle>>(
          find.byType(AnnotatedRegion<SystemUiOverlayStyle>).last,
        );
        expect(region.value.statusBarColor, Colors.transparent);
        expect(region.value.systemNavigationBarColor, Colors.transparent);
        expect(region.value.systemNavigationBarContrastEnforced, false);
        expect(
          region.value.statusBarIconBrightness,
          color == Colors.white ? Brightness.dark : Brightness.light,
        );
        expect(
          region.value.statusBarBrightness,
          color == Colors.white ? Brightness.light : Brightness.dark,
        );
        expect(find.byType(Positioned), findsNothing);
        expect(tester.takeException(), isNull);
      }
    },
  );
  testWidgets('edge-to-edge scrolls under system bars with safe controls', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(390, 844),
            padding: EdgeInsets.only(top: 44, bottom: 34),
          ),
          child: QChatPage(
            edgeToEdge: true,
            title: 'Settings',
            child: ListView(
              key: const Key('scroll'),
              children: List.generate(
                30,
                (i) => SizedBox(height: 60, child: Text('Row $i')),
              ),
            ),
          ),
        ),
      ),
    );
    expect(tester.getTopLeft(find.byType(QChatAppBar)).dy, 44);
    expect(tester.getBottomLeft(find.byKey(const Key('scroll'))).dy, 844);
    await tester.drag(find.byKey(const Key('scroll')), const Offset(0, -2000));
    await tester.pumpAndSettle();
    expect(
      tester.getBottomLeft(find.byType(SizedBox).last).dy,
      lessThanOrEqualTo(810),
    );
    expect(find.byType(Positioned), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
