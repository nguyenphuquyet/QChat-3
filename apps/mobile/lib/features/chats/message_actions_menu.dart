import 'package:tdesign_flutter/tdesign_flutter.dart';

import '../../core/design_system/components.dart';

/// One entry in the long-press menu for a message.
class MessageAction {
  const MessageAction({
    required this.id,
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final String id;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;
}

/// Opens a compact popover next to the pressed bubble: a small rounded card
/// with one row per action, anchored to [anchorContext]. It keeps the
/// conversation visible instead of covering the bottom of the screen.
Future<void> showMessageActions(
  BuildContext context, {
  required BuildContext anchorContext,
  required List<MessageAction> actions,
}) async {
  if (actions.isEmpty) return;
  final anchor = anchorContext.findRenderObject();
  final overlay = Overlay.of(context).context.findRenderObject();
  if (anchor is! RenderBox || !anchor.hasSize || overlay is! RenderBox) return;
  final topLeft = anchor.localToGlobal(Offset.zero, ancestor: overlay);
  final dark = Theme.of(context).brightness == Brightness.dark;
  final muted = dark ? const Color(0xffd6d6d6) : const Color(0xff555555);
  final selected = await showMenu<int>(
    context: context,
    position: RelativeRect.fromRect(
      Rect.fromLTWH(
        topLeft.dx,
        topLeft.dy,
        anchor.size.width,
        anchor.size.height,
      ),
      Offset.zero & overlay.size,
    ),
    color: dark ? const Color(0xff2a2a2a) : Colors.white,
    elevation: 14,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    constraints: const BoxConstraints(minWidth: 208, maxWidth: 232),
    items: [
      for (var i = 0; i < actions.length; i++) ...[
        if (i > 0 && actions[i].destructive && !actions[i - 1].destructive)
          const PopupMenuDivider(height: 9),
        PopupMenuItem<int>(
          key: ValueKey('message-action-${actions[i].id}'),
          value: i,
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              TIcon(
                actions[i].icon,
                size: 19,
                color: actions[i].destructive ? QChatColors.danger : muted,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  actions[i].label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                    color: actions[i].destructive
                        ? QChatColors.danger
                        : dark
                        ? const Color(0xffeeeeee)
                        : QChatColors.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ],
  );
  if (selected != null) actions[selected].onTap();
}
