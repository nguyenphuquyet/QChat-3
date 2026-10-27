import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../localization/strings.dart';
import 'components.dart';

const qchatDialogRadius = 14.0;
const qchatDialogBarrier = Color(0x80000000);
const qchatDialogDuration = Duration(milliseconds: 180);

Color _dialogLine(BuildContext c) =>
    qchatDark(c) ? const Color(0xff333333) : const Color(0xffe5e5e5);

Color _dialogBody(BuildContext c) =>
    qchatDark(c) ? const Color(0xffb4b4b4) : const Color(0xff4c4c4c);

/// One row of the footer of a [QChatDialog].
///
/// Actions are laid out side by side (up to two) or stacked, separated by
/// hairlines, mirroring the system alert look.
class QChatDialogAction {
  const QChatDialogAction({
    required this.label,
    this.result,
    this.onPressed,
    this.primary = false,
    this.destructive = false,
    this.closeOnPressed = true,
  });

  final String label;
  final Object? result;
  final VoidCallback? onPressed;
  final bool primary;
  final bool destructive;
  final bool closeOnPressed;
}

Future<T?> showQChatDialog<T>(
  BuildContext context, {
  String? title,
  String? message,
  Widget? content,
  List<QChatDialogAction> actions = const [],
  bool barrierDismissible = true,
  double maxHeightFactor = .8,
}) => showGeneralDialog<T>(
  context: context,
  barrierDismissible: barrierDismissible,
  barrierLabel: tr(context, 'cancel'),
  barrierColor: qchatDialogBarrier,
  transitionDuration: qchatDialogDuration,
  pageBuilder: (c, _, _) => QChatDialog(
    title: title,
    message: message,
    content: content,
    actions: actions,
    maxHeightFactor: maxHeightFactor,
  ),
  transitionBuilder: (c, animation, _, child) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: ScaleTransition(
        scale: Tween<double>(begin: .94, end: 1).animate(curved),
        child: child,
      ),
    );
  },
);

/// Centered alert card: rounded surface, centered title, optional message or
/// custom content, and a divided action footer.
class QChatDialog extends StatelessWidget {
  const QChatDialog({
    super.key,
    this.title,
    this.message,
    this.content,
    this.actions = const [],
    this.maxHeightFactor = .8,
  }) : assert(
         title != null || message != null || content != null,
         'A dialog needs a title, a message or content.',
       );

  final String? title;
  final String? message;
  final Widget? content;
  final List<QChatDialogAction> actions;
  final double maxHeightFactor;

  @override
  Widget build(BuildContext c) {
    final viewInsets = MediaQuery.viewInsetsOf(c);
    final width = math.min(MediaQuery.sizeOf(c).width - 48, 340.0);
    final maxHeight = math.max(
      160.0,
      MediaQuery.sizeOf(c).height * maxHeightFactor - viewInsets.bottom,
    );
    final hasHeader = title != null || message != null;
    return Center(
      child: Padding(
        padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + viewInsets.bottom),
        child: SizedBox(
          width: width,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(qchatDialogRadius),
            child: ColoredBox(
              color: surface(c),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxHeight),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (hasHeader)
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          24,
                          30,
                          24,
                          content == null ? 30 : 4,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (title != null)
                              Text(
                                title!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 19,
                                  height: 1.35,
                                  fontWeight: FontWeight.w600,
                                  color: ink(c),
                                ),
                              ),
                            if (message != null)
                              Padding(
                                padding: EdgeInsets.only(
                                  top: title == null ? 0 : 10,
                                ),
                                child: Text(
                                  message!,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 15.5,
                                    height: 1.45,
                                    color: _dialogBody(c),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    if (content != null) Flexible(child: content!),
                    if (actions.isNotEmpty) _DialogFooter(actions: actions),
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

class _DialogFooter extends StatelessWidget {
  const _DialogFooter({required this.actions});

  final List<QChatDialogAction> actions;

  @override
  Widget build(BuildContext c) {
    final line = _dialogLine(c);
    final divider = BorderSide(color: line, width: .5);
    if (actions.length > 2) {
      return DecoratedBox(
        decoration: BoxDecoration(border: Border(top: divider)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < actions.length; i++) ...[
              if (i > 0)
                Container(height: .5, color: line),
              SizedBox(height: 54, child: _DialogActionButton(actions[i])),
            ],
          ],
        ),
      );
    }
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: divider)),
      child: SizedBox(
        height: 56,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < actions.length; i++) ...[
              if (i > 0) Container(width: .5, color: line),
              Expanded(child: _DialogActionButton(actions[i])),
            ],
          ],
        ),
      ),
    );
  }
}

class _DialogActionButton extends StatelessWidget {
  const _DialogActionButton(this.action);

  final QChatDialogAction action;

  @override
  Widget build(BuildContext c) {
    final color = action.destructive
        ? QChatColors.danger
        : action.primary
        ? QChatColors.primary
        : ink(c);
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          action.onPressed?.call();
          if (action.closeOnPressed) Navigator.pop(c, action.result);
        },
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              action.label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 17,
                height: 1.2,
                fontWeight: FontWeight.w500,
                color: color,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Future<String?> editText(
  BuildContext context,
  String title, {
  String initial = '',
  int maxLength = 300,
  bool secret = false,
  int lines = 1,
}) => showGeneralDialog<String>(
  context: context,
  barrierDismissible: true,
  barrierLabel: tr(context, 'cancel'),
  barrierColor: qchatDialogBarrier,
  transitionDuration: qchatDialogDuration,
  pageBuilder: (c, _, _) => _TextDialog(
    title: title,
    initial: initial,
    maxLength: maxLength,
    secret: secret,
    lines: lines,
  ),
  transitionBuilder: (c, animation, _, child) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return FadeTransition(
      opacity: curved,
      child: ScaleTransition(
        scale: Tween<double>(begin: .94, end: 1).animate(curved),
        child: child,
      ),
    );
  },
);

Future<bool> confirmAction(
  BuildContext context,
  String title,
  String message,
) async =>
    await showQChatDialog<bool>(
      context,
      title: title,
      message: message,
      actions: [
        QChatDialogAction(label: tr(context, 'cancel'), result: false),
        QChatDialogAction(
          label: tr(context, 'confirm'),
          primary: true,
          result: true,
        ),
      ],
    ) ??
    false;

class _TextDialog extends StatefulWidget {
  const _TextDialog({
    required this.title,
    required this.initial,
    required this.maxLength,
    required this.secret,
    required this.lines,
  });
  final String title, initial;
  final int maxLength, lines;
  final bool secret;
  @override
  State<_TextDialog> createState() => _TextDialogState();
}

class _TextDialogState extends State<_TextDialog> {
  late final controller = TextEditingController(text: widget.initial);
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    return QChatDialog(
      title: widget.title,
      content: UnconstrainedBox(
        constrainedAxis: Axis.horizontal,
        alignment: Alignment.topCenter,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: QChatTextInput(
            controller: controller,
            hint: '',
            autofocus: true,
            secret: widget.secret,
            maxLength: widget.maxLength,
            maxLines: widget.lines,
          ),
        ),
      ),
      actions: [
        QChatDialogAction(label: tr(c, 'cancel')),
        QChatDialogAction(
          label: tr(c, 'save'),
          primary: true,
          closeOnPressed: false,
          onPressed: () => Navigator.pop(
            c,
            widget.secret ? controller.text : controller.text.trim(),
          ),
        ),
      ],
    );
  }
}
