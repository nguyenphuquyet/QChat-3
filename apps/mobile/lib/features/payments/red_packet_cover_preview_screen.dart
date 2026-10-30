import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_cover.dart';
import '../chats/red_packet_design.dart';
import 'red_packet_cover_ui.dart';

/// Large preview of a cover: artwork, name, designer, claim/use button and the
/// close control at the bottom, like the reference.
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
    return ColoredBox(
      color: qchatBackground(c),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // The cover itself is the blurred backdrop of the reference.
          IgnorePointer(
            child: Opacity(
              opacity: .35,
              child: CoverArtwork(design: design, showOpen: false),
            ),
          ),
          ColoredBox(color: design.overlayColor.withValues(alpha: .32)),
          SafeArea(
            child: Column(
              children: [
                Expanded(
                  child: Center(
                    child: Container(
                      width: (MediaQuery.sizeOf(c).width * .76).clamp(
                        240.0,
                        340.0,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x33000000),
                            blurRadius: 24,
                            offset: Offset(0, 10),
                          ),
                        ],
                      ),
                      child: CoverThumb(
                        design: design,
                        radius: 8,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
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
                const SizedBox(height: 10),
                if (widget.cover.designerName.isNotEmpty ||
                    widget.cover.designerQchatId.isNotEmpty)
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
                const SizedBox(height: 24),
                SizedBox(
                  width: (MediaQuery.sizeOf(c).width * .72).clamp(
                    220.0,
                    320.0,
                  ),
                  child: CoralButton(
                    owned ? tr(c, 'useCover') : tr(c, 'receiveCover'),
                    height: 48,
                    loading: busy,
                    onTap: _use,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  key: const ValueKey('cover-preview-close'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: coverCoral, width: 1.4),
                    ),
                    child: const Center(
                      child: QChatIcon('close', size: 22, color: coverCoral),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
