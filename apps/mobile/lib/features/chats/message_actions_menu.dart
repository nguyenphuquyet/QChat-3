import 'package:tdesign_flutter/tdesign_flutter.dart';

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

/// Opens a TDesign popover anchored to the pressed bubble. The bubble stays
/// visible, the arrow points at it, and the panel flips above when the bottom
/// of the screen is too close.
Future<void> showMessageActions(
  BuildContext context, {
  required BuildContext anchorContext,
  required List<MessageAction> actions,
}) async {
  if (actions.isEmpty) return;
  final anchor = anchorContext.findRenderObject();
  if (anchor is! RenderBox || !anchor.hasSize) return;

  var chosen = -1;
  await TPopover.showPopover(
    context: anchorContext,
    placement: TPopoverPlacement.bottom,
    width: 240,
    closeOnClickOutside: true,
    content: _MessageMenu(
      actions: actions,
      onPick: (index) {
        chosen = index;
        // TDesign registers a local history entry for the popover, so this pop
        // dismisses the menu and keeps the conversation on screen.
        Navigator.of(anchorContext).pop();
      },
    ),
  );
  if (chosen >= 0) actions[chosen].onTap();
}

class _MessageMenu extends StatelessWidget {
  const _MessageMenu({required this.actions, required this.onPick});

  final List<MessageAction> actions;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final theme = context.tTheme;
    final font = theme.fontBodyMedium;
    final radius = BorderRadius.circular(theme.radiusDefault);
    final separator = Container(
      height: .5,
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      color: theme.textColorAnti.withValues(alpha: .16),
    );
    return SizedBox(
      width: 224,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < actions.length; i++) ...[
            if (i > 0 &&
                actions[i].destructive &&
                !actions[i - 1].destructive)
              separator,
            _MenuRow(
              action: actions[i],
              font: font,
              radius: radius,
              onTap: () => onPick(i),
            ),
          ],
        ],
      ),
    );
  }
}

class _MenuRow extends StatefulWidget {
  const _MenuRow({
    required this.action,
    required this.font,
    required this.radius,
    required this.onTap,
  });

  final MessageAction action;
  final Font? font;
  final BorderRadius radius;
  final VoidCallback onTap;

  @override
  State<_MenuRow> createState() => _MenuRowState();
}

class _MenuRowState extends State<_MenuRow> {
  var _pressed = false;

  void _press(bool value) {
    if (_pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.tTheme;
    final color = widget.action.destructive
        ? theme.errorColor
        : theme.textColorAnti;
    return Semantics(
      button: true,
      child: GestureDetector(
        key: ValueKey('message-action-${widget.action.id}'),
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: _pressed
                ? theme.textColorAnti.withValues(alpha: .08)
                : Colors.transparent,
            borderRadius: widget.radius,
          ),
          child: Row(
            children: [
              TIcon(widget.action.icon, size: 18, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: TText(
                  widget.action.label,
                  font: widget.font,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
