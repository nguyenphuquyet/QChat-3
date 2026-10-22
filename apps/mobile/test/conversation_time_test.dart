import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/conversation_time.dart';

void main() {
  String label(String key) => key == 'yesterday' ? 'Hôm qua' : key;
  test('conversation dates use calendar days and readable older dates', () {
    final now = DateTime(2026, 10, 22, 0, 5);
    expect(conversationTime(null, now, label), '');
    expect(conversationTime(DateTime(2026, 10, 22, 0, 1), now, label), '00:01');
    expect(
      conversationTime(DateTime(2026, 10, 21, 23, 59), now, label),
      'Hôm qua 23:59',
    );
    expect(conversationTime(DateTime(2026, 10, 20), now, label), 'weekday2');
    expect(conversationTime(DateTime(2026, 10, 16), now, label), 'weekday5');
    expect(conversationTime(DateTime(2026, 10, 15), now, label), '15/10');
    expect(conversationTime(DateTime(2025, 10, 15), now, label), '15/10/2025');
    expect(
      conversationTime(
        DateTime(2025, 12, 31, 14, 42),
        DateTime(2026, 1, 1),
        label,
      ),
      'Hôm qua 14:42',
    );
    expect(
      conversationTime(
        DateTime(2024, 2, 29, 5, 48),
        DateTime(2024, 3, 1),
        label,
      ),
      'Hôm qua 05:48',
    );
  });
}
