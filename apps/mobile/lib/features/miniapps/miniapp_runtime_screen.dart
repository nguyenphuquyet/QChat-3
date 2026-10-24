import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'miniapp_api.dart';
import 'miniapp_asset_server.dart';
import 'miniapp_bridge.dart';
import 'miniapp_cache.dart';
import 'miniapp_storage.dart';
import 'models.dart';

const miniAppRuntimeVersion = '1.0.0';

class MiniAppRuntimeScreen extends ConsumerStatefulWidget {
  const MiniAppRuntimeScreen({super.key, required this.appId});

  final String appId;

  @override
  ConsumerState<MiniAppRuntimeScreen> createState() =>
      _MiniAppRuntimeScreenState();
}

class _MiniAppRuntimeScreenState extends ConsumerState<MiniAppRuntimeScreen>
    with WidgetsBindingObserver {
  final _startedAt = DateTime.now();

  MiniAppCache? _cache;
  MiniAppApi? _api;
  MiniAppAssetServer? _server;
  MiniAppBridge? _bridge;
  WebViewController? _web;

  String _name = '';
  String _version = '';
  List<String> _permissions = const [];
  bool _favorite = false;
  bool _loading = true;
  bool _offline = false;
  bool _webError = false;
  String _stage = 'download';
  MiniAppException? _error;
  bool _closed = false;
  bool _recordedOpen = false;
  String? _cacheRoot;
  Future<void> _permissionChain = Future.value();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final web = _web;
    if (web == null) return;
    final event = state == AppLifecycleState.resumed
        ? 'qchat:resume'
        : state == AppLifecycleState.paused
        ? 'qchat:pause'
        : '';
    if (event.isEmpty) return;
    web.runJavaScript('window.dispatchEvent(new Event("$event"));');
  }

  @override
  void dispose() {
    _closed = true;
    WidgetsBinding.instance.removeObserver(this);
    _bridge?.dispose();
    _server?.close();
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

  Future<void> _load() async {
    if (!mounted) return;
    _bridge?.dispose();
    _bridge = null;
    _web = null;
    final previous = _server;
    _server = null;
    if (previous != null) unawaited(previous.close());
    setState(() {
      _loading = true;
      _error = null;
      _webError = false;
      _offline = false;
      _stage = 'download';
    });
    final api = _api ??= MiniAppApi(ref.read(clientProvider));
    final cache = await _openCache();
    try {
      final detail = await api.detail(widget.appId);
      _name = detail.name;
      _favorite = detail.favorite;
      final build = await api.build(widget.appId);
      _version = build.version;
      _permissions = build.requestedPermissions;
      _checkRuntime(build.minRuntimeVersion);
      final installed =
          await cache.find(build) ??
          await cache.install(
            build,
            onStage: (stage) {
              if (!mounted) return;
              setState(() => _stage = stage);
            },
          );
      _recordedOpen = false;
      await _start(installed);
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

  Future<void> _handleFailure(MiniAppException error, MiniAppCache cache) async {
    if (error.offline) {
      final latest = await cache.latest(widget.appId);
      if (latest != null) {
        _name = latest.manifest.name;
        _version = latest.version;
        _permissions = latest.manifest.requestedPermissions;
        _offline = true;
        try {
          await _start(latest);
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

  Future<void> _start(CachedMiniApp cached) async {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final server = MiniAppAssetServer(
      root: cached.directory,
      entry: cached.entry,
      appId: cached.appId,
    );
    await server.start();
    if (!mounted || _closed) {
      await server.close();
      return;
    }
    _server = server;
    final storage = await MiniAppStorage.open(
      _cacheRoot ?? p.dirname(p.dirname(p.dirname(cached.directory))),
      widget.appId,
    );
    final prefs = await SharedPreferences.getInstance();
    final granted =
        prefs.getStringList('miniapp.permissions.${widget.appId}')?.toSet() ??
        <String>{};
    if (!mounted || _closed) return;

    final controller = WebViewController();
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
      requestPermission: _requestPermission,
      onToast: _showToast,
      onShare: _share,
      onNavigate: (path) async {
        await controller.loadRequest(Uri.parse('${server.origin}$path'));
      },
      onClose: _close,
      onResponse: (payload) {
        unawaited(controller.runJavaScript(qchatReceiveScript(payload)));
      },
      systemInfo: _systemInfo,
    );
    _bridge = bridge;

    await controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await controller.setBackgroundColor(
      dark ? const Color(0xff111111) : Colors.white,
    );
    await controller.addJavaScriptChannel(
      'QChatNative',
      onMessageReceived: (message) => unawaited(bridge.handle(message.message)),
    );
    controller.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (request) {
          if (request.url.startsWith(server.origin)) {
            return NavigationDecision.navigate;
          }
          _showToast(tr(context, 'miniAppsExternalBlocked'), 'none');
          return NavigationDecision.prevent;
        },
        onWebResourceError: (error) {
          if (!mounted || _closed) return;
          if (error.isForMainFrame != true) return;
          setState(() => _webError = true);
          unawaited(_telemetry('runtime_error', error.errorCode.toString()));
        },
        onPageFinished: (_) {
          if (!mounted || _closed) return;
          if (_webError) setState(() => _webError = false);
          if (!_recordedOpen) {
            _recordedOpen = true;
            unawaited(_recordOpen(cached));
          }
        },
      ),
    );
    if (!mounted || _closed) return;
    setState(() {
      _web = controller;
      _loading = false;
    });
    try {
      await controller.loadRequest(Uri.parse(server.url));
    } catch (_) {
      if (!mounted) return;
      setState(() => _webError = true);
    }
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
      _ => null,
    };
    final allowed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(tr(dialog, 'miniAppsPermissionTitle')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$_name ${tr(dialog, 'miniAppsPermissionBody')}:',
              style: const TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.check_circle_outline, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    key == null ? permission : tr(dialog, key),
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(tr(dialog, 'miniAppsDeny')),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(tr(dialog, 'miniAppsAllow')),
          ),
        ],
      ),
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
    _server?.close();
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/miniApps');
    }
  }

  Future<void> _handleBack() async {
    final web = _web;
    if (web != null && await web.canGoBack()) {
      await web.goBack();
      return;
    }
    _close();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_handleBack());
      },
      child: QChatPage(
        title: _name.isEmpty ? tr(context, 'miniAppsTitle') : _name,
        glassHeader: false,
        leading: QChatIconButton(
          'close',
          label: tr(context, 'miniAppsClose'),
          onTap: _handleBack,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            QChatIconButton(
              'star',
              label: tr(
                context,
                _favorite ? 'miniAppsUnfavorite' : 'miniAppsFavorite',
              ),
              color: _favorite ? const Color(0xffe0a500) : null,
              onTap: _toggleFavorite,
            ),
            QChatIconButton(
              'refresh',
              label: tr(context, 'miniAppsReload'),
              onTap: () {
                setState(() => _webError = false);
                final web = _web;
                if (web != null) unawaited(web.reload());
              },
            ),
          ],
        ),
        child: _body(context),
      ),
    );
  }

  Widget _body(BuildContext context) {
    if (_loading) {
      final label = switch (_stage) {
        'verify' => tr(context, 'miniAppsVerifying'),
        'extract' => tr(context, 'miniAppsVerifying'),
        _ => tr(context, 'miniAppsDownloading'),
      };
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 18),
            Text(label, style: const TextStyle(fontSize: 14)),
            if (_offline) ...[
              const SizedBox(height: 8),
              Text(
                tr(context, 'miniAppsOffline'),
                style: const TextStyle(
                  fontSize: 12,
                  color: QChatColors.muted,
                ),
              ),
            ],
          ],
        ),
      );
    }
    final error = _error;
    if (error != null) return _errorView(context, error);
    final web = _web;
    if (web == null) return _errorView(context, const MiniAppException('SERVICE_ERROR'));
    return Stack(
      children: [
        Positioned.fill(child: WebViewWidget(controller: web)),
        if (_offline)
          Positioned(
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
          ),
        if (_webError)
          Positioned.fill(
            child: ColoredBox(
              color: Theme.of(context).scaffoldBackgroundColor,
              child: _errorView(
                context,
                const MiniAppException('SERVICE_ERROR'),
              ),
            ),
          ),
      ],
    );
  }

  Widget _errorView(BuildContext context, MiniAppException error) {
    final message = switch (error.code) {
      'APP_SUSPENDED' => tr(context, 'miniAppsUnavailable'),
      'VERSION_REVOKED' => tr(context, 'miniAppsRevoked'),
      'RUNTIME_TOO_OLD' => tr(context, 'miniAppsUnavailable'),
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
