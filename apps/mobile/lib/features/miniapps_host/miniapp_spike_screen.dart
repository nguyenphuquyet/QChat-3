import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:qchat_miniapp_quickjs/qchat_miniapp_quickjs.dart';
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
  final List<String> _serviceLog = <String>[];
  MiniAppWebViewController? _controller;
  String _sessionId = '';
  String? _error;
  bool _installing = false;
  bool _serviceBusy = false;
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

  /// The device evidence path for host module 4: one runtime, four scripts,
  /// then close. Nothing here runs in CI; the native library only exists on a
  /// phone or emulator.
  Future<void> _runServiceCheck() async {
    if (_serviceBusy) return;
    setState(() {
      _serviceBusy = true;
      _serviceLog.clear();
    });
    QjsRuntime? runtime;
    try {
      runtime = await QjsRuntime.create();
      final lines = <String>[];
      lines.add(_describe('1 + 1', await runtime.eval('1 + 1')));
      lines.add(
        _describe(
          'unicode',
          await runtime.eval('"QChat ✅ Đặt lại"'),
        ),
      );
      lines.add(
        _describe(
          'throw',
          await runtime.eval('(() => { throw new Error("boom"); })()'),
        ),
      );
      lines.add(
        _describe(
          'timeout',
          await runtime.eval(
            'while (true) {}',
            timeout: const Duration(milliseconds: 300),
          ),
        ),
      );
      if (mounted) setState(() => _serviceLog.addAll(lines));
    } on Object catch (error) {
      if (mounted) setState(() => _serviceLog.add('failed: $error'));
    } finally {
      await runtime?.close();
      if (mounted) setState(() => _serviceBusy = false);
    }
  }

  String _describe(String label, QjsEvalResult result) => result.ok
      ? '$label -> ${jsonEncode(result.value)}'
      : '$label -> ${result.error}';

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
          const SizedBox(height: 26),
          Text(
            tr(context, 'miniappHostService'),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: qchatInk(context),
            ),
          ),
          const SizedBox(height: 8),
          Text(tr(context, 'miniappHostServiceNote'), style: muted),
          const SizedBox(height: 12),
          QChatButton(
            _serviceBusy
                ? tr(context, 'miniappHostServiceRunning')
                : tr(context, 'miniappHostServiceRun'),
            loading: _serviceBusy,
            secondary: true,
            onTap: _serviceBusy ? null : () => unawaited(_runServiceCheck()),
          ),
          const SizedBox(height: 10),
          if (_serviceLog.isEmpty)
            Text(tr(context, 'miniappHostServiceNoResult'), style: muted)
          else
            for (final line in _serviceLog)
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
