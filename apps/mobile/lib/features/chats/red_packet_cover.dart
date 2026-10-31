import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/media/media_video.dart';
import 'red_packet_design.dart';

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
    this.design = CoverDesign.defaultDesign,
    this.onOpen,
    this.radius = 10,
  });

  final Map sender;
  final String senderName, greeting;
  final bool mine, opening;
  final CoverDesign design;
  final VoidCallback? onOpen;

  /// Corner radius of the card itself. Decorations are drawn outside this clip,
  /// so a designer can hang artwork around the cover's edges.
  final double radius;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: LayoutBuilder(
        builder: (context, box) {
          final height = box.maxHeight, width = box.maxWidth;
          // The lowest point of the arch, and how far its edges rise. The
          // reference seam sags about a fifteenth of the card height, so the
          // curve stays soft instead of reading as a straight diagonal.
          final archY = height * design.topHeight;
          final archDepth = math.min(height * .066, 64.0);
          final diameter = math.min(width * .28, 104.0);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              // The card: both halves and the seam, clipped to its corners.
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(radius),
                  child: Stack(
                    children: [
                      // Below the arch.
                      Positioned(
                        left: 0,
                        right: 0,
                        top: archY - archDepth,
                        bottom: 0,
                        child: RedPacketCoverBottom(design: design),
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
                            design: design,
                            sender: sender,
                            senderName: senderName,
                            greeting: greeting,
                          ),
                        ),
                      ),
                      // The seam between the two halves.
                      if (design.archLine)
                        Positioned(
                          key: const ValueKey('red-packet-cover-seam'),
                          left: 0,
                          right: 0,
                          top: archY - archDepth,
                          height: archDepth,
                          child: IgnorePointer(
                            child: CustomPaint(
                              painter: const _ArchLinePainter(),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              // Decorations that live on both halves, free to spill over the
              // card's edges.
              Positioned.fill(
                child: IgnorePointer(
                  child: _DecorationLayer(design: design, area: 'all'),
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
                  design: design,
                  mine: mine,
                  opening: opening,
                  onTap: onOpen,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// A cover without the sender text, used by galleries and previews.
class CoverArtwork extends StatelessWidget {
  const CoverArtwork({
    super.key,
    required this.design,
    this.showOpen = true,
    this.radius = 8,
  });

  final CoverDesign design;
  final bool showOpen;

  /// Corner radius of the card. Decorations are painted above this clip, so
  /// artwork may hang outside the cover.
  final double radius;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final height = box.maxHeight, width = box.maxWidth;
      final archY = height * design.topHeight;
      final depth = math.min(height * .066, 64.0);
      final diameter = math.min(width * .28, 104.0);
      return Stack(
        clipBehavior: Clip.none,
        children: [
          // The card itself: lower half, flap and seam, clipped to its corners.
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(radius),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    top: archY - depth,
                    bottom: 0,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ColoredBox(color: design.bottomColor),
                        IgnorePointer(
                          child: _DecorationLayer(
                            design: design,
                            area: 'bottom',
                          ),
                        ),
                        if (design.effects.sparkles)
                          IgnorePointer(
                            child: _SparkleLayer(color: design.openColor),
                          ),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    top: 0,
                    height: archY,
                    child: ClipPath(
                      clipper: _ArchClipper(depth: depth),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          CoverBackdrop(design: design),
                          IgnorePointer(
                            child: _DecorationLayer(
                              design: design,
                              area: 'top',
                            ),
                          ),
                          if (design.effects.sparkles)
                            IgnorePointer(
                              child: _SparkleLayer(color: design.openColor),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (design.archLine)
                    Positioned(
                      left: 0,
                      right: 0,
                      top: archY - depth,
                      height: depth,
                      child: IgnorePointer(
                        child: CustomPaint(painter: const _ArchLinePainter()),
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Artwork that belongs to the whole cover, free to spill outside.
          Positioned.fill(
            child: IgnorePointer(
              child: _DecorationLayer(design: design, area: 'all'),
            ),
          ),
          if (showOpen)
            Positioned(
              left: (width - diameter) / 2,
              top: archY - diameter / 2,
              width: diameter,
              height: diameter,
              child: IgnorePointer(
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: design.openColor,
                  ),
                  child: Center(
                    child: Text(
                      design.openLabel,
                      style: TextStyle(
                        color: design.openTextColor,
                        fontSize: diameter * .22,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}

/// The part of the cover above the arch: artwork, decorations, sender and
/// greeting.
class RedPacketCoverTop extends StatelessWidget {
  const RedPacketCoverTop({
    super.key,
    required this.design,
    required this.sender,
    required this.senderName,
    required this.greeting,
    this.showDetails = true,
  });

  final CoverDesign design;
  final Map sender;
  final String senderName, greeting;
  final bool showDetails;

  @override
  Widget build(BuildContext context) {
    return Stack(
      key: const ValueKey('red-packet-cover-top'),
      fit: StackFit.expand,
      children: [
        CoverBackdrop(design: design),
        IgnorePointer(
          child: _DecorationLayer(design: design, area: 'top'),
        ),
        if (design.effects.sparkles)
          IgnorePointer(child: _SparkleLayer(color: design.openColor)),
        if (showDetails)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
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
                          shadows: [
                            Shadow(color: Color(0x66000000), blurRadius: 3),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  greeting,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xffffffff),
                    fontSize: 22,
                    height: 1.35,
                    fontWeight: FontWeight.w500,
                    shadows: [Shadow(color: Color(0x66000000), blurRadius: 3)],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The part of the cover below the arch: background and decorations.
///
/// The close control lives outside the cover, so the card itself stays a clean
/// sheet of paper. Future red-packet features can be added here without
/// touching the top half.
class RedPacketCoverBottom extends StatelessWidget {
  const RedPacketCoverBottom({super.key, required this.design});

  final CoverDesign design;

  @override
  Widget build(BuildContext context) {
    return Stack(
      key: const ValueKey('red-packet-cover-bottom'),
      fit: StackFit.expand,
      children: [
        ColoredBox(color: design.bottomColor),
        IgnorePointer(
          child: _DecorationLayer(design: design, area: 'bottom'),
        ),
        if (design.effects.sparkles)
          IgnorePointer(child: _SparkleLayer(color: design.openColor)),
      ],
    );
  }
}

/// Decorated header of the opened receipt. Its height is controlled by the
/// design (`receiptHeight`), so a designer can push it down over the receipt
/// or keep it as a thin band.
class RedPacketOpenedTop extends StatelessWidget {
  const RedPacketOpenedTop({
    super.key,
    required this.design,
    this.darkInk = false,
  });

  final CoverDesign design;
  final bool darkInk;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _ReceiptArchClipper(),
      child: Stack(
        fit: StackFit.expand,
        children: [
          CoverBackdrop(design: design),
          IgnorePointer(
            child: _DecorationLayer(design: design, area: 'top', receipt: true),
          ),
          if (design.effects.sparkles)
            IgnorePointer(child: _SparkleLayer(color: design.openColor)),
        ],
      ),
    );
  }
}

/// Paints the configured background: solid, gradient, a still picture, or a
/// looping clip. Every picture fills the flap edge to edge, so the artwork below
/// the arch is never touched and never letterboxed.
class CoverBackdrop extends StatelessWidget {
  const CoverBackdrop({super.key, required this.design});

  final CoverDesign design;

  @override
  Widget build(BuildContext context) {
    final background = design.background;
    if (background.isVideo) {
      return MediaVideo(
        id: background.mediaId!,
        fit: BoxFit.cover,
        placeholder: background.color,
        extension: 'webm',
      );
    }
    if (background.isImage) {
      return MediaImage(id: background.mediaId!, fit: BoxFit.cover);
    }
    if (background.type == 'gradient' && background.colors.length >= 2) {
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: background.colors,
          ),
        ),
      );
    }
    return ColoredBox(color: background.color);
  }
}

/// Artwork behind a red-packet message in the chat.
///
/// The bubble is gold where the greeting sits, the message's own picture fades
/// in towards the tail, and a light gold wash stays over that tail so the card
/// keeps a warm red-packet tone after the picture. The cover background is never
/// used here: a message owns its picture through [CoverMessage.imageId].
class CoverMessageBackdrop extends StatelessWidget {
  const CoverMessageBackdrop({super.key, required this.message});

  final CoverMessage message;

  @override
  Widget build(BuildContext context) {
    return Stack(
      key: const ValueKey('red-packet-message-backdrop'),
      fit: StackFit.expand,
      children: [
        // The head of the bubble is pure gold, so the greeting never sits on
        // a busy picture.
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [message.startColor, message.endColor],
            ),
          ),
        ),
        if (message.hasImage) ...[
          // The picture is invisible at the head and fades in towards the
          // tail: a soft blend rather than a hard cut, as in the reference
          // card.
          Positioned.fill(
            child: ShaderMask(
              key: const ValueKey('red-packet-message-image'),
              blendMode: BlendMode.dstIn,
              shaderCallback: (box) => const LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Color(0x00ffffff),
                  Color(0x00ffffff),
                  Color(0xffffffff),
                  Color(0xffffffff),
                ],
                stops: [0, .30, .62, 1],
              ).createShader(box),
              child: MediaImage(id: message.imageId!, fit: BoxFit.cover),
            ),
          ),
          // The picture never reaches full saturation: a warm gold veil stays
          // over it all the way to the tail, so the whole card still reads as
          // gold with the artwork showing through, like the reference.
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                key: const ValueKey('red-packet-message-tail'),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      message.startColor,
                      message.startColor.withValues(alpha: .88),
                      message.startColor.withValues(alpha: .6),
                      message.endColor.withValues(alpha: .5),
                    ],
                    stops: const [0, .30, .62, 1],
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Dresses [child] with the cover's whole-cover decorations.
///
/// The layer is deliberately not clipped: a chat bubble can wear the same
/// artwork as the packet, with pieces hanging around its edges the way a
/// WeChat red packet does.
class CoverDecorationOverlay extends StatelessWidget {
  const CoverDecorationOverlay({
    super.key,
    required this.design,
    required this.child,
    this.area = 'all',
  });

  final CoverDesign design;
  final Widget child;
  final String area;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      child,
      Positioned.fill(
        child: IgnorePointer(
          child: _DecorationLayer(design: design, area: area),
        ),
      ),
    ],
  );
}

/// Lays out the designer's decorations with their idle motion.
class _DecorationLayer extends StatefulWidget {
  const _DecorationLayer({
    required this.design,
    required this.area,
    this.receipt = false,
  });

  final CoverDesign design;
  final String area;
  final bool receipt;

  @override
  State<_DecorationLayer> createState() => _DecorationLayerState();
}

class _DecorationLayerState extends State<_DecorationLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  );

  List<CoverDecoration> get _items => widget.design.decorations
      .where(
        (item) => widget.receipt
            ? item.area == 'top' || item.area == 'all'
            : item.area == widget.area,
      )
      .toList();

  @override
  void initState() {
    super.initState();
    // A bubble that only carries top/bottom artwork has nothing to animate;
    // leaving its clock stopped keeps the chat from scheduling idle frames.
    if (_items.isNotEmpty) _clock.repeat();
  }

  @override
  void didUpdateWidget(covariant _DecorationLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_items.isNotEmpty) {
      if (!_clock.isAnimating) _clock.repeat();
    } else if (_clock.isAnimating) {
      _clock.stop();
    }
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth, height = box.maxHeight;
        return AnimatedBuilder(
          animation: _clock,
          builder: (context, _) {
            final t = _clock.value;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                for (final item in items)
                  Positioned(
                    left: item.x * width - item.size * width / 2,
                    top: item.y * height - item.size * width / 2,
                    width: item.size * width,
                    height: item.size * width,
                    child: _DecoratedItem(
                      item: item,
                      effects: widget.design.effects,
                      t: t,
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _DecoratedItem extends StatelessWidget {
  const _DecoratedItem({
    required this.item,
    required this.effects,
    required this.t,
  });

  final CoverDecoration item;
  final CoverEffects effects;
  final double t;

  @override
  Widget build(BuildContext context) {
    final phase = (item.x * 7 + item.y * 11) % 1;
    final wave = math.sin((t + phase) * math.pi * 2);
    var scale = 1.0, opacity = 1.0;
    var offset = Offset.zero;
    // A decoration's own motion wins; otherwise the cover-wide switches give
    // every still decoration the same idle movement.
    final animation = item.animation != 'none'
        ? item.animation
        : effects.float
        ? 'float'
        : effects.pulse
        ? 'pulse'
        : 'none';
    switch (animation) {
      case 'float':
        offset = Offset(wave * 3, wave * 5);
      case 'pulse':
        scale = 1 + wave * .06;
      case 'sparkle':
        opacity = .35 + .65 * (wave.abs());
    }
    return Transform.translate(
      offset: offset,
      child: Transform.rotate(
        angle: item.rotation,
        child: Transform.scale(
          scale: scale,
          child: Opacity(
            opacity: opacity.clamp(0, 1).toDouble(),
            child: Center(
              child: item.kind == 'image'
                  ? MediaImage(id: item.value, fit: BoxFit.contain)
                  : FittedBox(
                      fit: BoxFit.contain,
                      child: Text(
                        item.value,
                        style: TextStyle(
                          fontSize: 64,
                          height: 1,
                          fontWeight: item.kind == 'text'
                              ? FontWeight.w700
                              : FontWeight.w400,
                          color: const Color(0xffffffff),
                          shadows: const [
                            Shadow(color: Color(0x55000000), blurRadius: 4),
                          ],
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Soft gold sparkles drifting over the cover when the design enables them.
class _SparkleLayer extends StatefulWidget {
  const _SparkleLayer({required this.color});

  final Color color;

  @override
  State<_SparkleLayer> createState() => _SparkleLayerState();
}

class _SparkleLayerState extends State<_SparkleLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  )..repeat();

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _clock,
    builder: (context, _) =>
        CustomPaint(painter: _SparklePainter(widget.color, _clock.value)),
  );
}

class _SparklePainter extends CustomPainter {
  _SparklePainter(this.color, this.t);

  final Color color;
  final double t;

  static const _points = [
    (.14, .18, .8),
    (.82, .12, 1.1),
    (.32, .46, .7),
    (.72, .55, .9),
    (.5, .28, 1.2),
    (.9, .74, .8),
    (.08, .66, 1),
    (.62, .86, .7),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    for (var index = 0; index < _points.length; index++) {
      final (x, y, scale) = _points[index];
      final phase = (t + index / _points.length) % 1;
      final pulse = .25 + .75 * math.sin(phase * math.pi).abs();
      final center = Offset(x * size.width, y * size.height);
      final radius = 1.6 * scale * pulse;
      final paint = Paint()
        ..color = color.withValues(alpha: .75 * pulse)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center, radius, paint);
      final arm = 5.0 * scale * pulse;
      final line = Paint()
        ..color = color.withValues(alpha: .5 * pulse)
        ..strokeWidth = .8
        ..strokeCap = StrokeCap.round;
      canvas
        ..drawLine(center.translate(-arm, 0), center.translate(arm, 0), line)
        ..drawLine(center.translate(0, -arm), center.translate(0, arm), line);
    }
  }

  @override
  bool shouldRepaint(_SparklePainter old) => old.t != t || old.color != color;
}

class _OpenButton extends StatelessWidget {
  const _OpenButton({
    required this.diameter,
    required this.design,
    required this.mine,
    required this.opening,
    this.onTap,
  });

  final double diameter;
  final CoverDesign design;
  final bool mine, opening;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const ValueKey('red-packet-cover-open'),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: design.openColor,
          boxShadow: const [
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
                : design.openLabel,
            style: TextStyle(
              color: design.openTextColor,
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

/// The arch under the decorated header of the opened receipt.
class _ReceiptArchClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    // A shallow sag like the reference seam: the sides sit a little higher
    // than the middle, and the curve meets the card edge instead of cutting
    // across it with a straight diagonal.
    final sag = size.width * .075;
    return Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height - sag)
      ..quadraticBezierTo(
        size.width / 2,
        size.height + sag,
        0,
        size.height - sag,
      )
      ..close();
  }

  @override
  bool shouldReclip(_ReceiptArchClipper old) => false;
}

/// Draws the thin shadowed line that separates the two halves.
class _ArchLinePainter extends CustomPainter {
  const _ArchLinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..quadraticBezierTo(size.width / 2, size.height * 2, size.width, 0);
    // The flap casts a soft shadow on the body, then a single hairline marks
    // the fold. Both stay close to the reference: no thick painted band.
    canvas
      ..drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 9
          ..color = const Color(0x1a000000)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
      )
      ..drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.3
          ..color = const Color(0x30000000),
      );
  }

  @override
  bool shouldRepaint(_ArchLinePainter old) => false;
}
