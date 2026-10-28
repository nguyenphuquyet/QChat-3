import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/qapp/qapp_tdesign.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';

import 'test_app.dart';

/// The Mini App runtime draws its controls with TDesign while the host app
/// stays on the QChat design system. That only works if the TDesign widgets
/// can build inside a plain `WidgetsApp` (no `MaterialApp`, no `Scaffold`),
/// which is what this test pins down.
void main() {
  testWidgets('TDesign controls build inside a WidgetsApp host', (tester) async {
    var pressed = 0;
    var checked = false;
    var switched = false;
    var slider = 0.0;
    var typed = '';

    await tester.pumpWidget(
      qchatHarness(
        QappTDesignScope(
          child: Column(
            children: [
              TButton(
                onPressed: () => pressed += 1,
                child: const Text('Lưu'),
              ),
              TTag('Mới', colorPreset: TTagColorPreset.primary),
              TCheckbox(
                value: checked,
                showDivider: false,
                title: 'Đã xong',
                onChanged: (value) => checked = value ?? false,
              ),
              TSwitch(value: switched, onChanged: (value) => switched = value),
              TSlider(value: 0, divisions: 4, onChanged: (value) => slider = value),
              TInput(hintText: 'Tên việc', onChanged: (value) => typed = value),
              const TLoading(size: 18),
              const QappTIcon('check', size: 20),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Lưu'), findsOneWidget);
    expect(find.text('Mới'), findsOneWidget);
    expect(find.byType(TButton), findsOneWidget);
    expect(find.byType(TCheckbox), findsOneWidget);
    expect(find.byType(TSwitch), findsOneWidget);
    expect(find.byType(TSlider), findsOneWidget);
    expect(find.byType(TInput), findsOneWidget);

    await tester.tap(find.byType(TButton));
    await tester.tap(find.byType(TCheckbox));
    await tester.tap(find.byType(TSwitch));
    // `TLoading` spins forever, so `pumpAndSettle` would never settle.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(pressed, 1);
    expect(checked, isTrue);
    expect(switched, isTrue);
    expect(slider, greaterThanOrEqualTo(0));
    expect(typed, isEmpty);
  });

  test('every contract icon resolves or falls back', () {
    // Names TDesign knows are drawn from its font; unknown names fall back to
    // the QChat glyphs instead of throwing.
    expect(qappTIconData('check'), isNotNull);
    expect(qappTIconData('chevronRight'), isNotNull);
    expect(qappTIconData('a-name-tdesign-does-not-have'), isNull);
  });
}
