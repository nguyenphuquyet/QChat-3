import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/qchat_animations.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';
import 'miniapp_api.dart';
import 'miniapp_bridge.dart';
import 'miniapp_cache.dart';
import 'miniapp_storage.dart';
import 'models.dart';
import 'qapp/qapp_js_types.dart';
import 'qapp/qapp_view.dart';

const miniAppRuntimeVersion = '1.0.0';

class MiniAppRuntimeScreen extends ConsumerStatefulWidget {
  const MiniAppRuntimeScreen({super.key, required this.appId, this.preview});

  final String appId;

  /// Summary handed over by the store so the launch screen can already show
  /// the real icon and name while the package is being fetched.
  final MiniAppSummary? preview;

  @override
  ConsumerState<MiniAppRuntimeScreen> createState() =>
      _MiniAppRuntimeScreenState();
}

class _MiniAppRuntimeScreenState extends ConsumerState<MiniAppRuntimeScreen>
    with WidgetsBindingObserver {
  final _startedAt = DateTime.now();

  MiniAppCache? _cache;
  MiniAppApi? _api;
  MiniAppBridge? _bridge;
  QappViewController? _qappController;
  String? _qappDirectory;
  String _qappKey = '';
  int _qappEpoch = 0;
  Set<String> _qappNetworkHosts = const {};
  CachedMiniApp? _active;

  String _name = '';
  String _iconUrl = '';
  String _version = '';
  List<String> _permissions = const [];
  bool _favorite = false;
  bool _loading = true;
  bool _offline = false;
  MiniAppException? _error;
  bool _closed = false;
  bool _recordedOpen = false;
  String? _cacheRoot;
  DateTime? _splashAt;
  Timer? _revealTimer;
  static const _splashMin = 480;
  Future<void> _permissionChain = Future.value();
  final Set<String> _runtimeErrors = {};

  @override
  void initState() {
    super.initState();
    final preview = widget.preview;
    if (preview != null) {
      _name = preview.name;
      _iconUrl = preview.iconUrl;
      _version = preview.currentVersion ?? '';
      _permissions = preview.requestedPermissions;
      _favorite = preview.favorite;
    }
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final qapp = _qappController;
    if (qapp == null) return;
    final event = state == AppLifecycleState.resumed
        ? 'resume'
        : state == AppLifecycleState.paused
        ? 'pause'
        : state == AppLifecycleState.detached
        ? 'destroy'
        : '';
    if (event.isNotEmpty) qapp.lifecycle(event);
  }

  @override
  void dispose() {
    _closed = true;
    _revealTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _bridge?.dispose();
    super.dispose();
  }

  Future<MiniAppCache> _openCache() async {
    final existing = _cache;
    if (existing != null) return existing;
    final support = await getApplicationSupportDirectory();
    final root = p.join(support.path, 'miniapps');
    _cacheRoot = root;
    return _cache = MiniAppCache(root);
  }

  /// Hides the launch screen once the page has painted. The splash is kept up
  /// for at least the slide-in duration so the icon never blinks away before
  /// the mini program has visually opened.
  void _revealContent() {
    if (!mounted || _closed || !_loading) return;
    _revealTimer?.cancel();
    final shownAt = _splashAt;
    final elapsed = shownAt == null
        ? _splashMin
        : DateTime.now().difference(shownAt).inMilliseconds;
    final remaining = _splashMin - elapsed;
    if (remaining <= 0) {
      setState(() => _loading = false);
      return;
    }
    _revealTimer = Timer(Duration(milliseconds: remaining), () {
      if (!mounted || _closed || !_loading) return;
      setState(() => _loading = false);
    });
  }

  Future<void> _load() async {
    if (!mounted) return;
    _bridge?.dispose();
    _bridge = null;
    _qappController = null;
    _qappDirectory = null;
    _qappKey = '';
    _revealTimer?.cancel();
    _splashAt = DateTime.now();
    setState(() {
      _loading = true;
      _error = null;
      _offline = false;
    });
    final api = _api ??= MiniAppApi(ref.read(clientProvider));
    final cache = await _openCache();
    try {
      final detail = await api.detail(widget.appId);
      if (mounted) {
        setState(() {
          _name = detail.name;
          _iconUrl = detail.iconUrl;
          _favorite = detail.favorite;
        });
      }
      final build = await api.build(widget.appId);
      // Legacy WebView builds are inert now. Fail clearly instead of trying to
      // verify an HTML package against the native qapp layout.
      if (build.format != 'qapp') {
        throw const MiniAppException('UNSUPPORTED_FORMAT');
      }
      _version = build.version;
      _permissions = build.requestedPermissions;
      _checkRuntime(build.minRuntimeVersion);
      final installed = await cache.find(build) ?? await cache.install(build);
      _recordedOpen = false;
      await _startQapp(installed);
    } on MiniAppException catch (error) {
      await _handleFailure(error, cache);
    } on MiniAppCacheException catch (error) {
      await _telemetry('download_failure', error.code);
      if (!mounted) return;
      setState(() {
        _error = MiniAppException(error.code, message: error.code);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = const MiniAppException('SERVICE_ERROR');
        _loading = false;
      });
    }
  }

  Future<void> _handleFailure(
    MiniAppException error,
    MiniAppCache cache,
  ) async {
    if (error.offline) {
      final latest = await cache.latest(widget.appId);
      if (latest != null) {
        _name = latest.manifest.name;
        _version = latest.version;
        _permissions = latest.manifest.requestedPermissions;
        _offline = true;
        try {
          await _startQapp(latest);
        } catch (_) {
          if (!mounted) return;
          setState(() {
            _error = error;
            _loading = false;
          });
        }
        return;
      }
    }
    if (error.code == 'VERSION_REVOKED') {
      await cache.remove(widget.appId);
    }
    await _telemetry(
      error.code == 'APP_SUSPENDED' || error.code == 'VERSION_REVOKED'
          ? 'launch_failure'
          : 'download_failure',
      error.code,
    );
    if (!mounted) return;
    setState(() {
      _error = error;
      _loading = false;
    });
  }

  void _checkRuntime(String minimum) {
    if (_compareVersion(miniAppRuntimeVersion, minimum) >= 0) return;
    throw MiniAppException(
      'RUNTIME_TOO_OLD',
      message: 'Requires runtime $minimum',
    );
  }

  /// Starts a compiled TypeScript package in the sandboxed native runtime.
  Future<void> _startQapp(CachedMiniApp cached) async {
    _active = cached;
    final storage = await MiniAppStorage.open(
      _cacheRoot ?? p.dirname(p.dirname(p.dirname(cached.directory))),
      widget.appId,
    );
    final prefs = await SharedPreferences.getInstance();
    final granted =
        prefs.getStringList('miniapp.permissions.${widget.appId}')?.toSet() ??
        <String>{};
    if (!mounted || _closed) return;

    final controller = QappViewController();
    final bridge = MiniAppBridge(
      appId: cached.appId,
      appName: _name,
      version: cached.version,
      entry: cached.entry,
      runtimeVersion: miniAppRuntimeVersion,
      minRuntimeVersion: cached.manifest.minRuntimeVersion,
      permissions: _permissions,
      api: _api!,
      storage: storage,
      granted: granted,
      networkDomains: cached.manifest.networkDomains,
      requestPermission: _requestPermission,
      onToast: _showToast,
      onShare: _share,
      onNavigate: (path) async {
        controller.navigate(path);
      },
      onNavigateBack: () async {
        if (!controller.back()) _close();
      },
      onClose: _close,
      systemInfo: _systemInfo,
    );
    _bridge = bridge;
    if (!mounted || _closed) return;
    setState(() {
      _qappController = controller;
      _qappDirectory = cached.directory;
      _qappKey =
          '${cached.appId}@${cached.version}#${++_qappEpoch}';
      _qappNetworkHosts = cached.manifest.networkDomains
          .map((domain) => domain.toLowerCase())
          .toSet();
    });
    _revealTimer?.cancel();
    // The native runtime normally paints within a few frames. The timeout only
    // stops the splash from covering a broken package forever.
    _revealTimer = Timer(const Duration(seconds: 8), _revealContent);
  }

  Future<void> _recordOpen(CachedMiniApp cached) async {
    try {
      await _api?.recordOpen(widget.appId);
    } catch (_) {
      // Recent apps are a convenience; opening still works offline.
    }
    await _telemetry('open', '');
    await _telemetry('launch_success', '');
  }

  Future<void> _telemetry(String event, String errorCode) async {
    final api = _api;
    if (api == null) return;
    try {
      await api.telemetry(
        appId: widget.appId,
        version: _version,
        event: event,
        errorCode: errorCode,
        durationMs: DateTime.now().difference(_startedAt).inMilliseconds,
      );
    } catch (_) {
      // Analytics must never break the runtime.
    }
  }

  Future<bool> _requestPermission(String permission) {
    final completer = Completer<bool>();
    _permissionChain = _permissionChain.then((_) async {
      try {
        completer.complete(await _askPermission(permission));
      } catch (error, stack) {
        completer.completeError(error, stack);
      }
    });
    return completer.future;
  }

  Future<bool> _askPermission(String permission) async {
    if (!mounted) return false;
    final key = switch (permission) {
      'toast' => 'permissionToast',
      'user.profile' => 'permissionUserProfile',
      'media.choose' => 'permissionMediaChoose',
      'share' => 'permissionShare',
      'storage' => 'permissionStorage',
      'qchat.api' => 'permissionQchatApi',
      'network' => 'permissionNetwork',
      _ => null,
    };
    final allowed = await showQChatDialog<bool>(
      context,
      title: tr(context, 'miniAppsPermissionTitle'),
      content: Builder(
        builder: (dialog) => Padding(
          padding: const EdgeInsets.fromLTRB(24, 14, 24, 26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$_name ${tr(dialog, 'miniAppsPermissionBody')}:',
                style: TextStyle(fontSize: 14, color: ink(dialog)),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const QChatIcon(
                    'shieldCheck',
                    size: 18,
                    color: QChatColors.muted,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      key == null ? permission : tr(dialog, key),
                      style: TextStyle(fontSize: 14, color: ink(dialog)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        QChatDialogAction(label: tr(context, 'miniAppsDeny'), result: false),
        QChatDialogAction(
          label: tr(context, 'miniAppsAllow'),
          primary: true,
          result: true,
        ),
      ],
    );
    if (allowed != true) return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final granted =
          prefs.getStringList('miniapp.permissions.${widget.appId}')?.toSet() ??
          <String>{};
      granted.add(permission);
      await prefs.setStringList(
        'miniapp.permissions.${widget.appId}',
        granted.toList()..sort(),
      );
    } catch (_) {
      // The grant still applies for this session.
    }
    return true;
  }

  void _showToast(String message, String icon) {
    if (!mounted) return;
    TToast.showText(
      message,
      context: context,
      placement: TToastPlacement.bottom,
      duration: const Duration(milliseconds: 2200),
    );
  }

  Future<bool> _share(String text, String url, String title) async {
    if (!mounted) return false;
    final body = [text, url].where((part) => part.isNotEmpty).join('\n');
    final copied = await showQChatSheet<bool>(
      context,
      (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title.isEmpty ? tr(sheet, 'miniAppsShareTitle') : title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(sheet).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(body, style: const TextStyle(fontSize: 14)),
            ),
            const SizedBox(height: 16),
            QChatButton(
              tr(sheet, 'miniAppsShareCopy'),
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: body));
                if (sheet.mounted) Navigator.pop(sheet, true);
              },
            ),
            const SizedBox(height: 8),
            QChatButton(
              tr(sheet, 'miniAppsDeny'),
              secondary: true,
              onTap: () => Navigator.pop(sheet, false),
            ),
          ],
        ),
      ),
    );
    if (copied == true && mounted) {
      _showToast(tr(context, 'miniAppsCopied'), 'success');
    }
    return copied == true;
  }

  Map<String, dynamic> _systemInfo() {
    final size = MediaQuery.sizeOf(context);
    final padding = MediaQuery.paddingOf(context);
    return {
      'platform': Platform.isAndroid
          ? 'android'
          : Platform.isIOS
          ? 'ios'
          : 'unknown',
      'osVersion': Platform.operatingSystemVersion,
      'appVersion': '1.1.0',
      'runtimeVersion': miniAppRuntimeVersion,
      'locale': ref.read(preferencesProvider).locale,
      'theme': Theme.of(context).brightness == Brightness.dark
          ? 'dark'
          : 'light',
      'screenWidth': size.width,
      'screenHeight': size.height,
      'pixelRatio': MediaQuery.devicePixelRatioOf(context),
      'safeAreaTop': padding.top,
      'safeAreaBottom': padding.bottom,
    };
  }

  Future<void> _toggleFavorite() async {
    final api = _api;
    if (api == null) return;
    final next = !_favorite;
    setState(() => _favorite = next);
    try {
      if (next) {
        await api.addFavorite(widget.appId);
      } else {
        await api.removeFavorite(widget.appId);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _favorite = !next);
      _showToast(tr(context, 'networkError'), 'error');
    }
  }

  void _close() {
    if (_closed || !mounted) return;
    _closed = true;
    _bridge?.dispose();
    _qappController = null;
    _qappDirectory = null;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/miniApps');
    }
  }

  Future<void> _handleBack() async {
    final qapp = _qappController;
    if (qapp != null && qapp.back()) return;
    _close();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_handleBack());
      },
      // The mini program owns the whole screen; the host only floats a menu
      // button and a close button in the top right corner.
      child: QChatPage(
        edgeToEdge: true,
        child: Stack(
          children: [
            Positioned.fill(child: _body(context)),
            Positioned(
              top: MediaQuery.paddingOf(context).top + 8,
              right: 10,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _FloatButton(
                    icon: 'more',
                    label: tr(context, 'more'),
                    onTap: () => _openMenu(context),
                  ),
                  const SizedBox(width: 8),
                  _FloatButton(
                    icon: 'close',
                    label: tr(context, 'miniAppsClose'),
                    onTap: _close,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // qchatTopMenu translates each label, so pass the string keys.
  void _openMenu(BuildContext c) => qchatTopMenu(c, [
    (
      'star',
      _favorite ? 'miniAppsUnfavorite' : 'miniAppsFavorite',
      () => unawaited(_toggleFavorite()),
    ),
    ('refresh', 'miniAppsReload', _reload),
    ('close', 'miniAppsClose', _close),
  ]);

  void _reload() {
    unawaited(_load());
  }

  Widget _body(BuildContext context) {
    final error = _error;
    if (error != null) return _errorView(context, error);
    final qappController = _qappController;
    final qappDirectory = _qappDirectory;
    if (qappController != null && qappDirectory != null) {
      return _qappBody(context, qappController, qappDirectory);
    }
    return _loading
        ? _launchScreen(context)
        : _errorView(context, const MiniAppException('SERVICE_ERROR'));
  }

  Widget _qappBody(
    BuildContext context,
    QappViewController controller,
    String directory,
  ) {
    return Stack(
      children: [
        Positioned.fill(
          child: QappView(
            key: ValueKey('qapp:$_qappKey'),
            directory: directory,
            controller: controller,
            networkHosts: _qappNetworkHosts,
            onHostCall: (method, params) {
              final bridge = _bridge;
              if (bridge == null) {
                return Future.value(
                  const QappHostResponse.error(
                    'BRIDGE_UNAVAILABLE',
                    'The QChat host is not ready',
                  ),
                );
              }
              return bridge.execute(method, params);
            },
            onFirstFrame: () {
              if (_recordedOpen) {
                _revealContent();
                return;
              }
              _recordedOpen = true;
              final active = _active;
              if (active != null) unawaited(_recordOpen(active));
              _revealContent();
            },
            onError: (code, message) {
              if (!mounted || _closed) return;
              _revealTimer?.cancel();
              if (_loading) setState(() => _loading = false);
              if (_runtimeErrors.add(code)) {
                unawaited(_telemetry('runtime_error', code));
              }
            },
            onLog: (level, message, stack) {
              if (kDebugMode) {
                debugPrint(
                  '[qapp] $level: $message${stack == null ? '' : '\n$stack'}',
                );
              }
            },
          ),
        ),
        if (_offline) _offlineBanner(context),
        if (_loading) Positioned.fill(child: _launchScreen(context)),
      ],
    );
  }

  Widget _offlineBanner(BuildContext context) => Positioned(
    left: 12,
    right: 12,
    bottom: 12,
    child: IgnorePointer(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xdd333333),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          tr(context, 'miniAppsOffline'),
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ),
    ),
  );

  Widget _launchScreen(BuildContext context) => Stack(
    children: [
      Positioned.fill(
        child: _MiniAppSplash(name: _name, iconUrl: _iconUrl),
      ),
      if (_offline)
        Positioned(
          left: 24,
          right: 24,
          bottom: 48,
          child: Text(
            tr(context, 'miniAppsOffline'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: QChatColors.muted),
          ),
        ),
    ],
  );

  Widget _errorView(BuildContext context, MiniAppException error) {
    final message = switch (error.code) {
      'APP_SUSPENDED' => tr(context, 'miniAppsUnavailable'),
      'VERSION_REVOKED' => tr(context, 'miniAppsRevoked'),
      'RUNTIME_TOO_OLD' => tr(context, 'miniAppsUnavailable'),
      'UNSUPPORTED_FORMAT' => tr(context, 'miniAppsUnsupported'),
      'NOT_PUBLISHED' => tr(context, 'miniAppsUnavailable'),
      'UNAUTHORIZED' => tr(context, 'sessionExpired'),
      _ => tr(context, 'miniAppsError'),
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const QChatIcon('miniApps', size: 48, color: QChatColors.muted),
            const SizedBox(height: 14),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
            if (error.code == 'RUNTIME_TOO_OLD') ...[
              const SizedBox(height: 6),
              Text(
                tr(context, 'miniAppsUpdateAvailable'),
                style: const TextStyle(fontSize: 12, color: QChatColors.muted),
              ),
            ],
            const SizedBox(height: 18),
            QChatButton(tr(context, 'miniAppsRetry'), onTap: _load),
            const SizedBox(height: 8),
            QChatButton(
              tr(context, 'miniAppsClose'),
              secondary: true,
              onTap: _close,
            ),
          ],
        ),
      ),
    );
  }
}

/// Launch screen shown while the mini program package is fetched and the
/// QuickJS runtime paints its first frame. It mirrors the familiar mini program
/// splash: the app icon centred on a plain page, its name underneath and a
/// small green dot slowly orbiting the icon.
class _MiniAppSplash extends StatefulWidget {
  const _MiniAppSplash({required this.name, required this.iconUrl});

  final String name;
  final String iconUrl;

  @override
  State<_MiniAppSplash> createState() => _MiniAppSplashState();
}

class _MiniAppSplashState extends State<_MiniAppSplash>
    with SingleTickerProviderStateMixin {
  static const _iconSize = 54.0;
  static const _orbitSize = 84.0;
  static const _dotSize = 6.0;

  late final AnimationController _orbit;

  @override
  void initState() {
    super.initState();
    _orbit = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _orbit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ColoredBox(
      // The launch page stays plain white (dark in dark mode), matching the
      // mini program splash instead of the app's grey page background.
      color: dark ? const Color(0xff111111) : Colors.white,
      child: Align(
        alignment: const Alignment(0, -0.22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox.square(
              dimension: _orbitSize,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: _iconSize,
                    height: _iconSize,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: surface(context),
                      borderRadius: BorderRadius.circular(_iconSize * .24),
                      border: Border.all(
                        color: ink(context).withValues(alpha: .08),
                        width: .5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: .06),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: _icon,
                  ),
                  AnimatedBuilder(
                    animation: _orbit,
                    builder: (context, child) => Transform.rotate(
                      angle: _orbit.value * 2 * math.pi,
                      child: child,
                    ),
                    child: const Align(
                      alignment: Alignment.topCenter,
                      child: Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: SizedBox.square(
                          dimension: _dotSize,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: QChatColors.green,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (widget.name.isNotEmpty) ...[
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  widget.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w600,
                    color: ink(context),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget get _icon => widget.iconUrl.isEmpty
      ? const Center(
          child: QChatIcon('miniApps', size: 28, color: QChatColors.green),
        )
      : Image.network(
          widget.iconUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const Center(
            child: QChatIcon('miniApps', size: 28, color: QChatColors.green),
          ),
        );
}

int _compareVersion(String a, String b) {
  final left = a.split('-').first.split('.').map(int.tryParse).toList();
  final right = b.split('-').first.split('.').map(int.tryParse).toList();
  for (var i = 0; i < 3; i++) {
    final x = i < left.length ? (left[i] ?? 0) : 0;
    final y = i < right.length ? (right[i] ?? 0) : 0;
    if (x != y) return x.compareTo(y);
  }
  return 0;
}

/// Round translucent control floating over the mini program: a white glyph on
/// a dark tint, tinted further while pressed (the app draws no ripples).
class _FloatButton extends StatefulWidget {
  const _FloatButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final String icon;
  final String label;
  final VoidCallback onTap;

  @override
  State<_FloatButton> createState() => _FloatButtonState();
}

class _FloatButtonState extends State<_FloatButton> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: widget.label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: qchatDuration(context),
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _pressed ? const Color(0x9e000000) : const Color(0x5e000000),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: .16),
            width: .5,
          ),
        ),
        child: QChatIcon(widget.icon, size: 17, color: Colors.white),
      ),
    ),
  );
}
