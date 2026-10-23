import 'dart:convert';
import 'package:flutter/widgets.dart';
import '../../core/design_system/qchat_icons.dart';
import '../payments/payments_screen.dart';

/// Orange of the money bubbles (transfer and red packet share it).
const moneyOrange = Color(0xfff5a623);
const redPacketRed = Color(0xffd93b30);
const _deepRed = Color(0xffc0342a);

/// The message text of TRANSFER / RED_PACKET rows is a small JSON payload:
/// `{"amount": 520000, "note": "...", "transferId": "..."}`.
class MoneyPayload {
  const MoneyPayload(this.amount, this.note, [this.transferId]);
  final int amount;
  final String note;
  final String? transferId;

  static MoneyPayload parse(Object? text) {
    try {
      final value = jsonDecode(text?.toString() ?? '');
      if (value is Map) {
        return MoneyPayload(
          (value['amount'] as num?)?.toInt() ?? 0,
          value['note']?.toString().trim() ?? '',
          value['transferId']?.toString(),
        );
      }
    } catch (_) {}
    return const MoneyPayload(0, '');
  }
}

class MoneyMessageState {
  const MoneyMessageState._();

  static Map? _transfer(Map message) => message['moneyTransfer'] as Map?;

  static bool claimedByMe(Map message) {
    final claims = _transfer(message)?['claims'];
    return claims is List &&
        claims.isNotEmpty &&
        claims.first is Map &&
        claims.first['status'] == 'CLAIMED';
  }

  static int? receivedAmount(Map message) {
    final claims = _transfer(message)?['claims'];
    if (claims is! List || claims.isEmpty || claims.first is! Map) return null;
    return (claims.first['amount'] as num?)?.toInt();
  }

  static bool isCompleted(Map message) {
    final transfer = _transfer(message);
    if (transfer == null) return false;
    if (message['kind'] == 'RED_PACKET') {
      return ((transfer['claimedCount'] as num?)?.toInt() ?? 0) > 0;
    }
    return transfer['status'] == 'CLAIMED';
  }
}

class MoneyMessageCard extends StatelessWidget {
  const MoneyMessageCard({
    super.key,
    required this.message,
    required this.mine,
    required this.onTap,
  });
  final Map message;
  final bool mine;
  final VoidCallback onTap;

  bool get red => message['kind'] == 'RED_PACKET';

  String get greeting {
    final note = MoneyPayload.parse(message['text']).note;
    if (note.isNotEmpty) return note;
    return red ? 'Chúc mừng năm mới' : 'Chuyển tiền';
  }

  @override
  Widget build(BuildContext c) {
    final payload = MoneyPayload.parse(message['text']);
    final completed = MoneyMessageState.isCompleted(message);
    // Match the bubble's 68% cap so narrow phones never clip the card.
    final width = (MediaQuery.sizeOf(c).width * .68 - 24).clamp(190.0, 244.0);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Opacity(
        opacity: completed ? .48 : 1,
        child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: 18,
            left: mine ? null : -4,
            right: mine ? -4 : null,
            child: Transform.rotate(
              angle: .785398,
              child: Container(width: 11, height: 11, color: moneyOrange),
            ),
          ),
          Container(
            width: width,
            decoration: BoxDecoration(
              color: moneyOrange,
              borderRadius: BorderRadius.circular(5),
              border: Border.all(color: const Color(0x33ffffff)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                  child: red
                      ? Row(
                          children: [
                            const _Envelope(),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    greeting,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xffffffff),
                                      fontSize: 16.5,
                                      height: 1.3,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  if (completed)
                                    const Padding(
                                      padding: EdgeInsets.only(top: 3),
                                      child: Text(
                                        'Đã mở hồng bao',
                                        style: TextStyle(
                                          color: Color(0xf2ffffff),
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: const Color(0xccffffff),
                                  width: 1.6,
                                ),
                              ),
                              child: const Center(
                                child: QChatIcon(
                                  'transferMoney',
                                  size: 25,
                                  color: Color(0xffffffff),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    moneyText(payload.amount),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xffffffff),
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    completed
                                        ? 'Đã nhận'
                                        : mine
                                        ? 'Đợi đối phương nhận'
                                        : 'Chấp nhận chuyển tiền',
                                    style: const TextStyle(
                                      color: Color(0xf2ffffff),
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                ),
                Container(
                  height: .5,
                  color: const Color(0x40ffffff),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 5, 12, 6),
                  child: Text(
                    red ? 'QChat Hồng bao' : 'QChat Chuyển tiền',
                    style: const TextStyle(
                      color: Color(0xd9ffffff),
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        ),
      ),
    );
  }
}

class _Envelope extends StatelessWidget {
  const _Envelope();
  @override
  Widget build(BuildContext c) => Container(
    width: 46,
    height: 56,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(3),
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xffe4553e), _deepRed],
      ),
    ),
    child: Column(
      children: [
        Container(
          height: 14,
          decoration: const BoxDecoration(
            color: Color(0x33ffffff),
            borderRadius: BorderRadius.vertical(top: Radius.circular(3)),
          ),
        ),
        const Spacer(),
        Center(
          child: Container(
            width: 19,
            height: 19,
            decoration: const BoxDecoration(
              color: Color(0xfff2d9a2),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: _deepRed,
                  borderRadius: BorderRadius.circular(1.4),
                ),
              ),
            ),
          ),
        ),
        const Spacer(),
        Container(height: 9),
      ],
    ),
  );
}
