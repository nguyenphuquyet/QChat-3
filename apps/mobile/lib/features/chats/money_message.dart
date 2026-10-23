import 'dart:convert';
import 'package:flutter/widgets.dart';
import '../payments/payments_screen.dart';

/// Orange of the money bubbles (transfer and red packet share it).
const moneyOrange = Color(0xfff5a83a);
const redPacketRed = Color(0xffd93b30);
const _deepRed = Color(0xffc0342a);
const _footerInk = Color(0xfff8d9a8);

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

  static int claimedCount(Map message) =>
      ((_transfer(message)?['claimedCount'] as num?)?.toInt() ?? 0);

  static int recipientCount(Map message) =>
      ((_transfer(message)?['recipientCount'] as num?)?.toInt() ?? 1);

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
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                  child: SizedBox(
                    height: 58,
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
                                child: _TransferArrows(),
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
                                    mine
                                        ? 'Bạn đã thực hiện chuyển khoản'
                                        : completed
                                        ? 'Đã nhận'
                                        : 'Chấp nhận chuyển tiền',
                                    style: const TextStyle(
                                      color: Color(0xf2ffffff),
                                      fontSize: 13,
                                      height: 1.25,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                  ),
                ),
                Container(
                  width: double.infinity,
                  height: .5,
                  color: const Color(0x40ffffff),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 5, 12, 6),
                  child: Text(
                    red ? 'QChat Hồng bao' : 'QChat Chuyển tiền',
                    style: const TextStyle(
                      color: _footerInk,
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
      borderRadius: BorderRadius.circular(4),
      gradient: const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xffe8614f), _deepRed],
      ),
    ),
    child: Stack(
      children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: CustomPaint(painter: const _EnvelopeFlap()),
          ),
        ),
        Center(
          child: Container(
            width: 21,
            height: 21,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xfff8dfb0),
              shape: BoxShape.circle,
            ),
            child: const Text(
              '₫',
              style: TextStyle(
                color: Color(0xffb33a2b),
                fontSize: 11,
                height: 1,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

/// Subtle envelope flap so the icon reads as a red packet, not a plain card.
class _EnvelopeFlap extends CustomPainter {
  const _EnvelopeFlap();
  @override
  void paint(Canvas canvas, Size size) {
    final flap = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height * .30)
      ..quadraticBezierTo(
        size.width / 2,
        size.height * .50,
        0,
        size.height * .30,
      )
      ..close();
    canvas.drawPath(flap, Paint()..color = const Color(0x14ffffff));
    final edge = Path()
      ..moveTo(0, size.height * .30)
      ..quadraticBezierTo(
        size.width / 2,
        size.height * .50,
        size.width,
        size.height * .30,
      );
    canvas.drawPath(
      edge,
      Paint()
        ..color = const Color(0x33ffffff)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_EnvelopeFlap old) => false;
}

/// The two circulating arrows of the transfer bubble (top right, bottom left).
class _TransferArrows extends StatelessWidget {
  const _TransferArrows();
  @override
  Widget build(BuildContext c) => CustomPaint(
    size: const Size.square(25),
    painter: const _TransferArrowsPainter(),
  );
}

class _TransferArrowsPainter extends CustomPainter {
  const _TransferArrowsPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final paint = Paint()
      ..color = const Color(0xffffffff)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(
      Path()
        ..moveTo(4.5 * s, 8.5 * s)
        ..lineTo(19.5 * s, 8.5 * s)
        ..moveTo(15 * s, 4 * s)
        ..lineTo(19.5 * s, 8.5 * s)
        ..lineTo(15 * s, 13 * s),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(19.5 * s, 15.5 * s)
        ..lineTo(4.5 * s, 15.5 * s)
        ..moveTo(9 * s, 11 * s)
        ..lineTo(4.5 * s, 15.5 * s)
        ..lineTo(9 * s, 20 * s),
      paint,
    );
  }

  @override
  bool shouldRepaint(_TransferArrowsPainter old) => false;
}
