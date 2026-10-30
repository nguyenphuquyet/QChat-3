import 'dart:convert';
import 'package:flutter/widgets.dart';
import '../payments/payments_screen.dart';
import 'red_packet_cover.dart';
import 'red_packet_design.dart';

export 'red_packet_design.dart' show redPacketRed;

/// Orange of the money bubbles (transfer and red packet share it).
const moneyOrange = Color(0xfff5a83a);
const _deepRed = Color(0xffc0342a);
const _footerInk = Color(0xfff8d9a8);

/// The message text of TRANSFER / RED_PACKET rows is a small JSON payload:
/// `{"amount": 520000, "note": "...", "transferId": "..."}`.
class MoneyPayload {
  const MoneyPayload(this.amount, this.note, [this.transferId, this.cover]);
  final int amount;
  final String note;
  final String? transferId;

  /// Snapshot of the cover the sender chose. It travels inside the message so
  /// a packet keeps its look even if the designer edits or deletes the cover.
  final CoverDesign? cover;

  static MoneyPayload parse(Object? text) {
    try {
      final value = jsonDecode(text?.toString() ?? '');
      if (value is Map) {
        return MoneyPayload(
          (value['amount'] as num?)?.toInt() ?? 0,
          value['note']?.toString().trim() ?? '',
          value['transferId']?.toString(),
          value['cover'] == null ? null : CoverDesign.fromJson(value['cover']),
        );
      }
    } catch (_) {}
    return const MoneyPayload(0, '');
  }
}

class MoneyMessageState {
  const MoneyMessageState._();

  static Map? _transfer(Map message) => message['moneyTransfer'] as Map?;

  static DateTime? _time(Object? value) =>
      DateTime.tryParse(value?.toString() ?? '');

  static DateTime? createdAt(Map message) {
    final transfer = _transfer(message);
    return _time(transfer?['createdAt']) ?? _time(message['createdAt']);
  }

  static DateTime? refundedAt(Map message) =>
      _time(_transfer(message)?['refundedAt']);

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

  static bool isRefunded(Map message) =>
      _transfer(message)?['status'] == 'REFUNDED';

  static bool isCompleted(Map message) {
    final transfer = _transfer(message);
    if (transfer == null) return false;
    if (message['kind'] == 'RED_PACKET') {
      return ((transfer['claimedCount'] as num?)?.toInt() ?? 0) > 0;
    }
    return transfer['status'] == 'CLAIMED';
  }

  /// Time left before an unclaimed transfer goes back to the sender. The
  /// server enforces the same 24 hour window, this only drives the copy.
  static Duration? refundRemaining(Map message) {
    final created = createdAt(message);
    if (created == null) return null;
    final left = created
        .add(const Duration(hours: 24))
        .difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  static String refundWindowText(Map message) {
    final left = refundRemaining(message);
    if (left == null) return 'Tự động hoàn tiền sau 24 giờ nếu chưa nhận';
    if (left == Duration.zero) return 'Đang hoàn tiền về người gửi';
    final hours = left.inHours;
    final minutes = left.inMinutes % 60;
    final span = hours > 0
        ? '$hours giờ $minutes phút'
        : '${minutes < 1 ? 1 : minutes} phút';
    return 'Tự động hoàn tiền sau $span nếu chưa nhận';
  }
}

/// Human readable one-line summary of a money message, used for quotes,
/// clipboard, search, favorites and forwarding.
String moneySummary(Map message) {
  final payload = MoneyPayload.parse(message['text']);
  final label = message['kind'] == 'RED_PACKET' ? 'Hồng bao' : 'Chuyển tiền';
  final amount = moneyText(payload.amount);
  return payload.note.isEmpty
      ? '$label $amount'
      : '$label $amount · ${payload.note}';
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
    return red ? 'Hồng bao' : 'Chuyển tiền';
  }

  /// The bubble wears the sender's cover artwork: decorations marked "whole
  /// cover" hang around the message just like they hang around the packet.
  Widget _art(CoverDesign? cover, Widget child) => red && cover != null
      ? CoverDecorationOverlay(design: cover, child: child)
      : child;

  @override
  Widget build(BuildContext c) {
    final payload = MoneyPayload.parse(message['text']);
    final completed = MoneyMessageState.isCompleted(message);
    final refunded = MoneyMessageState.isRefunded(message);
    // Match the bubble's 68% cap so narrow phones never clip the card.
    final width = (MediaQuery.sizeOf(c).width * .68 - 24).clamp(186.0, 240.0);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Opacity(
        opacity: completed || refunded ? .48 : 1,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              top: 16,
              left: mine ? null : -4,
              right: mine ? -4 : null,
              child: Transform.rotate(
                angle: .785398,
                child: Container(width: 10, height: 10, color: moneyOrange),
              ),
            ),
            _art(
              payload.cover,
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
                      padding: const EdgeInsets.fromLTRB(11, 10, 11, 9),
                      child: SizedBox(
                        height: 46,
                        child: red
                            ? Row(
                                children: [
                                  const _Envelope(),
                                  const SizedBox(width: 11),
                                  Expanded(
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          greeting,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Color(0xffffffff),
                                            fontSize: 16,
                                            height: 1.3,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        if (completed || refunded)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 2,
                                            ),
                                            child: Text(
                                              refunded
                                                  ? 'Đã hoàn tiền'
                                                  : 'Đã mở hồng bao',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: Color(0xf2ffffff),
                                                fontSize: 12.5,
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
                                  const _TransferArrows(),
                                  const SizedBox(width: 11),
                                  Expanded(
                                    child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          moneyText(payload.amount),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Color(0xffffffff),
                                            fontSize: 17.5,
                                            height: 1.2,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        // The reference keeps this caption on one
                                        // line, shrinking it a touch when needed.
                                        Align(
                                          alignment: Alignment.centerLeft,
                                          child: FittedBox(
                                            fit: BoxFit.scaleDown,
                                            alignment: Alignment.centerLeft,
                                            child: Text(
                                              refunded
                                                  ? 'Đã hoàn tiền'
                                                  : mine
                                                  ? 'Bạn đã thực hiện chuyển khoản'
                                                  : completed
                                                  ? 'Đã nhận'
                                                  : 'Chấp nhận chuyển tiền',
                                              maxLines: 1,
                                              softWrap: false,
                                              style: const TextStyle(
                                                color: Color(0xf2ffffff),
                                                fontSize: 12.5,
                                                height: 1.2,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: Container(
                        width: double.infinity,
                        height: .5,
                        color: const Color(0x33ffffff),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 4, 14, 5),
                      child: Text(
                        red ? 'QChat Hồng bao' : 'QChat Chuyển tiền',
                        maxLines: 1,
                        style: const TextStyle(color: _footerInk, fontSize: 11),
                      ),
                    ),
                  ],
                ),
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
    width: 40,
    height: 46,
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
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xfff8dfb0),
              shape: BoxShape.circle,
            ),
            child: const Text(
              '₫',
              style: TextStyle(
                color: Color(0xffb33a2b),
                fontSize: 10.5,
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

/// The transfer mark of `weixin-transfer-icon.svg`: a ring with two arrows,
/// top pointing left and bottom pointing right.
class _TransferArrows extends StatelessWidget {
  const _TransferArrows();
  @override
  Widget build(BuildContext c) => CustomPaint(
    size: const Size.square(40),
    painter: const _TransferArrowsPainter(),
  );
}

class _TransferArrowsPainter extends CustomPainter {
  const _TransferArrowsPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 100;
    final paint = Paint()
      ..color = const Color(0xffffffff)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4 * s
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawCircle(Offset(50 * s, 50 * s), 43 * s, paint);
    canvas.drawPath(
      Path()
        ..moveTo(70 * s, 37 * s)
        ..lineTo(30 * s, 37 * s)
        ..moveTo(30 * s, 37 * s)
        ..lineTo(39 * s, 28 * s)
        ..moveTo(30 * s, 37 * s)
        ..lineTo(39 * s, 46 * s),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(30 * s, 63 * s)
        ..lineTo(70 * s, 63 * s)
        ..moveTo(70 * s, 63 * s)
        ..lineTo(61 * s, 54 * s)
        ..moveTo(70 * s, 63 * s)
        ..lineTo(61 * s, 72 * s),
      paint,
    );
  }

  @override
  bool shouldRepaint(_TransferArrowsPainter old) => false;
}
