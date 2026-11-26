import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/localization/strings.dart';

/// WeChat's "Cài đặt" page for one contact, opened from the three dots on the
/// profile.
///
/// Every row talks to the account: the note editor opens the alias page, the
/// block switch reads and writes `GET/POST/DELETE /blocks`, and "Xóa số liên
/// lạc" removes the friendship after a confirmation.
class ContactSettingsScreen extends ConsumerStatefulWidget {
  const ContactSettingsScreen({super.key, required this.userId});
  final String userId;

  @override
  ConsumerState<ContactSettingsScreen> createState() =>
      _ContactSettingsScreenState();
}

class _ContactSettingsScreenState extends ConsumerState<ContactSettingsScreen> {
  bool blocked = false, busy = false;

  @override
  void initState() {
    super.initState();
    loadBlocks();
  }

  Future<void> loadBlocks() async {
    try {
      final rows =
          await ref.read(clientProvider).get('/blocks', cached: false) as List;
      final isBlocked = rows.cast<Map>().any(
        (row) => row['targetId'] == widget.userId,
      );
      if (mounted) setState(() => blocked = isBlocked);
    } catch (_) {
      // The switch stays off when the block list cannot be read.
    }
  }

  Future<void> setBlocked(bool value) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final client = ref.read(clientProvider);
      if (value) {
        await client.post('/blocks', {'targetId': widget.userId});
      } else {
        await client.dio.delete('/blocks/${widget.userId}');
      }
      client.changes.add(null);
      if (mounted) setState(() => blocked = value);
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'operationFailed'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> deleteContact() async {
    if (busy) return;
    final confirmed = await confirmAction(
      context,
      tr(context, 'deleteContact'),
      tr(context, 'deleteContactNote'),
    );
    if (!confirmed || !mounted) return;
    setState(() => busy = true);
    try {
      final client = ref.read(clientProvider);
      await client.dio.delete('/friends/${widget.userId}');
      await client.local?.removeCache('/friends');
      client.changes.add(null);
      if (!mounted) return;
      Navigator.of(context).maybePop();
    } catch (_) {
      if (!mounted) return;
      setState(() => busy = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'settings'),
    glassHeader: false,
    statusBackground: surface(c),
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => Navigator.maybePop(c),
    ),
    child: ListView(
      padding: const EdgeInsets.only(top: 9, bottom: 32),
      children: [
        _card(c, [
          _row(
            c,
            tr(c, 'editNote'),
            onTap: () => c.push('/user/${widget.userId}/note'),
            chevron: true,
            divider: false,
          ),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          _row(
            c,
            tr(c, 'block'),
            trailing: QChatSwitch(
              key: const ValueKey('contact-settings-block'),
              value: blocked,
              onChanged: busy ? null : setBlocked,
            ),
            divider: false,
          ),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          _row(
            c,
            tr(c, 'deleteContact'),
            key: const ValueKey('contact-settings-delete'),
            onTap: busy ? null : deleteContact,
            danger: true,
            centered: true,
            divider: false,
          ),
        ]),
      ],
    ),
  );

  Widget _card(BuildContext c, List<Widget> rows) => ColoredBox(
    color: surface(c),
    child: Column(children: rows),
  );

  Widget _row(
    BuildContext c,
    String label, {
    Key? key,
    VoidCallback? onTap,
    Widget? trailing,
    bool chevron = false,
    bool danger = false,
    bool centered = false,
    bool divider = true,
  }) => QChatPressable(
    key: key,
    onTap: onTap,
    child: Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: divider
          ? BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: ink(c).withValues(alpha: .07),
                  width: .5,
                ),
              ),
            )
          : null,
      child: centered
          ? Center(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 17,
                  color: danger ? QChatColors.danger : ink(c),
                ),
              ),
            )
          : Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: 17,
                      color: danger ? QChatColors.danger : ink(c),
                    ),
                  ),
                ),
                if (trailing != null)
                  trailing
                else if (chevron)
                  const QChatIcon(
                    'chevron',
                    size: 18,
                    color: QChatColors.muted,
                  ),
              ],
            ),
    ),
  );
}
