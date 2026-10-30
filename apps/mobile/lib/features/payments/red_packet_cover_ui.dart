import 'package:flutter/widgets.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../chats/red_packet_cover.dart';
import '../chats/red_packet_design.dart';

/// Coral of the red-packet send button and the cover actions.
const coverCoral = Color(0xffff6144);

/// Flat coral button used by the cover screens. [QChatButton] is green, and
/// these surfaces belong to the red-packet family, so they keep its accent.
class CoralButton extends StatelessWidget {
  const CoralButton(
    this.text, {
    super.key,
    this.onTap,
    this.loading = false,
    this.secondary = false,
    this.height = 44,
  });

  final String text;
  final VoidCallback? onTap;
  final bool loading, secondary;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !loading;
    return Semantics(
      button: true,
      enabled: enabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 120),
          opacity: enabled || loading ? 1 : .45,
          child: Container(
            height: height,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              color: secondary ? surface(context) : coverCoral,
              borderRadius: BorderRadius.circular(5),
              border: secondary
                  ? Border.all(color: qchatLine(context), width: .5)
                  : null,
            ),
            child: loading
                ? const QChatLoading(size: 18)
                : Text(
                    text,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: secondary ? ink(context) : QChatColors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

/// A cover rendered at card size with rounded corners.
class CoverThumb extends StatelessWidget {
  const CoverThumb({
    super.key,
    required this.design,
    this.radius = 6,
    this.showOpen = true,
  });

  final CoverDesign design;
  final double radius;
  final bool showOpen;

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 3 / 4,
    child: CoverArtwork(design: design, showOpen: showOpen, radius: radius),
  );
}

/// White rounded surface used by the gallery rows and cards.
class CoverSurface extends StatelessWidget {
  const CoverSurface({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    padding: padding,
    decoration: BoxDecoration(
      color: surface(context),
      borderRadius: BorderRadius.circular(12),
    ),
    child: child,
  );
}

/// Small designer row: avatar, name and the public designer badge.
class DesignerLine extends StatelessWidget {
  const DesignerLine({
    super.key,
    required this.name,
    this.avatarId,
    this.qchatId = '',
    this.onTap,
    this.color,
  });

  final String name, qchatId;
  final String? avatarId;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final user = <String, dynamic>{
      'nickname': name,
      if ((avatarId ?? '').isNotEmpty) 'avatarId': avatarId,
    };
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          UserAvatar(user, size: 22),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              name.isEmpty ? qchatId : name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, color: color ?? ink(context)),
            ),
          ),
          if (onTap != null) ...[
            const SizedBox(width: 2),
            QChatIcon('chevron', size: 15, color: color ?? QChatColors.muted),
          ],
        ],
      ),
    );
  }
}
