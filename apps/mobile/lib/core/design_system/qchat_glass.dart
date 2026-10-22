import 'dart:ui' show ImageFilter;
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'components.dart';

/// A restrained glass surface; clip the filter to the bar, never the full page.
class QChatGlass extends StatelessWidget {
  const QChatGlass({
    super.key,
    required this.child,
    this.topBorder = false,
    this.border = true,
    this.color,
    this.opacity = .84,
  });
  final Widget child;
  final bool topBorder;

  /// When false the surface draws no hairline, so two glass bars can stack
  /// without a visible seam.
  final bool border;

  /// Tint under the blur. Callers pass the page background so the bar keeps
  /// the same color as the screen it floats over.
  final Color? color;

  final double opacity;

  @override
  Widget build(BuildContext context) => ClipRect(
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: (color ?? navigationSurface(context)).withValues(
            alpha: opacity,
          ),
          border: border
              ? Border(
                  top: topBorder
                      ? BorderSide(
                          color: ink(context).withValues(alpha: .07),
                          width: .5,
                        )
                      : BorderSide.none,
                  bottom: topBorder
                      ? BorderSide.none
                      : BorderSide(
                          color: ink(context).withValues(alpha: .05),
                          width: .5,
                        ),
                )
              : null,
        ),
        child: child,
      ),
    ),
  );
}
