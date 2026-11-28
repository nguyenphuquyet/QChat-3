import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:qchat_miniapp_webview/qchat_miniapp_webview.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'miniapp_host_screen.dart';
import 'miniapp_spike_package.dart';

/// The Android host spike (M1).
///
/// It installs one unsigned page into the app's installed layout, opens it in
/// the system WebView, sends a `view.render` tree and shows every bridge event
/// that comes back. There is no QuickJS engine and no signed package yet, so the
/// page is a fixed tree built here, not a compiled Mini App.
///
/// Debug builds on Android only: the entry point is hidden in release builds,
/// because it is a diagnostic, not a product surface.
class MiniAppSpikeScreen extends StatefulWidget {
  const MiniAppSpikeScreen({super.key});

  @override
  State<MiniAppSpikeScreen> createState() => _MiniAppSpikeScreenState();
}

class _MiniAppSpikeScreenState extends State<MiniAppSpikeScreen> {
  final List<String> _log = <String>[];
  MiniAppWebViewController? _controller;
  String _sessionId = '';
  String? _error;
  bool _installing = false;
  int _taps = 0;
  int _seq = 0;

  @override
  void dispose() {
    _controller = null;
    super.dispose();
  }

  void _logLine(String line) {
    if (!mounted) return;
    setState(() {
      _log.insert(0, line);
      if (_log.length > 8) _log.removeLast();
    });
  }

  Future<void> _open() async {
    setState(() {
      _installing = true;
      _error = null;
      _taps = 0;
      _seq = 0;
    });
    try {
      await installMiniAppSpike();
      if (!mounted) return;
      final sessionId = 'spike_${DateTime.now().microsecondsSinceEpoch}';
      _sessionId = sessionId;
      final title = tr(context, 'miniappHostSpike');
      await Navigator.of(context).push<void>(
        CupertinoPageRoute<void>(
          builder: (_) => MiniAppHostScreen(
            appId: miniAppSpikeAppId,
            version: miniAppSpikeVersion,
            route: miniAppSpikeRoute,
            sessionId: sessionId,
            pageId: 'p1',
            title: title,
            onReady: (controller) async {
              _controller = controller;
              _logLine('view.ready');
              await _render();
            },
            onEvent: (event, payload) {
              final handler = payload['handler'];
              _logLine(
                handler is String ? '$event $handler' : event,
              );
              if (event == 'view.event') {
                _taps += 1;
                unawaited(_render());
              }
            },
          ),
        ),
      );
      _controller = null;
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    } finally {
      if (mounted) setState(() => _installing = false);
    }
  }

  Future<void> _render() async {
    final controller = _controller;
    if (controller == null) return;
    _seq += 1;
    final message = miniAppSpikeRender(
      appId: miniAppSpikeAppId,
      sessionId: _sessionId,
      pageId: 'p1',
      theme: qchatDark(context) ? 'dark' : 'light',
      seq: _seq,
      taps: _taps,
    );
    try {
      await controller.send(message);
      _logLine('sent view.render seq=$_seq taps=$_taps');
    } catch (error) {
      _logLine('send failed: $error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = TextStyle(fontSize: 14, height: 1.45, color: qchatMuted(context));
    return QChatPage(
      title: tr(context, 'miniappHostSpike'),
      leading: QChatIconButton(
        'back',
        label: tr(context, 'back'),
        onTap: () => Navigator.of(context).maybePop(),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text(tr(context, 'miniappHostSpikeNote'), style: muted),
          const SizedBox(height: 18),
          QChatButton(
            _installing
                ? tr(context, 'miniappHostInstalling')
                : tr(context, 'miniappHostOpen'),
            loading: _installing,
            onTap: _installing ? null : () => unawaited(_open()),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: TextStyle(fontSize: 13, color: QChatColors.danger),
            ),
          ],
          const SizedBox(height: 26),
          Text(
            tr(context, 'miniappHostEvents'),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: qchatInk(context),
            ),
          ),
          const SizedBox(height: 8),
          if (_log.isEmpty)
            Text(tr(context, 'miniappHostNoEvents'), style: muted)
          else
            for (final line in _log)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  line,
                  style: TextStyle(
                    fontSize: 13,
                    fontFamily: 'monospace',
                    color: qchatMuted(context),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
