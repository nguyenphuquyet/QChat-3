import 'package:flutter/cupertino.dart';

import '../localization/strings.dart';
import 'overlays.dart';
import 'qchat_colors.dart';
import 'qchat_icons.dart';
import 'qchat_pressable.dart';
import 'qchat_theme.dart';
import 'share_sheet.dart';

/// One conversation in the full forward picker.
class QChatForwardEntry {
  const QChatForwardEntry({
    required this.id,
    required this.name,
    required this.avatar,
    this.note,
    this.disabled = false,
  });

  final String id;
  final String name;
  final Widget avatar;

  /// Muted text on the right, e.g. "Trò chuyện hiện tại".
  final String? note;

  /// The conversation the user is already in cannot receive the forward.
  final bool disabled;
}

/// "Chọn cuộc trò chuyện": the full receiver picker behind forwarding.
///
/// It opens from the bottom over the conversation, keeps the recent-recipient
/// strip on a grey backdrop, and lists every chat in a white panel underneath.
/// Tapping a chat closes the picker with its id; [QChatForwardPicker.multiple]
/// turns the same rows into a multi-select list that returns every choice.
class QChatForwardPicker extends StatefulWidget {
  const QChatForwardPicker({
    super.key,
    this.title,
    this.recent = const [],
    required this.entries,
    this.multiple = true,
  });

  final String? title;
  final List<QChatShareTarget> recent;
  final List<QChatForwardEntry> entries;
  final bool multiple;

  @override
  State<QChatForwardPicker> createState() => _QChatForwardPickerState();
}

class _QChatForwardPickerState extends State<QChatForwardPicker> {
  final _search = TextEditingController();
  final _focus = FocusNode();
  final _selected = <String>{};
  bool _multi = false;

  @override
  void dispose() {
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  List<QChatForwardEntry> get _visible {
    final query = _search.text.trim().toLowerCase();
    if (query.isEmpty) return widget.entries;
    return [
      for (final entry in widget.entries)
        if (entry.name.toLowerCase().contains(query)) entry,
    ];
  }

  void _tap(QChatForwardEntry entry) {
    if (entry.disabled) return;
    if (!_multi) {
      Navigator.pop(context, [entry.id]);
      return;
    }
    setState(() {
      if (!_selected.remove(entry.id)) _selected.add(entry.id);
    });
  }

  void _done() {
    if (_selected.isEmpty) {
      Navigator.pop(context);
      return;
    }
    Navigator.pop(context, _selected.toList());
  }

  void _newChat() => Navigator.pop(context, const <String>[]);

  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    final backdrop = dark ? const Color(0xff111111) : const Color(0xfff2f2f2);
    final link = dark ? const Color(0xff9db0e0) : const Color(0xff5b6b9c);
    final media = MediaQuery.of(c);
    final visible = _visible;
    final hasRecent = widget.recent.isNotEmpty;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: backdrop,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: media.padding.top),
            SizedBox(
              height: 52,
              child: Row(
                children: [
                  QChatPressable(
                    background: QChatColors.transparent,
                    onTap: () => Navigator.maybePop(c),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        tr(c, 'close'),
                        style: TextStyle(
                          fontSize: 17,
                          color: qchatInk(c),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      widget.title ?? tr(c, 'pickChatTitle'),
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: qchatInk(c),
                      ),
                    ),
                  ),
                  if (widget.multiple)
                    QChatPressable(
                      background: QChatColors.transparent,
                      onTap: _multi ? _done : () => setState(() => _multi = true),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          tr(c, _multi ? 'done' : 'multiContacts'),
                          style: TextStyle(
                            fontSize: 15,
                            color: _multi ? QChatColors.green : link,
                          ),
                        ),
                      ),
                    )
                  else
                    const SizedBox(width: 16),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: _SearchField(
                controller: _search,
                focus: _focus,
                onChanged: (_) => setState(() {}),
              ),
            ),
            if (hasRecent) ...[
              const SizedBox(height: 18),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    tr(c, 'recentForwards'),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: qchatInk(c),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              QChatRecentTargets(
                targets: widget.recent,
                tileSize: 56,
                onSelect: (target) => Navigator.pop(c, [target.id]),
                onAdd: _focus.requestFocus,
              ),
            ],
            const SizedBox(height: 18),
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: qchatSurface(c),
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(16),
                  ),
                ),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 8, 2),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              tr(c, 'latestChats'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: qchatInk(c),
                              ),
                            ),
                          ),
                          QChatPressable(
                            background: QChatColors.transparent,
                            onTap: _newChat,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 8,
                              ),
                              child: Text(
                                tr(c, 'newConversation'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 15, color: link),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: visible.isEmpty
                          ? Center(
                              child: Text(
                                tr(c, 'emptyChats'),
                                style: TextStyle(
                                  fontSize: 15,
                                  color: qchatMuted(c),
                                ),
                              ),
                            )
                          : ListView.builder(
                              padding: EdgeInsets.only(
                                bottom: media.padding.bottom + 8,
                              ),
                              itemCount: visible.length,
                              itemBuilder: (c, i) => _row(c, visible[i]),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext c, QChatForwardEntry entry) {
    final selected = _selected.contains(entry.id);
    final ink = entry.disabled ? qchatMuted(c) : qchatInk(c);
    return Column(
      children: [
        QChatPressable(
          background: qchatSurface(c),
          onTap: entry.disabled ? null : () => _tap(entry),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox.square(dimension: 48, child: entry.avatar),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    entry.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 17, color: ink),
                  ),
                ),
                if (entry.note != null)
                  Text(
                    entry.note!,
                    style: TextStyle(fontSize: 14, color: qchatMuted(c)),
                  ),
                if (_multi) ...[
                  const SizedBox(width: 10),
                  _Checkbox(selected: selected, muted: entry.disabled),
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(left: 76),
          child: Container(height: .5, color: qchatLine(c)),
        ),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.focus,
    required this.onChanged,
  });
  final TextEditingController controller;
  final FocusNode focus;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext c) => Container(
    height: 40,
    decoration: BoxDecoration(
      color: qchatSurface(c),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      children: [
        const SizedBox(width: 12),
        const QChatIcon('search', size: 18, color: QChatColors.muted),
        const SizedBox(width: 8),
        Expanded(
          child: CupertinoTextField(
            controller: controller,
            focusNode: focus,
            onChanged: onChanged,
            padding: const EdgeInsets.symmetric(vertical: 10),
            placeholder: tr(c, 'search'),
            placeholderStyle: const TextStyle(
              fontSize: 15,
              color: QChatColors.muted,
            ),
            style: TextStyle(fontSize: 15, color: qchatInk(c)),
            cursorColor: QChatColors.green,
            decoration: null,
          ),
        ),
        if (controller.text.isNotEmpty)
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: controller.clear,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 10),
              child: QChatIcon('close', size: 16, color: QChatColors.muted),
            ),
          )
        else
          const SizedBox(width: 12),
      ],
    ),
  );
}

class _Checkbox extends StatelessWidget {
  const _Checkbox({required this.selected, required this.muted});
  final bool selected;
  final bool muted;
  @override
  Widget build(BuildContext c) => Container(
    width: 22,
    height: 22,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: selected
          ? (muted ? qchatMuted(c) : QChatColors.green)
          : QChatColors.transparent,
      border: selected ? null : Border.all(color: qchatLine(c), width: 1.5),
    ),
    child: selected
        ? const QChatIcon('check', size: 14, color: QChatColors.white)
        : null,
  );
}

/// Opens [QChatForwardPicker] from the bottom of the screen and returns the
/// chosen conversation ids. `null` means the user backed out, and an empty list
/// means they asked to start a new conversation instead.
Future<List<String>?> showQChatForwardPicker(
  BuildContext context, {
  String? title,
  List<QChatShareTarget> recent = const [],
  required List<QChatForwardEntry> entries,
  bool multiple = true,
}) => showGeneralDialog<List<String>>(
  context: context,
  barrierDismissible: true,
  barrierLabel: tr(context, 'close'),
  barrierColor: qchatOverlayBarrier,
  transitionDuration: qchatOverlayDuration,
  pageBuilder: (c, _, _) {
    final media = MediaQuery.of(c);
    return Align(
      alignment: Alignment.bottomCenter,
      child: SizedBox(
        width: media.size.width,
        height: media.size.height - media.viewInsets.bottom,
        child: QChatForwardPicker(
          title: title,
          recent: recent,
          entries: entries,
          multiple: multiple,
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
