import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// WeChat's "Cài đặt" page for one contact, opened from the three dots on the
/// profile.
///
/// Only "Chỉnh sửa Ghi chú" is wired up. Permissions, sharing, starred,
/// blocking, reporting and deleting the contact are drawn as wechat does but
/// left as TODO, so they do not touch the account yet.
class ContactSettingsScreen extends StatelessWidget {
  const ContactSettingsScreen({super.key, required this.userId});
  final String userId;

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
            onTap: () => c.push('/user/$userId/note'),
            chevron: true,
          ),
          // TODO(contact-settings): choose which details friends can see.
          _row(c, tr(c, 'contactPermissions'), chevron: true, divider: false),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          // TODO(contact-settings): share this contact's card in a chat.
          _row(c, tr(c, 'shareContactCard'), chevron: true, divider: false),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          // TODO(contact-settings): star a contact.
          _row(c, tr(c, 'starred'), trailing: const QChatSwitch(value: false)),
          // TODO(contact-settings): block a contact.
          _row(
            c,
            tr(c, 'block'),
            trailing: const QChatSwitch(value: false),
            divider: false,
          ),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          // TODO(contact-settings): report a contact.
          _row(c, tr(c, 'report'), chevron: true, divider: false),
        ]),
        const SizedBox(height: 9),
        _card(c, [
          // TODO(contact-settings): delete the contact and its conversation.
          _row(
            c,
            tr(c, 'deleteContact'),
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
    VoidCallback? onTap,
    Widget? trailing,
    bool chevron = false,
    bool danger = false,
    bool centered = false,
    bool divider = true,
  }) => QChatPressable(
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
