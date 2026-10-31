import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../payments/payments_screen.dart';
import 'money_message.dart';
import 'red_packet_cover.dart';
import 'red_packet_design.dart';

/// Compact red-packet popup with a cover, receipt, and sticker shortcut.
///
/// Tapping "Mở" grows the card from its centred popup size to the full page
/// while the receipt takes over, which is the "bung từ giữa ra trang" motion of
/// the reference. The cover and the decorated receipt header both read their
/// colours, height and decorations from the sender's [CoverDesign].
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

class _RedPacketScreenState extends State<RedPacketScreen>
    with SingleTickerProviderStateMixin {
  bool opened = false;
  bool opening = false;
  int? openedAmount;
  late final AnimationController _expand = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

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
    if (opened) _expand.value = 1;
  }

  @override
  void dispose() {
    _expand.dispose();
    super.dispose();
  }

  bool get refunded => MoneyMessageState.isRefunded(widget.message);
  bool get claimed => MoneyMessageState.claimedByMe(widget.message);
  bool get expiredForMe => refunded && !widget.mine && !claimed;

  String get senderName => widget.sender['nickname']?.toString() ?? 'QChat';

  MoneyPayload get payload => MoneyPayload.parse(widget.message['text']);

  CoverDesign get design => payload.cover ?? CoverDesign.defaultDesign;

  String get greeting {
    final note = payload.note;
    return note.isEmpty ? 'Hồng bao' : note;
  }

  /// `· chia đều` / `· chia ngẫu nhiên` for a group packet. Single-recipient
  /// packets have nothing to explain, so they stay silent.
  String get splitLabel {
    if (MoneyMessageState.recipientCount(widget.message) <= 1) return '';
    return switch (MoneyMessageState.splitMode(widget.message)) {
      'EQUAL' => ' · chia đều',
      'RANDOM' => ' · chia ngẫu nhiên',
      _ => '',
    };
  }

  String get sentProgress {
    final claimed = MoneyMessageState.claimedCount(widget.message);
    final total = MoneyMessageState.recipientCount(widget.message);
    final mode = splitLabel;
    if (refunded) {
      if (claimed == 0) return 'Đã hoàn tiền$mode';
      if (total <= 1) return 'Đã nhận';
      return 'Đã nhận $claimed/$total · hoàn phần còn lại$mode';
    }
    if (total <= 1) return claimed > 0 ? 'Đã nhận' : 'Chưa nhận';
    return 'Đã nhận $claimed/$total suất$mode';
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
    if (opened) _expand.forward();
  }

  @override
  Widget build(BuildContext c) {
    return ColoredBox(
      color: QChatColors.transparent,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: opened ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final screenWidth = constraints.maxWidth;
            final screenHeight = constraints.maxHeight;
            final insets = MediaQuery.paddingOf(context);
            // The reference packet is a tall 3:4.6 card, not a short banner.
            final cardWidth = math.min(360.0, screenWidth * .82);
            final cardHeight = math.min(
              cardWidth * 1.53,
              screenHeight - insets.top - insets.bottom - 140,
            );
            return AnimatedBuilder(
              animation: _expand,
              builder: (context, _) {
                final t = Curves.easeOutCubic.transform(_expand.value);
                final width = cardWidth + (screenWidth - cardWidth) * t;
                final height = cardHeight + (screenHeight - cardHeight) * t;
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Center(
                      child: SizedBox(
                        width: width,
                        height: height,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(10 * (1 - t)),
                          child: opened ? _opened(c, height) : _cover(c),
                        ),
                      ),
                    ),
                    // The close control is not part of the cover: it floats
                    // below the card so the packet stays a clean sheet.
                    if (!opened)
                      Positioned(
                        left: 0,
                        right: 0,
                        top: (screenHeight + height) / 2 + 16,
                        child: Center(
                          child: _CoverCloseOutside(
                            onTap: () => Navigator.of(context).pop(),
                          ),
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _cover(BuildContext c) => RedPacketCover(
    key: const ValueKey('red-packet-cover'),
    design: design,
    sender: widget.sender,
    senderName: senderName,
    greeting: greeting,
    mine: widget.mine,
    opening: opening,
    onOpen: widget.mine || opening || refunded ? null : open,
  );

  Widget _opened(BuildContext c, double height) {
    final header = (height * design.receiptHeight)
        .clamp(96.0, height * .62)
        .toDouble();
    return SizedBox.expand(
      key: const ValueKey('red-packet-opened'),
      child: ColoredBox(
        color: const Color(0xffffffff),
        child: Stack(
          children: [
            Column(
              children: [
                SizedBox(
                  height: header,
                  width: double.infinity,
                  child: RedPacketOpenedTop(design: design),
                ),
                Expanded(child: SafeArea(top: false, child: _receipt(c))),
              ],
            ),
            Positioned(
              top: 8 + MediaQuery.paddingOf(context).top,
              left: 6,
              child: GestureDetector(
                key: const ValueKey('red-packet-opened-close'),
                behavior: HitTestBehavior.opaque,
                onTap: () => Navigator.of(context).pop(),
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: QChatIcon('close', size: 21, color: Color(0xffffffff)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _receipt(BuildContext c) {
    final amount = widget.mine
        ? payload.amount
        : (openedAmount ?? payload.amount);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              UserAvatar(widget.sender, size: 22),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  widget.mine ? 'Hồng bao của bạn' : 'Đã gửi bởi $senderName',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xffb2b2b2),
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            greeting,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xffb2b2b2), fontSize: 14),
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
                  moneyText(amount, withUnit: false),
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
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 10),
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
                        MoneyMessageState.refundWindowText(widget.message),
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
                padding: EdgeInsets.symmetric(vertical: 4, horizontal: 10),
                child: Text(
                  'Đã chuyển vào Ví  ›',
                  style: TextStyle(color: Color(0xffb2b2b2), fontSize: 13),
                ),
              ),
            ),
          if (!widget.mine) ...[
            const SizedBox(height: 22),
            Container(width: 262, height: 1, color: const Color(0xffeeeeee)),
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
                      style: TextStyle(fontSize: 16, color: Color(0xffa0a0a0)),
                    ),
                    SizedBox(width: 7),
                    Text(
                      'Trả lời bằng một Nhãn dán',
                      style: TextStyle(fontSize: 12, color: Color(0xff8f8f8f)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Close control that floats below the packet instead of sitting on the cover.
class _CoverCloseOutside extends StatelessWidget {
  const _CoverCloseOutside({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    key: const ValueKey('red-packet-cover-close'),
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(0xf2ffffff),
        border: Border.all(color: const Color(0x22000000), width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x26000000),
            blurRadius: 12,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: const Center(
        child: QChatIcon('close', size: 24, color: Color(0xff5a4034)),
      ),
    ),
  );
}
