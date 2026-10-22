import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';

class SettingsExtras extends ConsumerStatefulWidget {
  const SettingsExtras({super.key, required this.kind});
  final String kind;
  @override
  ConsumerState<SettingsExtras> createState() => _SettingsExtrasState();
}

class _SettingsExtrasState extends ConsumerState<SettingsExtras> {
  final feedback = TextEditingController();
  String? status;
  bool sending = false;
  @override
  void dispose() {
    feedback.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (sending) return;
    setState(() {
      sending = true;
      status = null;
    });
    try {
      await ref.read(clientProvider).sendFeedback(feedback.text.trim());
      if (!mounted) return;
      feedback.clear();
      setState(() => status = tr(context, 'feedbackSent'));
    } catch (_) {
      if (mounted) setState(() => status = tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => sending = false);
    }
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
      glassHeader: false,
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
                  tr(c, 'sendFeedback'),
                  loading: sending,
                  onTap: feedback.text.trim().isEmpty ? null : submit,
                ),
                const SizedBox(height: 10),
                QChatButton(
                  tr(c, 'copyFeedback'),
                  secondary: true,
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
