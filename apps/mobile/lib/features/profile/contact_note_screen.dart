import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

const _noteBlue = Color(0xff576b95);

/// WeChat's "Chỉnh sửa Ghi chú" page for one contact.
///
/// Only the alias (the friendship remark) is wired up: it loads from
/// `GET /friends`, saves through `PATCH /friends/:id` and makes [doneEnabled]
/// true as soon as it differs from the saved value. The phone number, labels,
/// description and picture are drawn as they appear in WeChat but are TODO
/// placeholders, so they neither edit nor save anything.
class ContactNoteScreen extends ConsumerStatefulWidget {
  const ContactNoteScreen({super.key, required this.userId});
  final String userId;
  @override
  ConsumerState<ContactNoteScreen> createState() => _ContactNoteScreenState();
}

class _ContactNoteScreenState extends ConsumerState<ContactNoteScreen> {
  final alias = TextEditingController();
  Map? user;
  String saved = '';
  bool loading = true, saving = false;

  bool get dirty => alias.text.trim() != saved;

  @override
  void initState() {
    super.initState();
    alias.addListener(_edited);
    load();
  }

  @override
  void dispose() {
    alias.removeListener(_edited);
    alias.dispose();
    super.dispose();
  }

  void _edited() {
    if (mounted) setState(() {});
  }

  Future<void> load() async {
    try {
      final client = ref.read(clientProvider);
      final found = await client.get('/users/${widget.userId}', cached: false);
      final friends = await client.get('/friends', cached: false) as List;
      final match = friends
          .cast<Map>()
          .where((f) => f['friendId'] == widget.userId)
          .firstOrNull;
      final remark = (match?['remark'] ?? '').toString();
      if (!mounted) return;
      saved = remark;
      alias.text = remark;
      setState(() {
        user = found is Map ? found : null;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> save() async {
    if (saving || !dirty) return;
    setState(() => saving = true);
    try {
      final client = ref.read(clientProvider);
      await client.patch('/friends/${widget.userId}', {
        'remark': alias.text.trim(),
      });
      await client.local?.removeCache('/friends');
      client.changes.add(null);
      if (mounted) Navigator.of(context).maybePop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() => saving = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  @override
  Widget build(BuildContext c) {
    final nickname = (user?['nickname'] ?? '').toString();
    return QChatPage(
      title: '',
      glassHeader: false,
      background: surface(c),
      statusBackground: surface(c),
      trailingWidth: 78,
      leading: Align(
        alignment: Alignment.centerLeft,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.maybePop(c),
          child: Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Text(
              tr(c, 'cancel'),
              style: TextStyle(fontSize: 17, color: ink(c)),
            ),
          ),
        ),
      ),
      trailing: Align(
        alignment: Alignment.centerRight,
        child: GestureDetector(
          key: const ValueKey('contact-note-done'),
          behavior: HitTestBehavior.opaque,
          onTap: dirty && !saving ? save : null,
          child: Container(
            margin: const EdgeInsets.only(right: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: dirty && !saving ? QChatColors.green : qchatFill(c),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              tr(c, 'done'),
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: dirty && !saving ? QChatColors.white : QChatColors.muted,
              ),
            ),
          ),
        ),
      ),
      child: loading
          ? const Center(child: QChatLoading())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 44),
              children: [
                Center(
                  child: Text(
                    tr(c, 'editNote'),
                    style: TextStyle(
                      fontSize: 24,
                      height: 1.3,
                      fontWeight: FontWeight.w600,
                      color: ink(c),
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                _label(c, tr(c, 'alias')),
                const SizedBox(height: 8),
                _field(
                  c,
                  key: const ValueKey('contact-note-field'),
                  controller: alias,
                  hint: tr(c, 'addNote'),
                ),
                if (nickname.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  GestureDetector(
                    key: const ValueKey('contact-note-nickname'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => alias.text = nickname,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            nickname,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              color: _noteBlue,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const QChatIcon(
                            'chevronDown',
                            size: 16,
                            color: _noteBlue,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 26),
                _label(c, tr(c, 'mobilePhone')),
                const SizedBox(height: 8),
                // TODO(contact-note): let the phone number be added and saved.
                _todoField(
                  c,
                  Row(
                    children: [
                      const QChatIcon('plusCircle', size: 23, color: _noteBlue),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          tr(c, 'addMobilePhone'),
                          style: const TextStyle(
                            fontSize: 17,
                            color: _noteBlue,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                _label(c, tr(c, 'tags')),
                const SizedBox(height: 8),
                // TODO(contact-note): pick and save labels.
                _todoField(
                  c,
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          tr(c, 'addLabel'),
                          style: const TextStyle(
                            fontSize: 17,
                            color: _noteBlue,
                          ),
                        ),
                      ),
                      const QChatIcon(
                        'chevron',
                        size: 18,
                        color: QChatColors.muted,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                _label(c, tr(c, 'description')),
                const SizedBox(height: 8),
                // TODO(contact-note): describe the contact in free text.
                _todoField(
                  c,
                  Align(
                    alignment: Alignment.topLeft,
                    child: Text(
                      tr(c, 'enterText'),
                      style: TextStyle(
                        fontSize: 17,
                        color: qchatDark(c)
                            ? QChatColors.darkMuted
                            : const Color(0xffb2b2b2),
                      ),
                    ),
                  ),
                  height: 96,
                ),
                const SizedBox(height: 24),
                _label(c, tr(c, 'imageDescription')),
                const SizedBox(height: 8),
                // TODO(contact-note): attach a picture that describes them.
                Container(
                  width: 104,
                  height: 104,
                  decoration: BoxDecoration(
                    color: qchatFill(c),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const QChatIcon('plusCircle', size: 26, color: _noteBlue),
                      const SizedBox(height: 6),
                      Text(
                        tr(c, 'addImage'),
                        style: const TextStyle(fontSize: 15, color: _noteBlue),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _label(BuildContext c, String text) => Padding(
    padding: const EdgeInsets.only(left: 4),
    child: Text(
      text,
      style: const TextStyle(fontSize: 15, color: QChatColors.muted),
    ),
  );

  Widget _field(
    BuildContext c, {
    required Key key,
    required TextEditingController controller,
    required String hint,
  }) => Container(
    key: key,
    height: 56,
    alignment: Alignment.centerLeft,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    decoration: BoxDecoration(
      color: qchatFill(c),
      borderRadius: BorderRadius.circular(10),
    ),
    child: CupertinoTextField(
      controller: controller,
      placeholder: hint,
      placeholderStyle: TextStyle(
        fontSize: 17,
        color: qchatDark(c) ? QChatColors.darkMuted : const Color(0xffb2b2b2),
      ),
      style: TextStyle(fontSize: 17, color: ink(c)),
      cursorColor: QChatColors.green,
      decoration: null,
      padding: EdgeInsets.zero,
    ),
  );

  Widget _todoField(BuildContext c, Widget child, {double height = 56}) =>
      Container(
        height: height,
        alignment: height <= 56 ? Alignment.centerLeft : Alignment.topLeft,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: qchatFill(c),
          borderRadius: BorderRadius.circular(10),
        ),
        child: child,
      );
}
