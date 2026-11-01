import 'dart:math' as math;

import 'package:flutter/cupertino.dart';

import '../localization/strings.dart';
import 'overlays.dart';
import 'qchat_colors.dart';
import 'qchat_icons.dart';
import 'qchat_pressable.dart';
import 'qchat_theme.dart';
import 'share_sheet.dart';

/// What the user is about to send, drawn as the white card in
/// [QChatSendConfirmSheet].
///
/// A Mini App fills it with its own name, icon and cover; a forwarded message
/// fills it with the message text and the conversation it comes from.
class QChatSendPreview {
  const QChatSendPreview({
    required this.title,
    this.source,
    this.sourceIcon,
    this.image,
    this.footer,
    this.footerIcon = 'miniApps',
  });

  /// The headline inside the card: the message text or the app title.
  final String title;

  /// Small grey line above [title], usually where the content comes from.
  final String? source;

  /// Square glyph drawn before [source].
  final Widget? sourceIcon;

  /// Cover picture under the title.
  final Widget? image;

  /// Grey line under the picture, e.g. "Chương trình nhỏ".
  final String? footer;
  final String footerIcon;
}

/// How the user left the send sheet.
enum QChatSendOutcome {
  /// "Gửi Để Trò chuyện" was tapped; [QChatSendResult.message] may be empty.
  sent,

  /// "Hủy", the barrier or the back gesture.
  cancelled,

  /// The chevron beside the recipient: choose another conversation first.
  changeRecipient,
}

class QChatSendResult {
  const QChatSendResult(this.outcome, [this.message = '']);
  final QChatSendOutcome outcome;
  final String message;
}

/// The last step before something leaves the app: a recipient that can be
/// swapped, a preview of the content, a place to type a short note, and the
/// grey "Hủy" / green "Gửi Để Trò chuyện" pair.
///
/// It always opens from the bottom of the screen, over the sheet that asked for
/// a receiver, and it never sends anything itself: the caller gets
/// [QChatSendResult] and does the work.
class QChatSendConfirmSheet extends StatefulWidget {
  const QChatSendConfirmSheet({
    super.key,
    this.title,
    required this.recipient,
    this.extra = 0,
    required this.preview,
    this.hint,
    this.sendLabel,
    this.changeable = true,
  });

  final String? title;

  /// The conversation the content goes to.
  final QChatShareTarget recipient;

  /// Further conversations in a multi-select send, shown as "+N".
  final int extra;

  final QChatSendPreview preview;
  final String? hint;
  final String? sendLabel;

  /// Hides the chevron when the caller has nowhere else to send to.
  final bool changeable;

  @override
  State<QChatSendConfirmSheet> createState() => _QChatSendConfirmSheetState();
}

class _QChatSendConfirmSheetState extends State<QChatSendConfirmSheet> {
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _send() =>
      Navigator.pop(context, QChatSendResult(QChatSendOutcome.sent, _note.text));

  void _cancel() =>
      Navigator.pop(context, const QChatSendResult(QChatSendOutcome.cancelled));

  void _change() => Navigator.pop(
    context,
    const QChatSendResult(QChatSendOutcome.changeRecipient),
  );

  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    final backdrop = dark ? const Color(0xff1c1c1c) : const Color(0xfff2f2f2);
    final card = dark ? const Color(0xff2c2c2c) : QChatColors.white;
    final field = dark ? const Color(0xff2c2c2c) : QChatColors.white;
    final ink = qchatInk(c);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: backdrop,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.title ?? tr(c, 'sendTo'),
                  style: TextStyle(
                    fontSize: 22,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -.2,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 22),
                _RecipientRow(
                  recipient: widget.recipient,
                  extra: widget.extra,
                  onChange: widget.changeable ? _change : null,
                ),
                const SizedBox(height: 26),
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 260),
                    child: _PreviewCard(preview: widget.preview, card: card),
                  ),
                ),
                const SizedBox(height: 28),
                _Composer(
                  controller: _note,
                  hint: widget.hint ?? tr(c, 'sendMessageHint'),
                  background: field,
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _SheetButton(
                        label: tr(c, 'cancel'),
                        color: ink,
                        background: dark
                            ? const Color(0xff2f2f2f)
                            : const Color(0xffe3e3e3),
                        onTap: _cancel,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 3,
                      child: _SheetButton(
                        label: widget.sendLabel ?? tr(c, 'sendToChatConfirm'),
                        color: QChatColors.white,
                        background: QChatColors.green,
                        onTap: _send,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RecipientRow extends StatelessWidget {
  const _RecipientRow({
    required this.recipient,
    required this.extra,
    required this.onChange,
  });
  final QChatShareTarget recipient;
  final int extra;
  final VoidCallback? onChange;

  @override
  Widget build(BuildContext c) => QChatPressable(
    background: QChatColors.transparent,
    onTap: onChange,
    child: Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox.square(dimension: 56, child: recipient.avatar),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            recipient.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 20,
              height: 1.2,
              fontWeight: FontWeight.w600,
              color: qchatInk(c),
            ),
          ),
        ),
        if (extra > 0)
          Padding(
            padding: const EdgeInsets.only(left: 6),
            child: Text(
              '+$extra',
              style: TextStyle(fontSize: 16, color: qchatMuted(c)),
            ),
          ),
        if (onChange != null)
          const Padding(
            padding: EdgeInsets.only(left: 8),
            child: QChatIcon(
              'chevron',
              size: 22,
              color: Color(0xffb2b2b2),
            ),
          ),
      ],
    ),
  );
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.preview, required this.card});
  final QChatSendPreview preview;
  final Color card;

  @override
  Widget build(BuildContext c) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: card,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (preview.source != null)
          Row(
            children: [
              if (preview.sourceIcon != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: SizedBox.square(
                    dimension: 16,
                    child: preview.sourceIcon,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  preview.source!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, color: qchatMuted(c)),
                ),
              ),
            ],
          ),
        const SizedBox(height: 10),
        Text(
          preview.title,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 17,
            height: 1.3,
            color: qchatInk(c),
          ),
        ),
        if (preview.image != null) ...[
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: AspectRatio(aspectRatio: 1.1, child: preview.image!),
          ),
        ],
        if (preview.footer != null) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              QChatIcon(preview.footerIcon, size: 15, color: qchatMuted(c)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  preview.footer!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 14, color: qchatMuted(c)),
                ),
              ),
            ],
          ),
        ],
      ],
    ),
  );
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.hint,
    required this.background,
  });
  final TextEditingController controller;
  final String hint;
  final Color background;

  @override
  Widget build(BuildContext c) => Row(
    children: [
      Expanded(
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const SizedBox(width: 18),
              Expanded(
                child: CupertinoTextField(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  placeholder: hint,
                  placeholderStyle: TextStyle(
                    fontSize: 17,
                    color: qchatMuted(c),
                  ),
                  style: TextStyle(fontSize: 17, color: qchatInk(c)),
                  cursorColor: QChatColors.green,
                  decoration: null,
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 14),
                child: ExcludeSemantics(
                  child: QChatIcon('voice', size: 22, color: QChatColors.muted),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(width: 14),
      const ExcludeSemantics(
        child: QChatIcon('emoji', size: 30, color: QChatColors.ink),
      ),
    ],
  );
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    required this.label,
    required this.color,
    required this.background,
    required this.onTap,
  });
  final String label;
  final Color color, background;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext c) => QChatPressable(
    background: background,
    radius: BorderRadius.circular(12),
    onTap: onTap,
    child: SizedBox(
      height: 56,
      child: Center(
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 17,
            height: 1.2,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ),
    ),
  );
}

/// Opens [QChatSendConfirmSheet] from the bottom of the screen.
Future<QChatSendResult?> showQChatSendConfirmSheet(
  BuildContext context, {
  String? title,
  required QChatShareTarget recipient,
  int extra = 0,
  required QChatSendPreview preview,
  String? hint,
  String? sendLabel,
  bool changeable = true,
}) => showGeneralDialog<QChatSendResult>(
  context: context,
  barrierDismissible: true,
  barrierLabel: tr(context, 'cancel'),
  barrierColor: qchatOverlayBarrier,
  transitionDuration: qchatOverlayDuration,
  pageBuilder: (c, _, _) {
    final media = MediaQuery.of(c);
    final height = math.max(
      320.0,
      media.size.height - media.padding.top - media.viewInsets.bottom,
    );
    return Align(
      alignment: Alignment.bottomCenter,
      child: SizedBox(
        width: media.size.width,
        height: height,
        child: QChatSendConfirmSheet(
          title: title,
          recipient: recipient,
          extra: extra,
          preview: preview,
          hint: hint,
          sendLabel: sendLabel,
          changeable: changeable,
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
