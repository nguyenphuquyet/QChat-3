import 'dart:ui' show ImageFilter;
import 'package:flutter/widgets.dart';

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
    this.radius,
    this.blur = 10,
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

  /// Rounded corners for a panel that is not a full-width bar — the scanner's
  /// capsule and discs. Null clips to a rectangle, the shape of a bar.
  final BorderRadius? radius;

  /// Blur strength in Gaussian sigma. A live camera needs a stronger frost than
  /// a scrolling list behind a header.
  final double blur;

  @override
  Widget build(BuildContext context) {
    final glass = BackdropFilter(
      filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
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
    );
    final corners = radius;
    return corners == null
        ? ClipRect(child: glass)
        : ClipRRect(borderRadius: corners, child: glass);
  }
}
