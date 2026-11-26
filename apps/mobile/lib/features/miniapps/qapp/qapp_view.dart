import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../core/design_system/components.dart';
import '../../../core/localization/strings.dart';
import 'qapp_backend.dart';
import 'qapp_js_types.dart';
import 'qapp_renderer.dart';
import 'qapp_screen_transition.dart';
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

/// Shrinks a mini program by the height of the keyboard.
///
/// A mini app owns the whole screen and draws no `Scaffold`, so nothing else
/// resizes its viewport when a field takes focus: a `TextField` near the bottom
/// stayed hidden under the keys. Resizing the view is what makes Flutter scroll
/// the focused field into view.
///
/// The `Padding` is always there, even at zero inset. Returning the bare child
/// instead swapped a `Padding` for a `QappRenderer` in the same slot, which
/// remounted the whole mini program: every `TextField` lost its `FocusNode` the
/// moment the keyboard appeared, the keyboard closed again, and the user needed
/// several taps before a field stayed focused.
class QappKeyboardInset extends StatelessWidget {
  const QappKeyboardInset({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: child,
    );
  }
}

class _QappViewState extends State<QappView>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
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
  String? _heldScrollNodeId;
  Map<String, dynamic>? _heldScrollPayload;
  String? _failureCode;
  String? _failureMessage;
  int _generation = 0;
  bool _firstFrameSent = false;

  /// Drives the Cupertino push/pop between two screens of the same app.
  late final AnimationController _nav;

  /// Screen the current navigation covers (push) or reveals (pop).
  QappTree? _outgoing;

  /// Direction of the transition on screen: `1` push, `-1` pop, `0` at rest.
  int _navDirection = 0;

  /// Direction the host asked for, waiting for the frame the app renders for
  /// the new route. A navigation that never renders must not animate an
  /// unrelated frame later, so the intent also expires.
  int? _navIntent;
  Timer? _navIntentTimer;

  @override
  void initState() {
    super.initState();
    _nav = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    )..addStatusListener(_onNavStatus);
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
    _navIntentTimer?.cancel();
    _nav.dispose();
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
    _heldScrollNodeId = null;
    _heldScrollPayload = null;
    _dragging = false;
    _scrolling = false;
    _pointerUpAt = null;
    _scrollWatchdog?.cancel();
    _navIntentTimer?.cancel();
    _navIntent = null;
    _navDirection = 0;
    _nav.value = 0;
    if (mounted) {
      setState(() {
        _tree = null;
        _outgoing = null;
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
    if (_navIntent == null && _shouldHoldFrame()) {
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
    // The frame a navigation produces is the only one that may animate: the
    // screen it replaces becomes the outgoing snapshot, and the new screen slides
    // in over it. Every other frame (a keystroke, a list loading) only repaints.
    final intent = _navIntent;
    _navIntent = null;
    _navIntentTimer?.cancel();
    final current = _tree;
    final animate = intent != null && intent != 0 && current != null;
    setState(() {
      if (animate) {
        _outgoing = current;
        _navDirection = intent;
      }
      _tree = tree;
      _failureCode = null;
      _failureMessage = null;
    });
    if (animate) {
      if (intent > 0) {
        _nav.value = 0;
        _nav.forward();
      } else {
        _nav.value = 1;
        _nav.reverse();
      }
    }
    if (!_firstFrameSent) {
      _firstFrameSent = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onFirstFrame?.call();
      });
    }
  }

  /// Marks the next painted frame as a push (`1`) or a pop (`-1`).
  void _intendNavigation(int direction) {
    _navIntent = direction;
    _navIntentTimer?.cancel();
    _navIntentTimer = Timer(const Duration(milliseconds: 600), () {
      _navIntent = null;
    });
  }

  /// Drops the outgoing screen once the transition has played out.
  ///
  /// A push finishes at `1` and a pop at `0`; the opposite end belongs to the
  /// other direction, so the guard keeps a controller reset from clearing the
  /// snapshot the new transition just installed.
  void _onNavStatus(AnimationStatus status) {
    final finished = switch (status) {
      AnimationStatus.completed => _navDirection > 0,
      AnimationStatus.dismissed => _navDirection < 0,
      _ => false,
    };
    if (!mounted || !finished || _outgoing == null) return;
    setState(() {
      _outgoing = null;
      _navDirection = 0;
    });
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
    // Re-arming on every notification would create and drop a timer on every
    // frame of a bounce; the safety net only has to outlive the gap between two
    // scroll frames, so a live timer is left alone.
    if (_scrollWatchdog?.isActive ?? false) return;
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
    // The newest scroll offset that was skipped while a frame waited goes first:
    // the render it produces supersedes the held frame, so both land in one
    // build instead of two.
    _flushHeldScroll();
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
    // A scroll frame that reaches JavaScript runs a whole render on the UI
    // thread, and the tree it produces is held until the list stops anyway. Once
    // one render is waiting, another scroll frame can only add work: the newest
    // offset is kept and handed over when the list comes to rest, so a drag or a
    // bounce past the edge runs one render instead of sixteen a second.
    if (event == 'scroll' && _scrolling && _pendingRender != null) {
      _heldScrollNodeId = nodeId;
      _heldScrollPayload = payload is Map<String, dynamic> ? payload : null;
      return;
    }
    _runtime?.dispatch(nodeId, event, payload);
  }

  /// Sends the newest scroll offset that was skipped while a render was waiting.
  void _flushHeldScroll() {
    final nodeId = _heldScrollNodeId;
    final payload = _heldScrollPayload;
    _heldScrollNodeId = null;
    _heldScrollPayload = null;
    if (nodeId == null) return;
    _runtime?.dispatch(nodeId, 'scroll', payload);
  }

  void _sendLifecycle(String event, Object? payload) {
    _runtime?.lifecycle(event, payload);
  }

  bool _navigate(String path) {
    final runtime = _runtime;
    if (runtime == null) return false;
    _routes.add(path);
    _intendNavigation(1);
    runtime.lifecycle('navigate', {'path': path, 'depth': _routes.length});
    return true;
  }

  bool _back() {
    final runtime = _runtime;
    if (runtime == null || _routes.isEmpty) return false;
    _routes.removeLast();
    _intendNavigation(-1);
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
    final outgoing = _outgoing;
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
            child: QappKeyboardInset(
              child: QappScreenTransition(
                animation: _nav,
                direction: _navDirection,
                live: QappRenderer(
                  root: tree.root,
                  screen: tree.screen,
                  onEvent: _dispatch,
                  loadAsset: _loadAsset,
                ),
                outgoing: outgoing == null
                    ? null
                    : QappRenderer(
                        root: outgoing.root,
                        screen: outgoing.screen,
                        onEvent: _ignoreEvent,
                        loadAsset: _loadAsset,
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _ignoreEvent(String nodeId, String event, Object? payload) {}

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
