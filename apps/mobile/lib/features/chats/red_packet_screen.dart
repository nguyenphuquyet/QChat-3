import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../payments/payments_screen.dart';
import 'money_message.dart';
import 'red_packet_cover.dart';

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
    // goes straight to the opened view instead of the cover again. An expired
    // packet also opens straight into the receipt so it cannot be tapped.
    opened =
        widget.mine ||
        MoneyMessageState.claimedByMe(widget.message) ||
        MoneyMessageState.isRefunded(widget.message);
    openedAmount = MoneyMessageState.receivedAmount(widget.message);
  }

  bool get refunded => MoneyMessageState.isRefunded(widget.message);
  bool get claimed => MoneyMessageState.claimedByMe(widget.message);
  bool get expiredForMe => refunded && !widget.mine && !claimed;

  String get senderName => widget.sender['nickname']?.toString() ?? 'QChat';

  MoneyPayload get payload => MoneyPayload.parse(widget.message['text']);

  String get greeting {
    final note = payload.note;
    return note.isEmpty ? 'Best wishes' : note;
  }

  String get sentProgress {
    final claimed = MoneyMessageState.claimedCount(widget.message);
    final total = MoneyMessageState.recipientCount(widget.message);
    if (refunded) {
      if (claimed == 0) return 'Đã hoàn tiền';
      if (total <= 1) return 'Đã nhận';
      return 'Đã nhận $claimed/$total · hoàn phần còn lại';
    }
    if (total <= 1) return claimed > 0 ? 'Đã nhận' : 'Chưa nhận';
    return 'Đã nhận $claimed/$total suất';
  }

  void openWallet() {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push('/payments/wallet');
  }

  Future<void> open() async {
    if (opened || widget.mine || opening || refunded) return;
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
    return ColoredBox(
      color: QChatColors.transparent,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: opened ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light,
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
                        scale: Tween<double>(
                          begin: .96,
                          end: 1,
                        ).animate(animation),
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

  Widget _cover(BuildContext c) => RedPacketCover(
    key: const ValueKey('red-packet-cover'),
    sender: widget.sender,
    senderName: senderName,
    greeting: greeting,
    mine: widget.mine,
    opening: opening,
    onClose: () => Navigator.of(context).pop(),
    onOpen: widget.mine || opening || refunded ? null : open,
    footnote: widget.mine
        ? null
        : MoneyMessageState.refundWindowText(widget.message),
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
                      widget.mine
                          ? 'Hồng bao của bạn'
                          : 'Đã gửi bởi $senderName',
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
                      style: TextStyle(color: Color(0xffb2b2b2), fontSize: 12),
                    ),
                  ),
                if (expiredForMe)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      'Hồng bao đã hết hạn',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xff8f8f8f),
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
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
                    child: Column(
                      children: [
                        Text(
                          sentProgress,
                          style: const TextStyle(
                            color: Color(0xffb2b2b2),
                            fontSize: 13,
                          ),
                        ),
                        if (!refunded)
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                              MoneyMessageState.refundWindowText(
                                widget.message,
                              ),
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xffc8c8c8),
                                fontSize: 11,
                              ),
                            ),
                          ),
                      ],
                    ),
                  )
                else if (expiredForMe)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 4, horizontal: 24),
                    child: Text(
                      'Tiền chưa nhận đã được hoàn về người gửi.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xffb2b2b2), fontSize: 13),
                    ),
                  )
                else
                  GestureDetector(
                    onTap: openWallet,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(
                        vertical: 4,
                        horizontal: 10,
                      ),
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
