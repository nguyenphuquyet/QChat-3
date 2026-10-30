import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import 'money_message.dart';

/// Cover of a red packet, drawn edge to edge inside its parent card.
///
/// The cover is deliberately split into two independent halves — the part
/// above the arch ([RedPacketCoverTop]) and the part below it
/// ([RedPacketCoverBottom]) — so new red-packet features can extend either
/// half without touching the other. The gold open button straddles the arch
/// and belongs to neither half.
class RedPacketCover extends StatelessWidget {
  const RedPacketCover({
    super.key,
    required this.sender,
    required this.senderName,
    required this.greeting,
    required this.mine,
    required this.opening,
    required this.onClose,
    this.onOpen,
    this.footnote,
  });

  final Map sender;
  final String senderName, greeting;
  final bool mine, opening;
  final VoidCallback onClose;
  final VoidCallback? onOpen;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: ColoredBox(
        color: redPacketRed,
        child: LayoutBuilder(
          builder: (context, box) {
            final height = box.maxHeight, width = box.maxWidth;
            // The lowest point of the arch, and how far its edges rise.
            final archY = height * .80;
            final archDepth = math.min(height * .05, 56.0);
            final diameter = math.min(width * .28, 104.0);

            return Stack(
              children: [
                // Below the arch.
                Positioned(
                  left: 0,
                  right: 0,
                  top: archY - archDepth,
                  bottom: 0,
                  child: RedPacketCoverBottom(footnote: footnote),
                ),
                // Above the arch. Clipped so its bottom edge is the arch.
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: archY,
                  child: ClipPath(
                    clipper: _ArchClipper(depth: archDepth),
                    child: RedPacketCoverTop(
                      sender: sender,
                      senderName: senderName,
                      greeting: greeting,
                      onClose: onClose,
                    ),
                  ),
                ),
                // The seam between the two halves.
                Positioned(
                  left: 0,
                  right: 0,
                  top: archY - archDepth,
                  height: archDepth,
                  child: IgnorePointer(
                    child: CustomPaint(painter: _ArchLinePainter()),
                  ),
                ),
                // The open button sits on the lowest point of the arch, half
                // above it and half below it.
                Positioned(
                  left: (width - diameter) / 2,
                  top: archY - diameter / 2,
                  width: diameter,
                  height: diameter,
                  child: _OpenButton(
                    diameter: diameter,
                    mine: mine,
                    opening: opening,
                    onTap: onOpen,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The part of the cover above the arch: close button, sender and greeting.
class RedPacketCoverTop extends StatelessWidget {
  const RedPacketCoverTop({
    super.key,
    required this.sender,
    required this.senderName,
    required this.greeting,
    required this.onClose,
  });

  final Map sender;
  final String senderName, greeting;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      key: const ValueKey('red-packet-cover-top'),
      color: redPacketRed,
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              key: const ValueKey('red-packet-cover-close'),
              behavior: HitTestBehavior.opaque,
              onTap: onClose,
              child: const Padding(
                padding: EdgeInsets.all(14),
                child: QChatIcon('close', size: 22, color: Color(0xffffffff)),
              ),
            ),
          ),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      UserAvatar(sender, size: 22),
                      const SizedBox(width: 7),
                      Flexible(
                        child: Text(
                          'Đã gửi bởi $senderName',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xffffffff),
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
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
          // Keep the greeting clear of the arch and the gold button.
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

/// The part of the cover below the arch.
///
/// Today it only carries the refund-window footnote; future red-packet
/// features (a cover picker, stickers, …) can be added here without touching
/// the top half.
class RedPacketCoverBottom extends StatelessWidget {
  const RedPacketCoverBottom({super.key, this.footnote});

  final String? footnote;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      key: const ValueKey('red-packet-cover-bottom'),
      color: redPacketRed,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 28, left: 24, right: 24),
          child: footnote == null
              ? const SizedBox.shrink()
              : Text(
                  footnote!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xd9ffffff),
                    fontSize: 11.5,
                  ),
                ),
        ),
      ),
    );
  }
}

class _OpenButton extends StatelessWidget {
  const _OpenButton({
    required this.diameter,
    required this.mine,
    required this.opening,
    this.onTap,
  });

  final double diameter;
  final bool mine, opening;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const ValueKey('red-packet-cover-open'),
      onTap: onTap,
      child: Container(
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
            opening
                ? '...'
                : mine
                ? 'Đã gửi'
                : 'Mở',
            style: TextStyle(
              color: const Color(0xffa8512f),
              fontSize: diameter * .22,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

/// Clips a box so its bottom edge is the arch (deepest in the middle).
class _ArchClipper extends CustomClipper<Path> {
  const _ArchClipper({required this.depth});

  final double depth;

  @override
  Path getClip(Size size) => Path()
    ..moveTo(0, 0)
    ..lineTo(size.width, 0)
    ..lineTo(size.width, size.height - depth)
    ..quadraticBezierTo(
      size.width / 2,
      size.height + depth,
      0,
      size.height - depth,
    )
    ..close();

  @override
  bool shouldReclip(_ArchClipper old) => old.depth != depth;
}

/// Draws the thin shadowed line that separates the two halves.
class _ArchLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..quadraticBezierTo(size.width / 2, size.height * 2, size.width, 0);
    canvas
      ..drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 8
          ..color = const Color(0x1a000000),
      )
      ..drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = const Color(0x40000000),
      );
  }

  @override
  bool shouldRepaint(_ArchLinePainter old) => false;
}
