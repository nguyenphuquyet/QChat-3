import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../localization/strings.dart';

const qchatOverlayRadius = 16.0;
const qchatOverlayBarrier = Color(0x66000000);
const qchatOverlayDuration = Duration(milliseconds: 200);

Color overlaySurface(BuildContext c) =>
    Theme.of(c).brightness == Brightness.dark
    ? const Color(0xff202020)
    : Colors.white;

Future<T?> showQChatSheet<T>(BuildContext context, WidgetBuilder builder) =>
    showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: overlaySurface(context),
      barrierColor: const Color(0x80000000),
      showDragHandle: false,
      constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      clipBehavior: Clip.antiAlias,
      builder: (c) => SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(c).bottom),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(c).height * .8,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  builder(c),
                  Container(
                    height: 8,
                    color: Theme.of(c).brightness == Brightness.dark
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
    child: InkWell(
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
                    color: Theme.of(c).brightness == Brightness.dark
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
                ? const Color(0xff07c160)
                : Theme.of(c).brightness == Brightness.dark
                ? const Color(0xffeeeeee)
                : const Color(0xff191919),
          ),
        ),
      ),
    ),
  );
}
