import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/design_system/qchat_icons.dart';
import '../payments/payments_screen.dart';
import 'money_message.dart';

/// Compact red-packet popup with a cover, receipt, and sticker shortcut.
class RedPacketScreen extends StatefulWidget {
  const RedPacketScreen({
    super.key,
    required this.message,
    required this.sender,
    required this.mine,
    required this.onClaim,
  });
  final Map message;
  final Map sender;
  final bool mine;
  final Future<int?> Function() onClaim;
  @override
  State<RedPacketScreen> createState() => _RedPacketScreenState();
}

class _RedPacketScreenState extends State<RedPacketScreen> {
  bool opened = false;
  bool opening = false;
  int? openedAmount;

  @override
  void initState() {
    super.initState();
    // The sender always sees what they sent; a receiver who already claimed
    // goes straight to the opened view instead of the cover again.
    opened = widget.mine || MoneyMessageState.claimedByMe(widget.message);
    openedAmount = MoneyMessageState.receivedAmount(widget.message);
  }

  String get senderName => widget.sender['nickname']?.toString() ?? 'QChat';

  MoneyPayload get payload => MoneyPayload.parse(widget.message['text']);

  String get greeting {
    final note = payload.note;
    return note.isEmpty ? 'Best wishes' : note;
  }

  String get sentProgress {
    final claimed = MoneyMessageState.claimedCount(widget.message);
    final total = MoneyMessageState.recipientCount(widget.message);
    if (total <= 1) return claimed > 0 ? 'Đã nhận' : 'Chưa nhận';
    return 'Đã nhận $claimed/$total suất';
  }

  void openWallet() {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push('/payments/wallet');
  }

  Future<void> open() async {
    if (opened || widget.mine || opening) return;
    setState(() => opening = true);
    final amount = await widget.onClaim();
    if (!mounted) return;
    setState(() {
      opening = false;
      if (amount != null) {
        opened = true;
        openedAmount = amount;
      }
    });
  }

  @override
  Widget build(BuildContext c) {
    return Material(
      color: Colors.transparent,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: opened
            ? SystemUiOverlayStyle.dark
            : SystemUiOverlayStyle.light,
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) => Center(
              child: SizedBox(
                width: math.min(336, constraints.maxWidth - 32),
                height: math.min(470, constraints.maxHeight - 32),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 260),
                    switchInCurve: Curves.easeOut,
                    switchOutCurve: Curves.easeIn,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: ScaleTransition(
                        scale: Tween<double>(begin: .96, end: 1).animate(animation),
                        child: child,
                      ),
                    ),
                    child: opened ? _opened(c) : _cover(c),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _cover(BuildContext c) => SizedBox.expand(
    key: const ValueKey('red-packet-cover'),
    child: ColoredBox(
      color: redPacketRed,
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).pop(),
              child: const Padding(
                padding: EdgeInsets.all(14),
                child: QChatIcon(
                  'close',
                  size: 22,
                  color: Color(0xffffffff),
                ),
              ),
            ),
          ),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    UserAvatar(widget.sender, size: 22),
                    const SizedBox(width: 7),
                    Text(
                      'Đã gửi bởi $senderName',
                      style: const TextStyle(
                        color: Color(0xffffffff),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    greeting,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xffffffff),
                      fontSize: 22,
                      height: 1.35,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 54),
            child: GestureDetector(
              onTap: widget.mine || opening ? null : open,
              child: Container(
                width: 92,
                height: 92,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xfff6e3b0),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x33000000),
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    opening ? '...' : widget.mine ? 'Đã gửi' : 'Mở',
                    style: TextStyle(
                      color: Color(0xffa8512f),
                      fontSize: 20,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _opened(BuildContext c) => SizedBox.expand(
    key: const ValueKey('red-packet-opened'),
    child: ColoredBox(
      color: const Color(0xffffffff),
      child: Stack(
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SizedBox(
            height: 200,
            child: ClipPath(
              clipper: _ArcClipper(),
              child: const ColoredBox(color: redPacketRed),
            ),
          ),
        ),
        SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).pop(),
                  child: const Padding(
                    padding: EdgeInsets.all(14),
                    child: QChatIcon(
                      'close',
                      size: 21,
                      color: Color(0xff555555),
                    ),
                  ),
                ),
              ),
              if (widget.mine) const Spacer(),
              if (!widget.mine) const SizedBox(height: 92),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  UserAvatar(widget.sender, size: 22),
                  const SizedBox(width: 7),
                  Text(
                    widget.mine ? 'Hồng bao của bạn' : 'Đã gửi bởi $senderName',
                    style: const TextStyle(
                      color: Color(0xffb2b2b2),
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 9),
              Text(
                greeting,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xffb2b2b2),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              if (widget.mine)
                const Padding(
                  padding: EdgeInsets.only(bottom: 2),
                  child: Text(
                    'Tổng hồng bao',
                    style: TextStyle(
                      color: Color(0xffb2b2b2),
                      fontSize: 12,
                    ),
                  ),
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    moneyText(
                      widget.mine
                          ? payload.amount
                          : (openedAmount ?? payload.amount),
                      withUnit: false,
                    ),
                    style: const TextStyle(
                      color: Color(0xffc9a063),
                      fontSize: 42,
                      height: 1.1,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Text(
                    ' đ',
                    style: TextStyle(
                      color: Color(0xffc9a063),
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              if (widget.mine)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 4,
                    horizontal: 10,
                  ),
                  child: Text(
                    sentProgress,
                    style: const TextStyle(
                      color: Color(0xffb2b2b2),
                      fontSize: 13,
                    ),
                  ),
                )
              else
                GestureDetector(
                  onTap: openWallet,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 4, horizontal: 10),
                    child: Text(
                      'Đã chuyển vào Ví  ›',
                      style: TextStyle(
                        color: Color(0xffb2b2b2),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              if (!widget.mine) ...[
                const SizedBox(height: 22),
                Container(
                  width: 262,
                  height: 1,
                  color: const Color(0xffeeeeee),
                ),
                const SizedBox(height: 22),
                GestureDetector(
                  onTap: () => Navigator.of(context).pop('sticker'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xfff6f6f6),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '☺',
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xffa0a0a0),
                          ),
                        ),
                        SizedBox(width: 7),
                        Text(
                          'Trả lời bằng một Nhãn dán',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xff8f8f8f),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (widget.mine) const Spacer(),
            ],
          ),
        ),
      ],
    ),
  ),
  );
}

class _ArcClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) => Path()
    ..moveTo(0, 0)
    ..lineTo(size.width, 0)
    ..lineTo(size.width, 62)
    ..quadraticBezierTo(size.width / 2, 178, 0, 62)
    ..close();

  @override
  bool shouldReclip(_ArcClipper old) => false;
}
