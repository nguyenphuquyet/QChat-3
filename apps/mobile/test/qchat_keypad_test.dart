import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/design_system/components.dart';

import 'test_app.dart';

void main() {
  testWidgets('keypad reports digits, decimal, delete and submit', (
    tester,
  ) async {
    final digits = <String>[];
    var decimals = 0, deletes = 0, submits = 0;
    await tester.pumpWidget(
      qchatHarness(
        QChatKeypad(
          onDigit: digits.add,
          onDecimal: () => decimals++,
          onBackspace: () => deletes++,
          onSubmit: () => submits++,
          submitLabel: 'Send',
        ),
      ),
    );

    for (final key in ['1', '2', '3', '0', '4', '5', '6', '7', '8', '9']) {
      await tester.tap(find.byKey(ValueKey('keypad-$key')));
    }
    await tester.tap(find.byKey(const ValueKey('keypad-decimal')));
    await tester.tap(find.byKey(const ValueKey('keypad-backspace')));
    await tester.tap(find.byKey(const ValueKey('keypad-submit')));
    await tester.pump();

    expect(digits, ['1', '2', '3', '0', '4', '5', '6', '7', '8', '9']);
    expect(decimals, 1);
    expect(deletes, 1);
    expect(submits, 1);
  });

  testWidgets('keypad disables its callbacks when enabled is false', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      qchatHarness(
        QChatKeypad(
          enabled: false,
          onDigit: (_) => taps++,
          onBackspace: () => taps++,
          onDecimal: () => taps++,
          onSubmit: () => taps++,
          submitLabel: 'Send',
        ),
      ),
    );

    for (final key in ['1', 'decimal', 'backspace', 'submit']) {
      await tester.tap(find.byKey(ValueKey('keypad-$key')));
    }
    await tester.pump();

    expect(taps, 0);
  });
}
