import 'dart:ui' show ImageFilter;
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'components.dart';

/// A restrained glass surface; clip the filter to the bar, never the full page.
class QChatGlass extends StatelessWidget {
  const QChatGlass({super.key, required this.child, this.topBorder = false});
  final Widget child;
  final bool topBorder;

  @override
  Widget build(BuildContext context) => ClipRect(
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: navigationSurface(context).withValues(alpha: .84),
          border: Border(
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
          ),
        ),
        child: child,
      ),
    ),
  );
}
