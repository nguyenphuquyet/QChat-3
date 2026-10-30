import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_design.dart';
import 'red_packet_cover_ui.dart';

/// Opens a cover as a modal popup over the current screen.
///
/// The page behind stays visible through a frosted-glass scrim, so the preview
/// feels like a layer on top of the gallery instead of another route.
Future<void> showRedPacketCoverPreview(
  BuildContext context,
  RedPacketCoverData cover,
) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: tr(context, 'close'),
    barrierColor: const Color(0x00000000),
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (context, animation, secondaryAnimation) =>
        RedPacketCoverPreviewScreen(cover: cover),
    transitionBuilder: (context, animation, _, child) {
      final curved = animation.drive(CurveTween(curve: Curves.easeOutCubic));
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: .96, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// Large preview of a cover: artwork, name, designer, claim/use button and the
/// close control below the card, like the reference.
class RedPacketCoverPreviewScreen extends ConsumerStatefulWidget {
  const RedPacketCoverPreviewScreen({super.key, required this.cover});

  final RedPacketCoverData cover;

  @override
  ConsumerState<RedPacketCoverPreviewScreen> createState() =>
      _RedPacketCoverPreviewScreenState();
}

class _RedPacketCoverPreviewScreenState
    extends ConsumerState<RedPacketCoverPreviewScreen> {
  bool busy = false;
  late bool owned = widget.cover.owned || widget.cover.mine;

  Future<void> _use() async {
    if (busy) return;
    setState(() => busy = true);
    final wasOwned = owned;
    try {
      final client = ref.read(clientProvider);
      if (!owned) {
        await client.post('/wallet/covers/${widget.cover.id}/claim', {});
        owned = true;
      }
      await client.post('/wallet/covers/${widget.cover.id}/select', {});
      client.changes.add(null);
      if (!mounted) return;
      showQChatToast(
        context,
        tr(context, wasOwned ? 'coverInUse' : 'coverReceived'),
      );
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) {
    final design = widget.cover.design;
    final screenWidth = MediaQuery.sizeOf(c).width;
    final cardWidth = (screenWidth * .82).clamp(264.0, 340.0);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).maybePop(),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Frosted glass over the gallery/studio that opened this popup.
          ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
              child: ColoredBox(
                color: qchatBackground(c).withValues(alpha: .46),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 28,
                ),
                child: GestureDetector(
                  // Keep taps inside the card from dismissing the popup.
                  behavior: HitTestBehavior.opaque,
                  onTap: () {},
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: cardWidth,
                        padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                        clipBehavior: Clip.antiAlias,
                        decoration: BoxDecoration(
                          color: surface(c),
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x33000000),
                              blurRadius: 32,
                              offset: Offset(0, 14),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CoverThumb(design: design, radius: 12),
                            const SizedBox(height: 18),
                            Text(
                              widget.cover.id == 'default'
                                  ? tr(c, 'defaultCover')
                                  : widget.cover.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: ink(c),
                              ),
                            ),
                            if (widget.cover.designerName.isNotEmpty ||
                                widget.cover.designerQchatId.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              DesignerLine(
                                name: widget.cover.designerName,
                                avatarId: widget.cover.designerAvatar,
                                qchatId: widget.cover.designerQchatId,
                                onTap: (widget.cover.designerId ?? '').isEmpty
                                    ? null
                                    : () => c.push(
                                        '/red-packets/designers/${widget.cover.designerId}',
                                      ),
                              ),
                            ],
                            const SizedBox(height: 20),
                            SizedBox(
                              width: double.infinity,
                              child: CoralButton(
                                owned
                                    ? tr(c, 'useCover')
                                    : tr(c, 'receiveCover'),
                                height: 48,
                                loading: busy,
                                onTap: _use,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      GestureDetector(
                        key: const ValueKey('cover-preview-close'),
                        behavior: HitTestBehavior.opaque,
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xf2ffffff),
                            border: Border.all(
                              color: const Color(0x22000000),
                              width: 1,
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x26000000),
                                blurRadius: 12,
                                offset: Offset(0, 3),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: QChatIcon(
                              'close',
                              size: 24,
                              color: Color(0xff5a4034),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
