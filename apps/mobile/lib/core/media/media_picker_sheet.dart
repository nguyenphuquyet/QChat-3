import 'dart:async';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

import '../../features/chats/preview_video_web.dart'
    if (dart.library.io) '../../features/chats/preview_video_native.dart';
import '../design_system/components.dart';
import '../localization/strings.dart';
import 'media_library.dart';

const double _kBarHeight = 44;
const double _kBottomBarHeight = 60;
const double _kGridGap = 2;
const double _kBadgeSize = 24;

/// The preview page lets the picture own the whole screen: the chrome floats on
/// top of it as a translucent scrim, never as a bar that shortens the photo.
const double _kPreviewBarHeight = 52;
const int _kPageSize = 100;

/// The page the app shows every time the user sends a photo or a video.
///
/// It slides up from the bottom, covers the screen, and reads the device's own
/// library: a grid of recent items over an album switcher, with a preview, an
/// "All photos" escape hatch for a limited library, and one send button. Chat,
/// moments, avatars, chat backgrounds and the scanner all come through here, so
/// a photo is picked the same way everywhere.
Future<List<XFile>> showMediaPicker(
  BuildContext context, {
  required MediaLibrary library,
  required bool imagesOnly,
  required int maxAssets,
  String? confirmLabel,
}) async {
  if (maxAssets < 1) return const [];
  final files = await Navigator.of(context).push<List<XFile>>(
    // The picker rises from the bottom edge like a tray, and drops back down
    // when it closes, instead of falling in from the top.
    PageRouteBuilder<List<XFile>>(
      transitionDuration: const Duration(milliseconds: 320),
      reverseTransitionDuration: const Duration(milliseconds: 260),
      pageBuilder: (_, _, _) => MediaPickerSheet(
        library: library,
        imagesOnly: imagesOnly,
        maxAssets: maxAssets,
        confirmLabel: confirmLabel,
      ),
      transitionsBuilder: (_, animation, _, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return SlideTransition(
          position: Tween(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(curve),
          child: child,
        );
      },
    ),
  );
  return files ?? const [];
}

class MediaPickerSheet extends StatefulWidget {
  const MediaPickerSheet({
    super.key,
    required this.library,
    required this.imagesOnly,
    required this.maxAssets,
    this.confirmLabel,
  });

  final MediaLibrary library;
  final bool imagesOnly;
  final int maxAssets;
  final String? confirmLabel;

  @override
  State<MediaPickerSheet> createState() => _MediaPickerSheetState();
}

class _MediaPickerSheetState extends State<MediaPickerSheet>
    with SingleTickerProviderStateMixin {
  final _scroll = ScrollController();
  final _thumbs = <String, Future<Uint8List?>>{};
  final _covers = <String, Future<Uint8List?>>{};
  final _assets = <MediaAsset>[];
  final _selected = <MediaAsset>[];

  /// Drives the album panel in and out; the chevron follows the same value so
  /// the two never disagree mid-flight.
  late final _panel = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );

  var _albums = const <MediaAlbum>[];
  MediaAlbum? _album;
  var _access = MediaAccess.full;
  var _opened = false;
  var _page = 0;
  var _more = true;
  var _loadingMore = false;
  var _sending = false;
  var _albumsOpen = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_loadWhenNearTheEnd);
    unawaited(_open());
  }

  @override
  void dispose() {
    _panel.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _toggleAlbums() {
    if (_albums.length < 2) return;
    if (_albumsOpen) {
      unawaited(_closeAlbums());
      return;
    }
    setState(() => _albumsOpen = true);
    _panel.forward();
  }

  Future<void> _closeAlbums() async {
    if (!_albumsOpen) return;
    await _panel.reverse();
    if (mounted) setState(() => _albumsOpen = false);
  }

  Future<void> _open() async {
    try {
      final access = await widget.library.requestAccess();
      if (!mounted) return;
      if (access == MediaAccess.denied) {
        setState(() {
          _access = access;
          _opened = true;
        });
        return;
      }
      final albums = await widget.library.albums();
      if (!mounted) return;
      setState(() {
        _access = access;
        _albums = albums;
        _album = albums.isEmpty ? null : albums.first;
        _opened = true;
      });
      await _loadPage();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _opened = true;
        _error = tr(context, 'mediaUnavailable');
      });
    }
  }

  Future<void> _loadPage() async {
    final album = _album;
    if (album == null || _loadingMore || !_more) return;
    _loadingMore = true;
    try {
      final page = await widget.library.assets(
        album,
        page: _page,
        size: _kPageSize,
      );
      if (!mounted) return;
      setState(() {
        _assets.addAll(page);
        _page += 1;
        _more = page.length >= _kPageSize;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _more = false;
        _error = tr(context, 'mediaUnavailable');
      });
    } finally {
      _loadingMore = false;
    }
  }

  void _loadWhenNearTheEnd() {
    if (!_scroll.hasClients || _loadingMore) return;
    if (_scroll.position.extentAfter < 800) unawaited(_loadPage());
  }

  Future<void> _selectAlbum(MediaAlbum album) async {
    if (album.id == _album?.id) return;
    setState(() {
      _album = album;
      _assets.clear();
      _selected.clear();
      _page = 0;
      _more = true;
      _error = null;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
    await _loadPage();
  }

  Future<void> _reload() async {
    setState(() {
      _assets.clear();
      _selected.clear();
      _thumbs.clear();
      _covers.clear();
      _albums = const [];
      _album = null;
      _page = 0;
      _more = true;
      _error = null;
    });
    await _open();
  }

  void _toggle(MediaAsset asset) {
    final index = _selected.indexOf(asset);
    if (index >= 0) {
      setState(() => _selected.removeAt(index));
      return;
    }
    // One asset is a choice, not a set: a new tap moves the tick instead of
    // refusing it. Avatars and chat backgrounds come through here with a limit
    // of one, and a "selection limit" toast there would read as a bug.
    if (widget.maxAssets == 1) {
      setState(() {
        _selected
          ..clear()
          ..add(asset);
      });
      return;
    }
    if (_selected.length >= widget.maxAssets) {
      showQChatToast(
        context,
        '${tr(context, 'selectionLimit')} ${widget.maxAssets}',
      );
      return;
    }
    setState(() => _selected.add(asset));
  }

  Future<Uint8List?> _thumb(MediaAsset asset) => _thumbs.putIfAbsent(
    asset.id,
    () => widget.library.thumbnail(asset, size: 320),
  );

  Future<Uint8List?> _cover(MediaAlbum album) => _covers.putIfAbsent(
    album.id,
    () async {
      final page = await widget.library.assets(album, page: 0, size: 1);
      if (page.isEmpty) return null;
      return widget.library.thumbnail(page.first, size: 120);
    },
  );

  Future<void> _submit() async {
    if (_selected.isEmpty || _sending) return;
    setState(() => _sending = true);
    final files = <XFile>[];
    try {
      for (final asset in _selected) {
        files.add(await widget.library.file(asset));
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = tr(context, 'mediaUnavailable');
      });
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pop(files);
  }

  Future<void> _browseFiles() async {
    try {
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          'jpg',
          'jpeg',
          'png',
          'gif',
          'webp',
          if (!widget.imagesOnly) ...['mp4', 'mov'],
        ],
      );
      if (!mounted || picked.isEmpty) return;
      Navigator.of(
        context,
      ).pop(picked.map((file) => file.xFile).take(widget.maxAssets).toList());
    } catch (_) {
      if (mounted) setState(() => _error = tr(context, 'mediaUnavailable'));
    }
  }

  Future<void> _widen() async {
    try {
      await widget.library.widenAccess();
    } catch (_) {
      // The OS refused to reopen the picker; the sheet still reloads below.
    }
    if (mounted) await _reload();
  }

  Future<void> _preview(List<MediaAsset> items, int index) async {
    if (items.isEmpty) return;
    await Navigator.of(context).push<void>(
      // A horizontal push, the way a photo opens out of a gallery: the grid
      // slides left and the picture takes its place.
      CupertinoPageRoute(
        builder: (_) => _MediaPreviewPage(
          library: widget.library,
          assets: List.of(items),
          index: index,
          selection: _selected,
          maxAssets: widget.maxAssets,
          confirmLabel: widget.confirmLabel,
          onSubmit: _submit,
          onSelectionChanged: () {
            if (mounted) setState(() {});
          },
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    // The picker is dark in every theme: photos read better against a neutral
    // black, and the reference treats this page as a lightbox, not a list.
    return QChatTheme(
      dark: true,
      child: Builder(
        builder: (c) => AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle.light,
          child: ColoredBox(
            // Hard-wired to the dark palette: the picker is a lightbox and must
            // never inherit a light host's background.
            color: QChatColors.darkBackground,
            child: Stack(
              children: [
                Positioned.fill(child: _body(c)),
                Positioned(left: 0, right: 0, top: 0, child: _bar(c)),
                Positioned(left: 0, right: 0, bottom: 0, child: _bottomBar(c)),
                if (_albumsOpen) _albumPanel(c),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _bar(BuildContext c) => _Scrim(
    fromTop: true,
    edge: true,
    // A floor of black keeps the bar readable even over a white screenshot,
    // while the fade lets the tiles show through as they scroll under it.
    colors: const [Color(0xe6000000), Color(0xb3000000)],
    child: Padding(
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(c).top),
      child: SizedBox(
        height: _kBarHeight,
        child: Stack(
          children: [
            Positioned(
              left: 4,
              top: 0,
              bottom: 0,
              child: Center(
                child: QChatIconButton(
                  'close',
                  label: tr(c, 'close'),
                  size: 22,
                  onTap: () => Navigator.of(c).pop(),
                ),
              ),
            ),
            Center(child: _albumPill(c)),
          ],
        ),
      ),
    ),
  );

  Widget _albumPill(BuildContext c) {
    final album = _album;
    final name = album == null
        ? tr(c, 'recentMedia')
        : _albumName(c, album);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _toggleAlbums,
      child: Container(
        height: 36,
        padding: const EdgeInsets.only(left: 14, right: 4),
        decoration: BoxDecoration(
          color: qchatFill(c),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 168),
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                  color: ink(c),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: qchatDark(c)
                    ? const Color(0xff3d3d3d)
                    : const Color(0xffe3e3e3),
              ),
              child: AnimatedBuilder(
                animation: _panel,
                builder: (_, child) => Transform.rotate(
                  angle: _panel.value * math.pi,
                  child: child,
                ),
                child: RotatedBox(
                  quarterTurns: 1,
                  child: QChatIcon('chevron', size: 16, color: ink(c)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext c) {
    if (!_opened) return const QChatLoading();
    if (_access == MediaAccess.denied) return _denied(c);
    if (_assets.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(
            _error ?? tr(c, 'noMedia'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, height: 1.4, color: qchatMuted(c)),
          ),
        ),
      );
    }
    return GridView.builder(
      controller: _scroll,
      // The bars float over the grid, so the tiles scroll under them and the
      // first row starts below the top bar.
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(c).top + _kBarHeight,
        bottom:
            MediaQuery.paddingOf(c).bottom +
            _kBottomBarHeight +
            (_access == MediaAccess.limited ? 44 : 0),
      ),
      itemCount: _assets.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: _kGridGap,
        crossAxisSpacing: _kGridGap,
      ),
      itemBuilder: (_, index) {
        final asset = _assets[index];
        return _AssetTile(
          key: ValueKey(asset.id),
          asset: asset,
          thumb: _thumb(asset),
          order: _selected.indexOf(asset),
          onToggle: () => _toggle(asset),
          onPreview: () => _preview(_assets, index),
        );
      },
    );
  }

  Widget _denied(BuildContext c) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          QChatIcon('image', size: 44, color: qchatMuted(c)),
          const SizedBox(height: 16),
          Text(
            tr(c, 'photoPermission'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, height: 1.4, color: qchatMuted(c)),
          ),
          const SizedBox(height: 20),
          QChatButton(
            tr(c, 'openSettings'),
            onTap: () async {
              await widget.library.openSettings();
              if (mounted) await _reload();
            },
          ),
          const SizedBox(height: 10),
          QChatButton(
            tr(c, 'fromFiles'),
            secondary: true,
            onTap: _browseFiles,
          ),
        ],
      ),
    ),
  );

  Widget _albumPanel(BuildContext c) {
    final top = MediaQuery.paddingOf(c).top + _kBarHeight;
    final curve = CurvedAnimation(parent: _panel, curve: Curves.easeOutCubic);
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => unawaited(_closeAlbums()),
        child: Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: EdgeInsets.only(top: top),
            child: FadeTransition(
              opacity: curve,
              child: SlideTransition(
                position:
                    Tween(
                      begin: const Offset(0, -.03),
                      end: Offset.zero,
                    ).animate(curve),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {},
                  child: _Scrim(
                    fromTop: true,
                    colors: const [Color(0xf20d0d0d), Color(0xf20d0d0d)],
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.sizeOf(c).height * .62,
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: _albums.length,
                        separatorBuilder: (_, _) => Container(
                          height: 0.5,
                          color: qchatLine(c),
                        ),
                        itemBuilder: (_, index) =>
                            _albumRow(c, _albums[index]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// The device names its synthetic "everything" album in English, so the
  /// picker speaks for it instead.
  String _albumName(BuildContext c, MediaAlbum album) =>
      album.isRecent ? tr(c, 'recentMedia') : album.name;

  Widget _albumRow(BuildContext c, MediaAlbum album) {
    final current = album.id == _album?.id;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        unawaited(_closeAlbums());
        unawaited(_selectAlbum(album));
      },
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            SizedBox(
              width: 52,
              height: 52,
              child: ColoredBox(
                color: qchatFill(c),
                child: FutureBuilder<Uint8List?>(
                  future: _cover(album),
                  builder: (_, snapshot) {
                    final bytes = snapshot.data;
                    if (bytes == null) return const SizedBox.shrink();
                    return Image.memory(bytes, fit: BoxFit.cover);
                  },
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                '${_albumName(c, album)}(${album.count})',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 17, color: ink(c)),
              ),
            ),
            if (current)
              const Padding(
                padding: EdgeInsets.only(left: 8),
                child: QChatIcon(
                  'check',
                  size: 22,
                  color: QChatColors.green,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _bottomBar(BuildContext c) => _Scrim(
    fromTop: false,
    edge: true,
    colors: const [Color(0xe6000000), Color(0xb3000000)],
    child: SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_access == MediaAccess.limited) _limitedBanner(c),
          SizedBox(
            height: _kBottomBarHeight,
            child: Row(
              children: [
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: _previewLabel(c),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: _sendButton(c),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _limitedBanner(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: _widen,
    child: Container(
      height: 44,
      color: qchatFill(c),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          Expanded(
            child: Text(
              tr(c, 'limitedBanner'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 14, color: ink(c)),
            ),
          ),
          Text(
            tr(c, 'widenAccess'),
            style: const TextStyle(fontSize: 14, color: QChatColors.green),
          ),
          const QChatIcon('chevron', size: 16, color: QChatColors.green),
        ],
      ),
    ),
  );

  Widget _previewLabel(BuildContext c) {
    final empty = _selected.isEmpty;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: empty ? null : () => _preview(_selected, 0),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Text(
          empty ? tr(c, 'preview') : '${tr(c, 'preview')} (${_selected.length})',
          style: TextStyle(
            fontSize: 16,
            color: empty ? qchatMuted(c) : ink(c),
          ),
        ),
      ),
    );
  }

  Widget _sendButton(BuildContext c) {
    final count = _selected.length;
    final base = widget.confirmLabel ?? tr(c, 'send');
    return _SendButton(
      label: count > 0 ? '$base ($count)' : base,
      enabled: count > 0,
      loading: _sending,
      onTap: _submit,
    );
  }
}

class _AssetTile extends StatelessWidget {
  const _AssetTile({
    super.key,
    required this.asset,
    required this.thumb,
    required this.order,
    required this.onToggle,
    required this.onPreview,
  });

  final MediaAsset asset;
  final Future<Uint8List?> thumb;

  /// The 0-based position in the selection, or -1 when the asset is not picked.
  final int order;

  final VoidCallback onToggle;
  final VoidCallback onPreview;

  @override
  Widget build(BuildContext c) => Stack(
    fit: StackFit.expand,
    children: [
      // The picture is the door to the preview; only the badge picks. Tapping a
      // thumbnail to tick it would make the grid feel like a checkbox list.
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPreview,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(
              color: qchatFill(c),
              child: FutureBuilder<Uint8List?>(
                future: thumb,
                builder: (_, snapshot) {
                  final bytes = snapshot.data;
                  if (bytes == null) return const SizedBox.shrink();
                  return Image.memory(
                    bytes,
                    fit: BoxFit.cover,
                    gaplessPlayback: true,
                  );
                },
              ),
            ),
            // A clip wears its length and nothing else: no play disc over the
            // frame, so the thumbnail stays as legible as a photo.
            if (asset.isVideo)
              Positioned(
                right: 5,
                bottom: 5,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: QChatColors.black38,
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    formatMediaDuration(asset.duration),
                    style: const TextStyle(
                      fontSize: 11,
                      color: QChatColors.white,
                    ),
                  ),
                ),
              ),
            // A picked frame dims, so the ticked set stands out at a glance,
            // and wears its place in the pick at the top left.
            if (order >= 0) ...[
              const Positioned.fill(
                child: ColoredBox(color: Color(0x59000000)),
              ),
              Positioned(
                left: 6,
                top: 2,
                child: Text(
                  '${order + 1}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: QChatColors.white,
                    shadows: [
                      Shadow(color: QChatColors.black38, blurRadius: 4),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      Positioned(
        top: 0,
        right: 0,
        child: GestureDetector(
          key: ValueKey('pick_${asset.id}'),
          behavior: HitTestBehavior.opaque,
          onTap: onToggle,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: _SelectionBadge(order: order),
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _SelectionBadge extends StatelessWidget {
  const _SelectionBadge({required this.order});

  final int order;

  @override
  Widget build(BuildContext c) {
    final selected = order >= 0;
    return Container(
      width: _kBadgeSize,
      height: _kBadgeSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? QChatColors.green : QChatColors.transparent,
        border: selected ? null : Border.all(color: QChatColors.white, width: 2),
      ),
      child: selected
          ? const QChatIcon('check', size: 15, color: QChatColors.white)
          : null,
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    super.key,
    required this.label,
    required this.enabled,
    required this.loading,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    enabled: enabled,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: enabled && !loading ? onTap : null,
      child: Container(
        height: 32,
        constraints: const BoxConstraints(minWidth: 60),
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: enabled ? QChatColors.green : const Color(0xff2b2b2b),
          borderRadius: BorderRadius.circular(5),
        ),
        child: loading
            ? const QChatLoading(size: 15, color: QChatColors.white)
            : Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: enabled ? QChatColors.white : qchatMuted(c),
                ),
              ),
      ),
    ),
  );
}

class _MediaPreviewPage extends StatefulWidget {
  const _MediaPreviewPage({
    required this.library,
    required this.assets,
    required this.index,
    required this.selection,
    required this.maxAssets,
    required this.onSubmit,
    required this.onSelectionChanged,
    this.confirmLabel,
  });

  final MediaLibrary library;
  final List<MediaAsset> assets;
  final int index;

  /// The sheet's live selection, so a tick here is the same tick there.
  final List<MediaAsset> selection;
  final int maxAssets;
  final String? confirmLabel;
  final Future<void> Function() onSubmit;
  final VoidCallback onSelectionChanged;

  @override
  State<_MediaPreviewPage> createState() => _MediaPreviewPageState();
}

class _MediaPreviewPageState extends State<_MediaPreviewPage> {
  late final _controller = PageController(initialPage: widget.index);
  late var _index = widget.index;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggleCurrent() {
    final asset = widget.assets[_index];
    final index = widget.selection.indexOf(asset);
    if (index >= 0) {
      widget.selection.removeAt(index);
    } else {
      if (widget.selection.length >= widget.maxAssets) {
        showQChatToast(
          context,
          '${tr(context, 'selectionLimit')} ${widget.maxAssets}',
        );
        return;
      }
      widget.selection.add(asset);
    }
    widget.onSelectionChanged();
    setState(() {});
  }

  Future<void> _send() async {
    Navigator.of(context).pop();
    await widget.onSubmit();
  }

  @override
  Widget build(BuildContext c) => ColoredBox(
    color: QChatColors.black,
    child: Stack(
      children: [
        Positioned.fill(
          child: PageView.builder(
            controller: _controller,
            onPageChanged: (value) => setState(() => _index = value),
            itemCount: widget.assets.length,
            itemBuilder: (_, index) => _PreviewAsset(
              library: widget.library,
              asset: widget.assets[index],
            ),
          ),
        ),
        Positioned(left: 0, right: 0, top: 0, child: _topBar(c)),
        Positioned(left: 0, right: 0, bottom: 0, child: _bottomBar(c)),
      ],
    ),
  );

  Widget _topBar(BuildContext c) {
    final top = MediaQuery.paddingOf(c).top;
    return _Scrim(
      fromTop: true,
      child: Padding(
        padding: EdgeInsets.only(top: top),
        child: SizedBox(
          height: _kPreviewBarHeight,
          child: Stack(
            children: [
              Positioned(
                left: 4,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => Navigator.of(c).pop(),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: RotatedBox(
                        quarterTurns: 2,
                        child: const QChatIcon(
                          'chevron',
                          size: 22,
                          color: QChatColors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                right: 16,
                top: 0,
                bottom: 0,
                child: Center(child: _checkButton()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _checkButton() {
    final selected = widget.selection.contains(widget.assets[_index]);
    return GestureDetector(
      key: const ValueKey('previewToggle'),
      behavior: HitTestBehavior.opaque,
      onTap: _toggleCurrent,
      child: Container(
        width: 26,
        height: 26,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? QChatColors.green : QChatColors.transparent,
          border: Border.all(color: QChatColors.white, width: 1.5),
        ),
        child: selected
            ? const QChatIcon('check', size: 15, color: QChatColors.white)
            : null,
      ),
    );
  }

  Widget _bottomBar(BuildContext c) {
    final count = widget.selection.length;
    final base = widget.confirmLabel ?? tr(c, 'send');
    return _Scrim(
      fromTop: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(c).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.selection.isNotEmpty) _strip(),
            SizedBox(
              height: _kBottomBarHeight,
              child: Row(
                children: [
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.only(right: 16),
                    child: _SendButton(
                      key: const ValueKey('previewSend'),
                      label: count > 0 ? '$base ($count)' : base,
                      enabled: count > 0,
                      loading: false,
                      onTap: _send,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The picked items, in the order they were picked. The one on screen wears
  /// the green frame; tapping another jumps to it.
  Widget _strip() => SizedBox(
    height: 76,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      itemCount: widget.selection.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (_, i) {
        final asset = widget.selection[i];
        final page = widget.assets.indexOf(asset);
        final current = page == _index;
        return GestureDetector(
          key: ValueKey('strip_${asset.id}'),
          behavior: HitTestBehavior.opaque,
          onTap: page < 0 ? null : () => _controller.jumpToPage(page),
          child: Container(
            width: 52,
            height: 52,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: QChatColors.darkFill,
              border: Border.all(
                color: current ? QChatColors.green : QChatColors.transparent,
                width: 2,
              ),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                FutureBuilder<Uint8List?>(
                  future: widget.library.thumbnail(asset, size: 160),
                  builder: (_, snapshot) {
                    final bytes = snapshot.data;
                    if (bytes == null) return const SizedBox.shrink();
                    return Image.memory(bytes, fit: BoxFit.cover);
                  },
                ),
                if (asset.isVideo)
                  Positioned(
                    left: 2,
                    bottom: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 3,
                        vertical: 0.5,
                      ),
                      decoration: BoxDecoration(
                        color: QChatColors.black38,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: Text(
                        formatMediaDuration(asset.duration),
                        style: const TextStyle(
                          fontSize: 9,
                          color: QChatColors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class _PreviewAsset extends StatefulWidget {
  const _PreviewAsset({required this.library, required this.asset});

  final MediaLibrary library;
  final MediaAsset asset;

  @override
  State<_PreviewAsset> createState() => _PreviewAssetState();
}

class _PreviewAssetState extends State<_PreviewAsset> {
  late final _thumb = widget.library.thumbnail(widget.asset, size: 1600);
  VideoPlayerController? _video;
  var _starting = false;
  var _failed = false;

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    if (_starting) return;
    setState(() => _starting = true);
    try {
      final file = await widget.library.file(widget.asset);
      final player = previewVideoController(file.path);
      await player.initialize();
      if (!mounted) {
        await player.dispose();
        return;
      }
      setState(() => _video = player);
      await player.play();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext c) {
    final player = _video;
    if (player != null) {
      return ValueListenableBuilder<VideoPlayerValue>(
        valueListenable: player,
        // The transport floats over the frames, the way a player does: the
        // picture keeps the whole screen and the controls fade in on top of it.
        builder: (_, value, _) => Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () =>
                    value.isPlaying ? player.pause() : player.play(),
                child: Center(
                  child: AspectRatio(
                    aspectRatio: value.aspectRatio,
                    child: VideoPlayer(player),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _VideoControls(player: player, value: value),
            ),
          ],
        ),
      );
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.asset.isVideo ? _start : null,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              maxScale: 4,
              child: Center(
                child: FutureBuilder<Uint8List?>(
                  future: _thumb,
                  builder: (_, snapshot) {
                    final bytes = snapshot.data;
                    if (bytes == null) return const SizedBox.shrink();
                    return Image.memory(bytes, fit: BoxFit.contain);
                  },
                ),
              ),
            ),
          ),
          if (widget.asset.isVideo)
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: QChatColors.black38,
              ),
              child: _starting
                  ? const QChatLoading(size: 20, color: QChatColors.white)
                  : _failed
                  ? const QChatIcon(
                      'videoCall',
                      size: 26,
                      color: QChatColors.white,
                    )
                  : const QChatIcon(
                      'play',
                      size: 26,
                      color: QChatColors.white,
                    ),
            ),
        ],
      ),
    );
  }
}

/// The transport bar under a playing clip: a large play triangle, the elapsed
/// time over a scrubbable line, and the playback speed on the right. It sits
/// below the picture on black, the way the reference puts it, rather than
/// floating over the frames.
class _VideoControls extends StatefulWidget {
  const _VideoControls({required this.player, required this.value});

  final VideoPlayerController player;
  final VideoPlayerValue value;

  @override
  State<_VideoControls> createState() => _VideoControlsState();
}

class _VideoControlsState extends State<_VideoControls> {
  /// Where the finger is while dragging, in milliseconds; null when idle.
  double? _drag;

  static const _speeds = [1.0, 1.5, 2.0];

  void _toggle() {
    final value = widget.value;
    if (value.isPlaying) {
      widget.player.pause();
    } else {
      if (value.position >= value.duration) {
        widget.player.seekTo(Duration.zero);
      }
      widget.player.play();
    }
  }

  Future<void> _cycleSpeed() async {
    final current = widget.player.value.playbackSpeed;
    final next = _speeds.firstWhere(
      (speed) => speed > current + .01,
      orElse: () => _speeds.first,
    );
    await widget.player.setPlaybackSpeed(next);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext c) {
    final value = widget.value;
    final total = value.duration.inMilliseconds.toDouble();
    final span = total <= 0 ? 1.0 : total;
    final position = _drag ?? value.position.inMilliseconds.toDouble();
    final fraction = (position / span).clamp(0.0, 1.0);
    final speed = value.playbackSpeed;
    return _Scrim(
      fromTop: false,
      // The clock and the line need a scrim to stay legible over a bright frame.
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 28, 12, 12),
        child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _toggle,
            child: Padding(
              padding: const EdgeInsets.only(right: 10, top: 4, bottom: 4),
              child: QChatIcon(
                value.isPlaying ? 'pause' : 'play',
                size: 30,
                color: QChatColors.white,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${formatMediaClock(Duration(milliseconds: position.round()))}'
                  ' / ${formatMediaClock(value.duration)}',
                  style: const TextStyle(
                    fontSize: 15,
                    color: QChatColors.white,
                  ),
                ),
                const SizedBox(height: 8),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;
                    void track(Offset local) {
                      final dx = local.dx.clamp(0.0, width);
                      setState(() => _drag = dx / width * span);
                    }

                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTapDown: (details) => track(details.localPosition),
                      onTapUp: (_) => _seekTo(_drag),
                      onHorizontalDragStart: (details) =>
                          track(details.localPosition),
                      onHorizontalDragUpdate: (details) =>
                          track(details.localPosition),
                      onHorizontalDragEnd: (_) => _seekTo(_drag),
                      child: SizedBox(
                        height: 20,
                        child: Center(
                          child: Stack(
                            alignment: Alignment.centerLeft,
                            children: [
                              Container(
                                height: 3,
                                decoration: const BoxDecoration(
                                  color: Color(0x66ffffff),
                                ),
                              ),
                              FractionallySizedBox(
                                widthFactor: fraction,
                                child: Container(
                                  height: 3,
                                  decoration: const BoxDecoration(
                                    color: QChatColors.white,
                                  ),
                                ),
                              ),
                              Align(
                                alignment: Alignment(fraction * 2 - 1, 0),
                                child: Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: QChatColors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _cycleSpeed,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
              child: Text(
                speed == 1 ? tr(c, 'speed') : '${speed}x',
                style: const TextStyle(
                  fontSize: 15,
                  color: QChatColors.white,
                ),
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }

  void _seekTo(double? milliseconds) {
    final target = milliseconds;
    setState(() => _drag = null);
    if (target == null) return;
    widget.player.seekTo(Duration(milliseconds: target.round()));
  }
}

/// `m:ss`, the way a chat shows a clip's length.
String formatMediaDuration(Duration duration) {
  final minutes = duration.inMinutes;
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

/// `mm:ss`, the way a player shows its clock.
String formatMediaClock(Duration duration) {
  final minutes = duration.inMinutes.toString().padLeft(2, '0');
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

/// A translucent pane. It fades the picture to black under the chrome, so the
/// controls stay readable while the photo still shows through, and it never
/// turns into a bar that cuts the picture short.
///
/// It is deliberately a plain gradient rather than a [BackdropFilter]: the
/// backdrop blur stretched the grid behind the bars on device (Impeller samples
/// a raster-cached scrollable at the wrong scale), so the scrim stays honest.
class _Scrim extends StatelessWidget {
  const _Scrim({
    required this.child,
    required this.fromTop,
    this.colors,
    this.edge = false,
  });

  final Widget child;

  /// Whether the tint is strongest at the top edge (a top bar) or at the
  /// bottom one (a bottom bar).
  final bool fromTop;

  /// Overrides the fade; a single repeated colour makes a steadier sheet for
  /// the album list, which needs to be readable over busy thumbnails.
  final List<Color>? colors;

  /// Draws a hairline on the inner edge, so a bar that sits on a dark page
  /// still has a visible boundary.
  final bool edge;

  @override
  Widget build(BuildContext c) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: fromTop ? Alignment.topCenter : Alignment.bottomCenter,
        end: fromTop ? Alignment.bottomCenter : Alignment.topCenter,
        colors: colors ?? const [Color(0xcc000000), Color(0x00000000)],
      ),
      border: edge
          ? Border(
              bottom: fromTop
                  ? const BorderSide(color: Color(0x1affffff), width: 0.5)
                  : BorderSide.none,
              top: fromTop
                  ? BorderSide.none
                  : const BorderSide(color: Color(0x1affffff), width: 0.5),
            )
          : null,
    ),
    child: child,
  );
}
