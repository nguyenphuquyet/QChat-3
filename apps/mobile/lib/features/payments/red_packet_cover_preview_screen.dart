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
/// The page behind stays visible through a dimmed scrim, so the preview feels
/// like a layer on top of the gallery instead of another route.
Future<void> showRedPacketCoverPreview(
  BuildContext context,
  RedPacketCoverData cover,
) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: tr(context, 'close'),
    barrierColor: const Color(0x00000000),
    // The screen owns the motion: it starts its own controller once the first
    // frame is on screen and reverses it before popping. A route transition
    // would start ticking while that first frame is still being built, and the
    // preview's artwork can take long enough to skip the whole entrance.
    transitionDuration: const Duration(milliseconds: 1),
    pageBuilder: (context, animation, secondaryAnimation) =>
        RedPacketCoverPreviewScreen(cover: cover),
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
    extends ConsumerState<RedPacketCoverPreviewScreen>
    with SingleTickerProviderStateMixin {
  bool busy = false;
  late bool owned = widget.cover.owned || widget.cover.mine;
  bool _closing = false;

  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 280),
  );

  /// Card entrance/exit.
  late final CurvedAnimation _curve = CurvedAnimation(
    parent: _fade,
    curve: Curves.easeOutCubic,
    reverseCurve: Curves.easeInCubic,
  );

  /// Veil entrance/exit. `easeInOutSine` starts slowly, so the frost grows
  /// instead of slamming on in the first few frames the way `easeOutCubic`
  /// does; `easeInCubic` on the way out clears it as soon as the tap lands.
  late final CurvedAnimation _scrim = CurvedAnimation(
    parent: _fade,
    curve: Curves.easeInOutSine,
    reverseCurve: Curves.easeInCubic,
  );

  @override
  void initState() {
    super.initState();
    // Wait until the first frame has been built and painted before starting
    // the clock. The card decodes a cover thumbnail (and may prepare a clip),
    // and doing that while the entrance runs made the popup appear fully
    // formed on slower devices.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _fade.forward();
    });
  }

  @override
  void dispose() {
    _curve.dispose();
    _scrim.dispose();
    _fade.dispose();
    super.dispose();
  }

  /// Plays the exit and only then removes the route, so tapping the dimmed
  /// backdrop cannot cut the fade short.
  Future<void> _dismiss() async {
    if (_closing) return;
    _closing = true;
    await _fade.reverse();
    if (mounted) Navigator.of(context).pop();
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
    return PopScope(
      // Intercept every pop (Android back, barrier) so the veil can play its
      // exit before the route disappears.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _dismiss();
      },
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _dismiss,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Dims the gallery/studio that opened this popup. No backdrop
            // blur: animating a full-screen filter dropped frames on phones.
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
                              padding: const EdgeInsets.fromLTRB(
                                18,
                                18,
                                18,
                                18,
                              ),
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
                                          (widget.cover.designerId ?? '')
                                              .isEmpty
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
      ),
    );
  }
}

/// Fades the card and its close control in and out, separately from the scrim.
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

/// Dim veil over the screen behind the popup.
///
/// A plain scrim, deliberately not a [BackdropFilter]. The frosted version had
/// to animate a full-screen blur radius, which on a phone drops frames and
/// makes the veil appear in steps instead of fading in.
class _PreviewBackdrop extends StatelessWidget {
  const _PreviewBackdrop({required this.animation});

  static const scrimKey = ValueKey('cover-preview-scrim');

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) => FadeTransition(
    key: scrimKey,
    opacity: animation,
    child: const ColoredBox(color: qchatOverlayBarrier),
  );
}
