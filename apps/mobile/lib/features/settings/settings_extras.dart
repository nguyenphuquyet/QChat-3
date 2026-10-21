import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';

class SettingsExtras extends StatefulWidget {
  const SettingsExtras({super.key, required this.kind});
  final String kind;
  @override
  State<SettingsExtras> createState() => _SettingsExtrasState();
}

class _SettingsExtrasState extends State<SettingsExtras> {
  final feedback = TextEditingController();
  String? status;
  @override
  void dispose() {
    feedback.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    final links = switch (widget.kind) {
      'more' => [
        ('display', '/settings/display'),
        ('notifications', '/settings/notifications'),
        ('permissions', '/settings/permissions'),
        ('sessions', '/sessions'),
      ],
      'otherFeatures' => [
        ('moments', '/moments'),
        ('favorites', '/favorites'),
        ('search', '/search'),
      ],
      _ => [('scan', '/scan'), ('qr', '/qr'), ('favorites', '/favorites')],
    };
    return QChatPage(
      title: tr(c, widget.kind),
      leading: QChatIconButton(
        'back',
        label: tr(c, 'back'),
        onTap: () => c.pop(),
      ),
      child: widget.kind == 'feedback'
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(tr(c, 'feedbackNote')),
                const SizedBox(height: 16),
                TInput(
                  controller: feedback,
                  hintText: tr(c, 'feedbackHint'),
                  minLines: 5,
                  maxLines: 10,
                  maxLength: 2000,
                  onChanged: (_) => setState(() => status = null),
                ),
                const SizedBox(height: 16),
                QChatButton(
                  tr(c, 'copyFeedback'),
                  onTap: feedback.text.trim().isEmpty
                      ? null
                      : () async {
                          try {
                            await Clipboard.setData(
                              ClipboardData(text: feedback.text.trim()),
                            );
                            if (mounted) {
                              setState(() => status = tr(c, 'copied'));
                            }
                          } catch (_) {
                            if (mounted) {
                              setState(() => status = tr(c, 'operationFailed'));
                            }
                          }
                        },
                ),
                if (status != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(status!),
                  ),
              ],
            )
          : ListView(
              children: [
                sectionGap,
                for (final link in links)
                  MenuRow(
                    link.$1,
                    trailing: const QChatIcon(
                      'chevron',
                      size: 18,
                      color: QChatColors.muted,
                    ),
                    onTap: () => c.push(link.$2),
                  ),
              ],
            ),
    );
  }
}
