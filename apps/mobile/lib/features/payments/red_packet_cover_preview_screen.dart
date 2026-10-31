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
    transitionDuration: const Duration(milliseconds: 280),
    // No transition builder: the screen animates its own layers. Wrapping the
    // whole page in a [FadeTransition] put the [BackdropFilter] inside an
    // opacity layer, which has no backdrop to blur, so the veil stayed sharp
    // for the whole entrance and then blurred in one frame when the layer
    // disappeared. See [_PreviewBackdrop].
    pageBuilder: (context, animation, secondaryAnimation) =>
        RedPacketCoverPreviewScreen(cover: cover, animation: animation),
  );
}

/// Large preview of a cover: artwork, name, designer, claim/use button and the
/// close control below the card, like the reference.
class RedPacketCoverPreviewScreen extends ConsumerStatefulWidget {
  const RedPacketCoverPreviewScreen({
    super.key,
    required this.cover,
    this.animation,
  });

  final RedPacketCoverData cover;

  /// Route animation that grows the card out of the scrim and fades the
  /// frosted veil. Null when the screen is built directly, as in tests.
  final Animation<double>? animation;

  @override
  ConsumerState<RedPacketCoverPreviewScreen> createState() =>
      _RedPacketCoverPreviewScreenState();
}

class _RedPacketCoverPreviewScreenState
    extends ConsumerState<RedPacketCoverPreviewScreen> {
  bool busy = false;
  late bool owned = widget.cover.owned || widget.cover.mine;

  /// Card entrance/exit.
  CurvedAnimation? _curve;

  /// Veil entrance/exit. `easeInOutSine` starts slowly, so the frost grows
  /// instead of slamming on in the first few frames the way `easeOutCubic`
  /// does; `easeInCubic` on the way out clears it as soon as the tap lands.
  CurvedAnimation? _scrim;

  @override
  void initState() {
    super.initState();
    final animation = widget.animation;
    if (animation != null) {
      _curve = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      _scrim = CurvedAnimation(
        parent: animation,
        curve: Curves.easeInOutSine,
        reverseCurve: Curves.easeInCubic,
      );
    }
  }

  @override
  void dispose() {
    _curve?.dispose();
    _scrim?.dispose();
    super.dispose();
  }

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
          // Frosted glass over the gallery/studio that opened this popup. The
          // blur and tint are animated on this layer itself: a
          // [BackdropFilter] only blurs what is painted beneath it in the same
          // layer, so wrapping the page in an opacity layer would hide the
          // frost until the layer vanished.
          _PreviewBackdrop(animation: _scrim),
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
                  child: _PopupFade(
                    animation: _curve,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _PopupScale(
                          animation: _curve,
                          child: Container(
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
                                    widget
                                        .cover
                                        .designerQchatId
                                        .isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  DesignerLine(
                                    name: widget.cover.designerName,
                                    avatarId: widget.cover.designerAvatar,
                                    qchatId: widget.cover.designerQchatId,
                                    onTap:
                                        (widget.cover.designerId ?? '').isEmpty
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
          ),
        ],
      ),
    );
  }
}

/// Fades the card and its close control in and out.
///
/// This layer holds no [BackdropFilter], so an opacity layer is safe here; the
/// veil is animated separately in [_PreviewBackdrop].
class _PopupFade extends StatelessWidget {
  const _PopupFade({required this.animation, required this.child});

  final Animation<double>? animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final animation = this.animation;
    if (animation == null) return child;
    return FadeTransition(
      key: const ValueKey('cover-preview-fade'),
      opacity: animation,
      child: child,
    );
  }
}

/// Grows the card out of the scrim and shrinks it back when the popup closes.
class _PopupScale extends StatelessWidget {
  const _PopupScale({required this.animation, required this.child});

  final Animation<double>? animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final animation = this.animation;
    if (animation == null) return child;
    return ScaleTransition(
      scale: Tween<double>(begin: .92, end: 1).animate(animation),
      child: child,
    );
  }
}

/// Frosted veil over the screen behind the popup.
///
/// The blur and the tint grow together with the route animation. Keeping the
/// filter on this layer, rather than fading a whole page that contains it,
/// matters: a [BackdropFilter] only blurs what is painted beneath it in the
/// same layer, so an opacity ancestor leaves nothing to blur and the frost
/// appears in a single frame when that layer is dropped.
class _PreviewBackdrop extends StatelessWidget {
  const _PreviewBackdrop({this.animation});

  /// Blur radius at full strength.
  static const _sigma = 26.0;

  final Animation<double>? animation;

  @override
  Widget build(BuildContext context) {
    final animation = this.animation;
    if (animation == null) return _layer(context, 1);
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) => _layer(context, animation.value),
    );
  }

  Widget _layer(BuildContext context, double t) => ClipRect(
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: _sigma * t, sigmaY: _sigma * t),
      child: ColoredBox(
        color: qchatBackground(context).withValues(alpha: .46 * t),
      ),
    ),
  );
}
