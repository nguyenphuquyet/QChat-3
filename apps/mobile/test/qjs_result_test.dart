import 'package:flutter_test/flutter_test.dart';
import 'package:qchat_miniapp_quickjs/qchat_miniapp_quickjs.dart';

void main() {
  test('a successful envelope decodes its JSON result', () {
    final result = QjsEvalResult.decode('{"ok":true,"result":{"value":42}}');

    expect(result.ok, isTrue);
    expect(result.error, isNull);
    expect(result.value, <String, Object?>{'value': 42});
  });

  test('a script with no JSON value reports null', () {
    final result = QjsEvalResult.decode('{"ok":true}');

    expect(result.ok, isTrue);
    expect(result.value, isNull);
  });

  test('a script error keeps name, message and stack', () {
    final result = QjsEvalResult.decode(
      '{"ok":false,"error":{"name":"SyntaxError",'
      '"message":"unexpected token","stack":"at <eval>:1"}}',
    );

    expect(result.ok, isFalse);
    expect(result.value, isNull);
    expect(result.error?.name, 'SyntaxError');
    expect(result.error?.message, 'unexpected token');
    expect(result.error?.stack, 'at <eval>:1');
  });

  test('an unknown error shape is a generic error, not a crash', () {
    final result = QjsEvalResult.decode('{"ok":false,"error":"boom"}');

    expect(result.error?.name, 'Error');
    expect(result.error?.message, contains('invalid error envelope'));
  });

  test('an empty stack is reported as no stack', () {
    final result = QjsEvalResult.decode(
      '{"ok":false,"error":{"name":"Error","message":"x","stack":""}}',
    );

    expect(result.error?.stack, isNull);
  });

  test('a non-object envelope is a format error', () {
    expect(() => QjsEvalResult.decode('[]'), throwsFormatException);
  });
}
