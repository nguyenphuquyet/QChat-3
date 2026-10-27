import 'package:flutter/widgets.dart';

import '../localization/strings.dart';
import 'qchat_colors.dart';
import 'qchat_theme.dart';

const qchatOverlayRadius = 16.0;
const qchatOverlayBarrier = Color(0x66000000);
const qchatOverlayDuration = Duration(milliseconds: 200);

Color overlaySurface(BuildContext c) => qchatSurface(c);

/// Bottom sheet drawn by QChat: rounded top, slide-up motion and a dimmed
/// barrier. It replaces the platform bottom sheet so no Material sheet, drag
/// handle or splash is involved.
Future<T?> showQChatSheet<T>(BuildContext context, WidgetBuilder builder) =>
    showGeneralDialog<T>(
      context: context,
      barrierDismissible: true,
      barrierLabel: tr(context, 'cancel'),
      barrierColor: const Color(0x80000000),
      transitionDuration: qchatOverlayDuration,
      pageBuilder: (c, _, _) {
        final media = MediaQuery.of(c);
        return Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: media.size.width,
                maxHeight: media.size.height * .8,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: overlaySurface(c),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(12),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(12),
                  ),
                  child: SafeArea(
                    top: false,
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          builder(c),
                          Container(
                            height: 8,
                            color: qchatDark(c)
                                ? const Color(0xff161616)
                                : const Color(0xfff5f5f5),
                          ),
                          QChatOverlayAction(
                            label: tr(c, 'cancel'),
                            showDivider: false,
                            onTap: () => Navigator.pop(c),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
      transitionBuilder: (c, animation, _, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return SlideTransition(
          position: Tween(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        );
      },
    );

class QChatOverlayAction extends StatelessWidget {
  const QChatOverlayAction({
    super.key,
    required this.label,
    required this.onTap,
    this.showDivider = true,
    this.selected = false,
  });
  final String label;
  final VoidCallback onTap;
  final bool showDivider;
  final bool selected;

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    selected: selected,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(minHeight: 54),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 15),
        decoration: BoxDecoration(
          border: showDivider
              ? Border(
                  bottom: BorderSide(
                    color: qchatDark(c)
                        ? const Color(0xff333333)
                        : const Color(0xffeeeeee),
                    width: .5,
                  ),
                )
              : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 18,
            height: 1.3,
            fontWeight: FontWeight.w400,
            color: selected
                ? QChatColors.green
                : qchatDark(c)
                ? const Color(0xffeeeeee)
                : const Color(0xff191919),
          ),
        ),
      ),
    ),
  );
}

/// Small transient toast used by mini apps. Drawn in an overlay entry so it
/// does not depend on any platform snackbar.
void showQChatToast(
  BuildContext context,
  String message, {
  Duration duration = const Duration(milliseconds: 1800),
}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (c) => Positioned(
      left: 24,
      right: 24,
      bottom: MediaQuery.paddingOf(c).bottom + 90,
      child: IgnorePointer(
        child: Center(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: const Color(0xcc000000),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: 12,
              ),
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: QChatColors.white,
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  Future<void>.delayed(duration, () {
    if (entry.mounted) entry.remove();
  });
}
