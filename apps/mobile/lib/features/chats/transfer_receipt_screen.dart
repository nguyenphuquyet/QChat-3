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
    required this.onClaim,
  });
  final Map message;
  final bool mine;
  final Future<int?> Function() onClaim;
  @override
  State<TransferReceiptScreen> createState() => _TransferReceiptScreenState();
}

class _TransferReceiptScreenState extends State<TransferReceiptScreen> {
  bool accepted = false;
  bool accepting = false;

  @override
  void initState() {
    super.initState();
    accepted = MoneyMessageState.claimedByMe(widget.message);
  }

  Future<void> accept() async {
    if (accepting) return;
    setState(() => accepting = true);
    final amount = await widget.onClaim();
    if (!mounted) return;
    setState(() {
      accepting = false;
      accepted = amount != null;
    });
  }

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
    final completed = accepted || MoneyMessageState.isCompleted(widget.message);
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
                          color: completed ? _green : _blue,
                          width: 2.4,
                        ),
                        color: completed ? _green : Colors.transparent,
                      ),
                      child: completed
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
                    if (completed) ...[
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
                    if (completed)
                      const Text(
                        'Số dư khả dụng',
                        style: TextStyle(
                          color: Color(0xffb0b0b0),
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 26),
                    _TimeRow(label: 'Thời gian chuyển', value: _clock(created)),
                    if (completed) ...[
                      const SizedBox(height: 10),
                      _TimeRow(
                        label: 'Thời gian nhận',
                        value: _clock(DateTime.now()),
                      ),
                    ],
                    const Spacer(),
                    if (!completed && !widget.mine) ...[
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
                              onTap: accepting ? null : accept,
                              child: Center(
                                child: Text(
                                  accepting ? 'Đang nhận…' : 'Xác nhận đã nhận',
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
                        'Khoản chuyển chỉ có thể được nhận một lần.',
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
