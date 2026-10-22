import 'package:tdesign_flutter/tdesign_flutter.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// One row in the long-press action sheet for a message.
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

/// Rounded sheet with a quoted preview of the message and one full-width row
/// per action. Destructive actions are separated by a hairline so they are
/// harder to hit by accident.
Future<void> showMessageActionSheet(
  BuildContext context, {
  required String preview,
  required List<MessageAction> actions,
}) => showModalBottomSheet<void>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  backgroundColor: Colors.transparent,
  barrierColor: const Color(0x80000000),
  constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width),
  builder: (c) => MessageActionSheet(preview: preview, actions: actions),
);

class MessageActionSheet extends StatelessWidget {
  const MessageActionSheet({
    super.key,
    required this.preview,
    required this.actions,
  });

  final String preview;
  final List<MessageAction> actions;

  @override
  Widget build(BuildContext c) {
    final dark = Theme.of(c).brightness == Brightness.dark;
    final line = dark ? const Color(0xff333333) : const Color(0xffededed);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(c).bottom),
      child: Material(
        key: const Key('message-actions-sheet'),
        color: surface(c),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        clipBehavior: Clip.antiAlias,
        child: SafeArea(
          top: false,
          child: Semantics(
            container: true,
            label: tr(c, 'messageActions'),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(c).height * .8,
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 10, bottom: 8),
                      child: Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: dark
                              ? const Color(0x33ffffff)
                              : const Color(0x1f000000),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    if (preview.trim().isNotEmpty)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.fromLTRB(16, 4, 16, 10),
                        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                        decoration: BoxDecoration(
                          color: dark
                              ? const Color(0xff2a2a2a)
                              : const Color(0xfff5f6f7),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 3,
                              height: 32,
                              decoration: BoxDecoration(
                                color: QChatColors.green,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                preview,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 13,
                                  height: 1.35,
                                  color: dark
                                      ? const Color(0xffb4b4b4)
                                      : const Color(0xff6d6d6d),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    for (var i = 0; i < actions.length; i++) ...[
                      if (i > 0 &&
                          actions[i].destructive &&
                          !actions[i - 1].destructive)
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 6, 20, 6),
                          child: Container(height: .5, color: line),
                        ),
                      MessageActionRow(action: actions[i]),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MessageActionRow extends StatelessWidget {
  const MessageActionRow({super.key, required this.action});

  final MessageAction action;

  @override
  Widget build(BuildContext c) {
    final dark = Theme.of(c).brightness == Brightness.dark;
    final accent = action.destructive ? QChatColors.danger : QChatColors.green;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: InkWell(
        key: ValueKey('message-action-${action.id}'),
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          Navigator.of(c).pop();
          action.onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Center(
                  child: TIcon(action.icon, size: 20, color: accent),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  action.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: action.destructive
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
      ),
    );
  }
}
