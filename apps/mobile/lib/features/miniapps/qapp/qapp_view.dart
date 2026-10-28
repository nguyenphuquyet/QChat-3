import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../core/design_system/components.dart';
import '../../../core/localization/strings.dart';
import 'qapp_backend.dart';
import 'qapp_js_types.dart';
import 'qapp_renderer.dart';
import 'qapp_tree.dart';

/// Host side of the Mini App JavaScript sandbox.
///
/// The view owns the engine, applies every render frame to the Flutter widget
/// tree and forwards user input back to the JavaScript handlers by node id.
/// It never exposes the QChat network client: privileged calls go through
/// [onHostCall], which is implemented by `MiniAppBridge`.
class QappView extends StatefulWidget {
  const QappView({
    super.key,
    required this.directory,
    required this.onHostCall,
    this.controller,
    this.onFirstFrame,
    this.onError,
    this.onLog,
  });

  final String directory;
  final Future<QappHostResponse> Function(
    String method,
    Map<String, dynamic> params,
  )
  onHostCall;
  final QappViewController? controller;
  final VoidCallback? onFirstFrame;
  final void Function(String code, String message)? onError;
  final void Function(String level, String message, String? stack)? onLog;

  @override
  State<QappView> createState() => _QappViewState();
}

class QappViewController {
  _QappViewState? _state;

  void _attach(_QappViewState state) => _state = state;

  void _detach(_QappViewState state) {
    if (identical(_state, state)) _state = null;
  }

  void lifecycle(String event, [Object? payload]) {
    _state?._sendLifecycle(event, payload);
  }

  /// Handles a `navigateTo` request. Returns false when the app is not ready.
  bool navigate(String path) => _state?._navigate(path) ?? false;

  /// Pops one in-app route. Returns false when the host should close instead.
  bool back() => _state?._back() ?? false;
}

class _QappViewState extends State<QappView> with WidgetsBindingObserver {
  final QappBackend _backend = createQappBackend();
  final Map<String, Future<Uint8List?>> _assetCache = {};
  final List<String> _routes = [];

  QappJsRuntime? _runtime;
  QappTree? _tree;
  Map<String, dynamic>? _pendingRender;
  Timer? _scrollWatchdog;
  bool _dragging = false;
  bool _scrolling = false;
  DateTime? _pointerUpAt;
  String? _failureCode;
  String? _failureMessage;
  int _generation = 0;
  bool _firstFrameSent = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.controller?._attach(this);
    scheduleMicrotask(_start);
  }

  @override
  void didUpdateWidget(QappView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.controller, widget.controller)) {
      oldWidget.controller?._detach(this);
      widget.controller?._attach(this);
    }
    if (oldWidget.directory != widget.directory) {
      unawaited(_start());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final event = switch (state) {
      AppLifecycleState.resumed => 'resume',
      AppLifecycleState.paused => 'pause',
      AppLifecycleState.detached => 'destroy',
      _ => null,
    };
    if (event != null) _sendLifecycle(event, null);
  }

  @override
  void dispose() {
    widget.controller?._detach(this);
    WidgetsBinding.instance.removeObserver(this);
    _generation += 1;
    _scrollWatchdog?.cancel();
    _pendingRender = null;
    _runtime?.dispose();
    _runtime = null;
    _assetCache.clear();
    super.dispose();
  }

  Future<void> _start() async {
    final generation = ++_generation;
    _runtime?.dispose();
    _runtime = null;
    _firstFrameSent = false;
    _routes.clear();
    _pendingRender = null;
    _dragging = false;
    _scrolling = false;
    _pointerUpAt = null;
    _scrollWatchdog?.cancel();
    if (mounted) {
      setState(() {
        _tree = null;
        _failureCode = null;
        _failureMessage = null;
      });
    }
    try {
      final appJs = await _backend.readAppJs(widget.directory);
      if (!mounted || generation != _generation) return;
      final runtime = _backend.createRuntime();
      _runtime = runtime;
      await runtime.start(appJs: appJs, host: _QappJsHost(this, generation));
    } catch (error) {
      if (!mounted || generation != _generation) return;
      _fail(_codeOf(error), error.toString());
    }
  }

  void _receiveRender(Map<String, dynamic> payload, int generation) {
    if (!mounted || generation != _generation) return;
    final revision = _revisionOf(payload);
    final current = _tree;
    if (current != null && revision <= current.revision) return;
    final pending = _pendingRender;
    if (pending != null && revision <= _revisionOf(pending)) return;
    // Parsing the JSON frame and rebuilding the widget tree are the expensive
    // halves of a render. Both run at paint time, so a frame that arrives while
    // the content is moving cannot push a long task into the middle of the
    // animation: that is the single hitch that was still felt while scrolling.
    // Keep the newest frame and paint it once the list comes to rest; a frame a
    // tap produced is never held, so the tab bar always answers.
    if (_shouldHoldFrame()) {
      _pendingRender = payload;
      return;
    }
    _paint(payload);
  }

  int _revisionOf(Map<String, dynamic> payload) {
    final revision = payload['revision'];
    return revision is num ? revision.round() : 0;
  }

  /// Validates, parses and applies one render frame.
  void _paint(Map<String, dynamic> payload) {
    _pendingRender = null;
    QappTree tree;
    try {
      tree = QappTree.fromJson(payload);
    } catch (error) {
      _fail(
        error is QappTreeException ? error.code : 'TREE_INVALID',
        error is QappTreeException ? error.message : error.toString(),
      );
      return;
    }
    setState(() {
      _tree = tree;
      _failureCode = null;
      _failureMessage = null;
    });
    if (!_firstFrameSent) {
      _firstFrameSent = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onFirstFrame?.call();
      });
    }
  }

  /// Decides when a render frame may be painted while the content is moving.
  ///
  /// A frame that lands under an active drag changes the content extent while
  /// the list is past its edge, and Flutter's range-maintaining physics then
  /// pulls the content back into range: the list springs back while the finger
  /// is still down. A mini program may only settle back after the release, so
  /// such a frame is held until the list comes to rest.
  ///
  /// A fling is the same problem seen from the other side: rebuilding the tree
  /// in the middle of it drops a frame, which is the small stutter that is felt
  /// right after the finger leaves the screen. Those frames wait for the list to
  /// stop too — except the one a tap produces, which is always painted at once,
  /// otherwise the tab bar looks dead until the fling ends.
  bool _shouldHoldFrame() {
    if (_dragging) return true;
    if (!_scrolling) return false;
    final upAt = _pointerUpAt;
    return upAt == null ||
        DateTime.now().difference(upAt) > const Duration(milliseconds: 400);
  }

  bool _onScrollNotification(ScrollNotification notification) {
    if (notification is ScrollEndNotification) {
      // The list is at rest, so the held frame can be painted without a rebuild
      // landing in the middle of an animation, and the timer queue can run
      // again.
      _scrolling = false;
      _dragging = false;
      _scrollWatchdog?.cancel();
      _runtime?.resumeTicks();
      _flushPendingRender();
      return false;
    }
    if (!_scrolling) {
      _scrolling = true;
      // JavaScript runs on the UI thread, so a timer callback landing in the
      // middle of a fling renders a whole frame there: the content stops for a
      // beat and then jumps. Park the timer queue until the list is still.
      _runtime?.pauseTicks();
    }
    _armScrollWatchdog();
    final dragged = switch (notification) {
      ScrollStartNotification(:final dragDetails) => dragDetails != null,
      ScrollUpdateNotification(:final dragDetails) => dragDetails != null,
      OverscrollNotification(:final dragDetails) => dragDetails != null,
      _ => _dragging,
    };
    if (dragged) {
      _dragging = true;
    } else if (_dragging) {
      _dragging = false;
    }
    return false;
  }

  /// Safety net for a scroll that stops without reporting its end, for example
  /// when a new tree replaces the list while it is moving.
  void _armScrollWatchdog() {
    _scrollWatchdog?.cancel();
    _scrollWatchdog = Timer(
      const Duration(milliseconds: 1500),
      _scrollWatchdogFired,
    );
  }

  void _scrollWatchdogFired() {
    if (_dragging) {
      // The finger is parked past the edge and may stay there as long as the
      // user likes; the release always reports itself, so keep waiting.
      _armScrollWatchdog();
      return;
    }
    _scrolling = false;
    _runtime?.resumeTicks();
    _flushPendingRender();
  }

  /// A lifted finger is never still dragging, even when the scrollable never
  /// reported its end: a cancelled gesture, or a rebuild that replaced the
  /// list, would otherwise leave the frames held.
  void _releaseDrag() {
    _pointerUpAt = DateTime.now();
    if (!_dragging) return;
    _dragging = false;
    if (!_scrolling) _flushPendingRender();
  }

  void _flushPendingRender() {
    final pending = _pendingRender;
    if (pending == null || !mounted) return;
    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted && identical(_pendingRender, pending)) _paint(pending);
      });
      return;
    }
    _paint(pending);
  }

  void _fail(String code, String message) {
    if (!mounted) return;
    if (_failureCode == code && _failureMessage == message) return;
    setState(() {
      _failureCode = code;
      _failureMessage = message;
    });
    widget.onError?.call(code, message);
  }

  void _dispatch(String nodeId, String event, Object? payload) {
    _runtime?.dispatch(nodeId, event, payload);
  }

  /// Keeps the focused field above the keyboard.
  ///
  /// A mini app owns the whole screen and draws no `Scaffold`, so nothing else
  /// resizes its viewport when the keyboard opens: a `TextField` near the bottom
  /// stayed hidden under the keys. Shrinking the view is what makes Flutter
  /// scroll the focused field into view.
  Widget _keyboardAvoider(BuildContext context, Widget child) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    if (keyboard <= 0) return child;
    return Padding(padding: EdgeInsets.only(bottom: keyboard), child: child);
  }

  void _sendLifecycle(String event, Object? payload) {
    _runtime?.lifecycle(event, payload);
  }

  bool _navigate(String path) {
    final runtime = _runtime;
    if (runtime == null) return false;
    _routes.add(path);
    runtime.lifecycle('navigate', {'path': path, 'depth': _routes.length});
    return true;
  }

  bool _back() {
    final runtime = _runtime;
    if (runtime == null || _routes.isEmpty) return false;
    _routes.removeLast();
    runtime.lifecycle('back', {
      'path': _routes.isEmpty ? null : _routes.last,
      'depth': _routes.length,
    });
    return true;
  }

  Future<Uint8List?> _loadAsset(String path) {
    return _assetCache.putIfAbsent(
      path,
      () => _backend.readAsset(widget.directory, path),
    );
  }

  String _codeOf(Object error) {
    if (error is QappRuntimeException) return error.code;
    return 'RUNTIME_ERROR';
  }

  @override
  Widget build(BuildContext context) {
    final code = _failureCode;
    if (code != null && _tree == null) {
      return _errorView(context, code);
    }
    final tree = _tree;
    if (tree == null) {
      return ColoredBox(
        color: qchatBackground(context),
        child: const QChatLoading(size: 22),
      );
    }
    return ColoredBox(
      color: qchatBackground(context),
      child: SizedBox.expand(
        // Raw pointer events, not a gesture: a tap that a child wins still
        // tells the host that the finger is gone, so no frame stays held.
        child: Listener(
          behavior: HitTestBehavior.translucent,
          onPointerUp: (_) => _releaseDrag(),
          onPointerCancel: (_) => _releaseDrag(),
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScrollNotification,
            child: _keyboardAvoider(
              context,
              QappRenderer(
                root: tree.root,
                onEvent: _dispatch,
                loadAsset: _loadAsset,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _errorView(BuildContext context, String code) {
    final message = switch (code) {
      'RUNTIME_UNAVAILABLE' => tr(context, 'miniAppsUnavailable'),
      'RUNTIME_TOO_OLD' => tr(context, 'miniAppsUnavailable'),
      _ => tr(context, 'miniAppsError'),
    };
    return ColoredBox(
      color: qchatBackground(context),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const QChatIcon('miniApps', size: 44, color: QChatColors.muted),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (code != 'RUNTIME_UNAVAILABLE' && code != 'RUNTIME_TOO_OLD') ...[
                const SizedBox(height: 6),
                Text(
                  code,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 11,
                    color: QChatColors.muted,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              QChatButton(tr(context, 'miniAppsRetry'), onTap: _start),
            ],
          ),
        ),
      ),
    );
  }
}

class _QappJsHost implements QappJsHost {
  _QappJsHost(this.view, this.generation);

  final _QappViewState view;
  final int generation;

  @override
  void onRender(Map<String, dynamic> payload) =>
      view._receiveRender(payload, generation);

  @override
  void onReady(Map<String, dynamic>? payload) {
    // The first render frame drives the host reveal; `ready` only confirms the
    // SDK booted and is intentionally not used to hide the splash.
  }

  @override
  void onLog(String level, String message, String? stack) {
    view.widget.onLog?.call(level, message, stack);
    if (level == 'error' && view._tree == null) {
      view._fail('RUNTIME_ERROR', message);
    }
  }

  @override
  void onLifecycle(String event) {
    // Lifecycle events are delivered from Flutter to JavaScript; the app can
    // report its own internal lifecycle with the same channel.
    if (event == 'close') view.widget.onError?.call('APP_CLOSED', '');
  }

  @override
  Future<QappHostResponse> call(
    String method,
    Map<String, dynamic> params,
  ) async {
    if (generation != view._generation) {
      return const QappHostResponse.error(
        'RUNTIME_DISPOSED',
        'The Mini App was closed',
      );
    }
    try {
      return await view.widget.onHostCall(method, params);
    } catch (error) {
      return QappHostResponse.error('HOST_ERROR', error.toString());
    }
  }
}
