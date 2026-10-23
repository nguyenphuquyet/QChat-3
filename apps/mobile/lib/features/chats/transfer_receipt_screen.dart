import 'package:flutter/material.dart';
import '../../core/design_system/qchat_icons.dart';
import '../payments/payments_screen.dart';
import 'money_message.dart';

/// Full-screen receipt for a TRANSFER message: awaiting confirmation, then the
/// accepted state once the receiver taps the green button.
class TransferReceiptScreen extends StatefulWidget {
  const TransferReceiptScreen({
    super.key,
    required this.message,
    required this.mine,
  });
  final Map message;
  final bool mine;
  @override
  State<TransferReceiptScreen> createState() => _TransferReceiptScreenState();
}

class _TransferReceiptScreenState extends State<TransferReceiptScreen> {
  bool accepted = false;

  static const _background = Color(0xfffdf7f7);
  static const _green = Color(0xff34c759);
  static const _blue = Color(0xff4aa3e8);

  String _clock(DateTime time) =>
      '${time.day.toString().padLeft(2, '0')}/'
      '${time.month.toString().padLeft(2, '0')}/'
      '${time.year} ${time.hour.toString().padLeft(2, '0')}:'
      '${time.minute.toString().padLeft(2, '0')}:'
      '${time.second.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext c) {
    final payload = MoneyPayload.parse(widget.message['text']);
    final created =
        DateTime.tryParse(widget.message['createdAt']?.toString() ?? '')
            ?.toLocal() ??
        DateTime.now();
    final amount = moneyText(payload.amount);
    return Scaffold(
      backgroundColor: _background,
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => Navigator.of(context).pop(),
                child: const Padding(
                  padding: EdgeInsets.all(14),
                  child: QChatIcon('back', size: 20, color: Color(0xff333333)),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 30),
                child: Column(
                  children: [
                    const SizedBox(height: 14),
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: accepted ? _green : _blue,
                          width: 2.4,
                        ),
                        color: accepted ? _green : Colors.transparent,
                      ),
                      child: accepted
                          ? const Icon(
                              Icons.check_rounded,
                              color: Colors.white,
                              size: 34,
                            )
                          : const Icon(
                              Icons.access_time_rounded,
                              color: _blue,
                              size: 30,
                            ),
                    ),
                    const SizedBox(height: 22),
                    if (accepted) ...[
                      const Text(
                        'Bạn đã nhận chuyển khoản. Tiền đã được cộng vào Số dư.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xff8c8c8c),
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 14),
                    ] else
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: Text(
                          'Chờ xác nhận',
                          style: TextStyle(
                            color: Color(0xff8c8c8c),
                            fontSize: 13,
                          ),
                        ),
                      ),
                    Text(
                      amount,
                      style: const TextStyle(
                        color: Color(0xff222222),
                        fontSize: 28,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (accepted)
                      const Text(
                        'Số dư khả dụng',
                        style: TextStyle(
                          color: Color(0xffb0b0b0),
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 26),
                    _TimeRow(label: 'Thời gian chuyển', value: _clock(created)),
                    if (accepted) ...[
                      const SizedBox(height: 10),
                      _TimeRow(
                        label: 'Thời gian nhận',
                        value: _clock(DateTime.now()),
                      ),
                    ],
                    const Spacer(),
                    if (!accepted && !widget.mine) ...[
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: _green,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () => setState(() => accepted = true),
                              child: const Center(
                                child: Text(
                                  'Xác nhận đã nhận',
                                  style: TextStyle(
                                    color: Color(0xffffffff),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Tiền sẽ được hoàn lại cho người gửi nếu không nhận trong 24 giờ. Hoàn tiền ngay',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xffb8b8b8),
                          fontSize: 11,
                          height: 1.45,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
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

class _TimeRow extends StatelessWidget {
  const _TimeRow({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext c) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        label,
        style: const TextStyle(color: Color(0xffb0b0b0), fontSize: 12),
      ),
      Text(
        value,
        style: const TextStyle(color: Color(0xff9a9a9a), fontSize: 12),
      ),
    ],
  );
}
