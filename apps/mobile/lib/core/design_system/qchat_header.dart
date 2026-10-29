import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/widgets.dart';

import 'qchat_colors.dart';
import 'qchat_glass.dart';
import 'qchat_theme.dart';

/// Height of the header bar itself, under the status bar.
///
/// 44 is the height the app shares, so a title, an icon and the controls always
/// sit on the same line. A bar that carries a [QChatCapsule] is a little taller
/// ([kQChatCapsuleBarHeight]) so the pill keeps 6 pt of air above and below.
const double kQChatHeaderHeight = 44;

/// The QChat header standard.
///
/// One bar under the status bar with an optional leading control, a centred
/// title and an optional trailing control. Every child is centred on that same
/// bar, so a title, an icon and the [QChatCapsule] share one baseline no matter
/// which of them is present.
///
/// The header can grow downwards through [bottom] (a search field, tabs, a
/// banner, an image…) and its surface can be solid, glass ([blur]) or fully
/// [transparent], which is what a mini program needs when its own artwork runs
/// under the top edge.
class QChatHeader extends StatelessWidget {
  const QChatHeader({
    super.key,
    this.title,
    this.subtitle,
    this.titleStyle,
    this.subtitleStyle,
    this.leading,
    this.trailing,
    this.bottom,
    this.background,
    this.transparent = false,
    this.blur = false,
    this.border = false,
    this.safeArea = true,
    this.height = kQChatHeaderHeight,
    this.reserveLeading = 56,
    this.reserveTrailing = 56,
    this.bottomPadding = EdgeInsets.zero,
  });

  /// Centred, single line. Null hides the title but keeps the bar height.
  final String? title;

  /// Optional second line under the title (still centred on the bar).
  final String? subtitle;

  final TextStyle? titleStyle;
  final TextStyle? subtitleStyle;

  /// Left control, vertically centred (usually a back arrow).
  final Widget? leading;

  /// Right control, vertically centred. Mini apps pass a [QChatCapsule].
  final Widget? trailing;

  /// Anything that belongs to the header but needs its own row: a search
  /// field, tabs, a picture. It is laid out under the bar inside the same
  /// surface, so it scrolls with the header instead of over it.
  final Widget? bottom;

  /// Surface colour. Defaults to the theme surface.
  final Color? background;

  /// Draws no surface at all: the header floats over the content below it.
  final bool transparent;

  /// Blurs what is behind the header instead of painting an opaque surface.
  final bool blur;

  /// Hairline under the header. Ignored when [transparent] is true.
  final bool border;

  /// Reads the status bar inset itself.
  final bool safeArea;

  final double height;

  /// How much room the title leaves on each side. The larger of the two is
  /// applied to both sides, which keeps the title centred on the screen even
  /// when the leading and trailing controls have different widths.
  final double reserveLeading;
  final double reserveTrailing;

  final EdgeInsets bottomPadding;

  @override
  Widget build(BuildContext context) {
    final topInset = safeArea ? MediaQuery.paddingOf(context).top : 0.0;
    final titleInset = math.max(reserveLeading, reserveTrailing);
    final bar = SizedBox(
      height: height,
      child: Stack(
        children: [
          Positioned.fill(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: titleInset),
              child: Center(child: _titles(context)),
            ),
          ),
          if (leading != null)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Center(child: leading),
              ),
            ),
          if (trailing != null)
            Positioned(
              right: 0,
              top: 0,
              bottom: 0,
              child: Padding(
                padding: const EdgeInsets.only(right: 7),
                child: Center(child: trailing),
              ),
            ),
        ],
      ),
    );
    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (topInset > 0) SizedBox(height: topInset),
        bar,
        if (bottom != null)
          Padding(padding: bottomPadding, child: bottom),
      ],
    );
    if (transparent) return content;
    final surfaceColor = background ?? qchatSurface(context);
    if (blur) {
      return QChatGlass(color: surfaceColor, border: border, child: content);
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: surfaceColor,
        border: border
            ? Border(
                bottom: BorderSide(color: qchatLine(context), width: .5),
              )
            : null,
      ),
      child: content,
    );
  }

  Widget _titles(BuildContext context) {
    final text = title;
    final sub = subtitle;
    if (text == null && sub == null) return const SizedBox.shrink();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (text != null)
          Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style:
                titleStyle ??
                const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          ),
        if (sub != null)
          Text(
            sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style:
                subtitleStyle ??
                TextStyle(fontSize: 11, height: 1.25, color: qchatMuted(context)),
          ),
      ],
    );
  }
}

/// Width of the capsule, matching the mini program control the screenshots
/// come from.
const double kQChatCapsuleWidth = 98;

/// Height of the capsule.
const double kQChatCapsuleHeight = 36;

/// Height of the bar a capsule rides in: the pill plus 6 pt above and below.
///
/// The mini program shell and a `NavBar` use this instead of
/// [kQChatHeaderHeight] so the bigger control keeps the same breathing room and
/// the title stays on the capsule's line. The extra 4 pt also push the floating
/// host header, and the Mini App title under it, a little further down.
const double kQChatCapsuleBarHeight = kQChatCapsuleHeight + 12;

/// The mini program control: one frosted pill with a menu on the left and a
/// close on the right, separated by a hairline.
///
/// The pill is not a solid block: it is a translucent tint over a blur of
/// whatever sits behind it, so the page shows through the way it does in the
/// reference screenshots. The two halves are independent buttons, so the pill
/// is one visual object with two tap targets, always vertically centred on the
/// header bar.
class QChatCapsule extends StatelessWidget {
  const QChatCapsule({
    super.key,
    this.onMenu,
    this.onClose,
    this.menuLabel = '',
    this.closeLabel = '',
    this.color,
    this.background,
    this.width = kQChatCapsuleWidth,
    this.height = kQChatCapsuleHeight,
  });

  final VoidCallback? onMenu;
  final VoidCallback? onClose;

  /// Accessibility labels. Empty means the half is decorative.
  final String menuLabel;
  final String closeLabel;

  /// Glyph colour. Defaults to the theme ink.
  final Color? color;

  /// Pill tint. Defaults to a translucent theme surface (white in light mode,
  /// dark grey in dark mode) over a blur of the content behind it.
  final Color? background;

  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final dark = qchatDark(context);
    final glyph = color ?? (dark ? QChatColors.white : QChatColors.ink);
    final pill =
        background ??
        (dark
            ? const Color(0xff2a2a2a).withValues(alpha: .62)
            : QChatColors.white.withValues(alpha: .68));
    final hairline = dark
        ? QChatColors.white.withValues(alpha: .14)
        : QChatColors.black.withValues(alpha: .06);
    final divider = dark
        ? QChatColors.white.withValues(alpha: .16)
        : QChatColors.black.withValues(alpha: .1);
    final overlay = dark
        ? QChatColors.white.withValues(alpha: .1)
        : QChatColors.black.withValues(alpha: .05);
    final radius = BorderRadius.circular(height / 2);
    // The shadow and the blur live on different widgets: the blur has to be
    // clipped to the pill, and clipping the shadow would cut it off.
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: QChatColors.black.withValues(alpha: .08),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: pill,
              borderRadius: radius,
              border: Border.all(color: hairline, width: .5),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _CapsuleHalf(
                    label: menuLabel,
                    onTap: onMenu,
                    overlay: overlay,
                    child: _Dots(color: glyph),
                  ),
                ),
                Container(width: .5, height: height * .56, color: divider),
                Expanded(
                  child: _CapsuleHalf(
                    label: closeLabel,
                    onTap: onClose,
                    overlay: overlay,
                    child: _Ring(color: glyph),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CapsuleHalf extends StatefulWidget {
  const _CapsuleHalf({
    required this.label,
    required this.onTap,
    required this.overlay,
    required this.child,
  });

  final String label;
  final VoidCallback? onTap;
  final Color overlay;
  final Widget child;

  @override
  State<_CapsuleHalf> createState() => _CapsuleHalfState();
}

class _CapsuleHalfState extends State<_CapsuleHalf> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final interactive = widget.onTap != null;
    return Semantics(
      button: interactive,
      label: widget.label.isEmpty ? null : widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: interactive ? (_) => _setPressed(true) : null,
        onTapUp: interactive ? (_) => _setPressed(false) : null,
        onTapCancel: interactive ? () => _setPressed(false) : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          // The same 120 ms fade `CupertinoButton` uses for its highlight.
          curve: Curves.easeOutCubic,
          color: _pressed ? widget.overlay : QChatColors.transparent,
          alignment: Alignment.center,
          child: widget.child,
        ),
      ),
    );
  }
}

/// The three dots of the menu half.
class _Dots extends StatelessWidget {
  const _Dots({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var index = 0; index < 3; index++) ...[
        if (index > 0) const SizedBox(width: 4.8),
        Container(
          width: 5,
          height: 5,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ],
    ],
  );
}

/// The circle-and-dot of the close half.
class _Ring extends StatelessWidget {
  const _Ring({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: 18,
    height: 18,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(color: color, width: 1.9),
    ),
    alignment: Alignment.center,
    child: Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    ),
  );
}
