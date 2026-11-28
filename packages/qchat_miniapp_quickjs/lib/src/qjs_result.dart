import 'dart:convert';

/// A JavaScript exception as the native runtime reported it.
class QjsError {
  const QjsError({required this.name, required this.message, this.stack});

  factory QjsError.fromJson(Map<String, Object?> json) {
    final name = json['name'];
    final message = json['message'];
    final stack = json['stack'];
    return QjsError(
      name: name is String && name.isNotEmpty ? name : 'Error',
      message: message is String ? message : 'The script threw an error.',
      stack: stack is String && stack.isNotEmpty ? stack : null,
    );
  }

  final String name;
  final String message;
  final String? stack;

  @override
  String toString() => '$name: $message';
}

/// The outcome of one `eval`.
///
/// [value] is the decoded JSON result: `null`, a boolean, a number, a string,
/// a list or a map. A script whose result cannot be represented as JSON
/// (`undefined`, a function, a symbol, a cycle) reports `null`; a cycle is a
/// `TypeError` instead of a silently missing value.
class QjsEvalResult {
  const QjsEvalResult._({required this.ok, this.value, this.error});

  factory QjsEvalResult.fromJson(Map<String, Object?> json) {
    if (json['ok'] == true) {
      return QjsEvalResult._(ok: true, value: json['result']);
    }
    final error = json['error'];
    return QjsEvalResult._(
      ok: false,
      error: error is Map<String, Object?>
          ? QjsError.fromJson(error)
          : const QjsError(
              name: 'Error',
              message: 'The runtime returned an invalid error envelope.',
            ),
    );
  }

  /// Parse the JSON envelope returned by the platform channel.
  factory QjsEvalResult.decode(String json) {
    final value = jsonDecode(json);
    if (value is! Map<String, Object?>) {
      throw const FormatException('The QuickJS envelope is not an object.');
    }
    return QjsEvalResult.fromJson(value);
  }

  final bool ok;
  final Object? value;
  final QjsError? error;
}
