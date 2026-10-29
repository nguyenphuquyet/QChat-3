import 'dart:async';

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

const double _kBarHeight = 52;
const double _kBottomBarHeight = 58;
const double _kGridGap = 2;
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
    CupertinoPageRoute(
      fullscreenDialog: true,
      builder: (_) => MediaPickerSheet(
        library: library,
        imagesOnly: imagesOnly,
        maxAssets: maxAssets,
        confirmLabel: confirmLabel,
      ),
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

class _MediaPickerSheetState extends State<MediaPickerSheet> {
  final _scroll = ScrollController();
  final _thumbs = <String, Future<Uint8List?>>{};
  final _assets = <MediaAsset>[];
  final _selected = <MediaAsset>[];

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
    _scroll.dispose();
    super.dispose();
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
      CupertinoPageRoute(
        fullscreenDialog: true,
        builder: (_) => _MediaPreviewPage(
          library: widget.library,
          assets: List.of(items),
          index: index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dark = qchatDark(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: ColoredBox(
        color: qchatBackground(context),
        child: Stack(
          children: [
            Column(
              children: [
                _bar(context),
                Expanded(child: _body(context)),
                _bottomBar(context),
              ],
            ),
            if (_albumsOpen) _albumPanel(context),
          ],
        ),
      ),
    );
  }

  Widget _bar(BuildContext c) => ColoredBox(
    color: qchatSurface(c),
    child: SafeArea(
      bottom: false,
      child: SizedBox(
        height: _kBarHeight,
        child: Stack(
          children: [
            Positioned(
              left: 2,
              top: 2,
              child: QChatIconButton(
                'close',
                label: tr(c, 'close'),
                onTap: () => Navigator.of(c).pop(),
              ),
            ),
            Center(child: _albumPill(c)),
          ],
        ),
      ),
    ),
  );

  Widget _albumPill(BuildContext c) {
    final name = _album?.name ?? '';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _albums.length < 2
          ? null
          : () => setState(() => _albumsOpen = !_albumsOpen),
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 7, 10, 7),
        decoration: BoxDecoration(
          color: qchatFill(c),
          borderRadius: BorderRadius.circular(17),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 190),
              child: Text(
                name.isEmpty ? tr(c, 'recentMedia') : name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: ink(c),
                ),
              ),
            ),
            const SizedBox(width: 4),
            RotatedBox(
              quarterTurns: 1,
              child: QChatIcon('chevron', size: 18, color: ink(c)),
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
      padding: EdgeInsets.zero,
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
          onTap: () => _toggle(asset),
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
    final top = MediaQuery.paddingOf(c).top + _kBarHeight + 4;
    return Positioned.fill(
      child: ColoredBox(
        color: QChatColors.black38,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _albumsOpen = false),
          child: Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: EdgeInsets.only(top: top),
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 36),
                constraints: BoxConstraints(
                  maxWidth: 320,
                  maxHeight: MediaQuery.sizeOf(c).height * .6,
                ),
                decoration: BoxDecoration(
                  color: qchatSurface(c),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: ListView.builder(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  itemCount: _albums.length,
                  itemBuilder: (_, index) {
                    final album = _albums[index];
                    final current = album.id == _album?.id;
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        setState(() => _albumsOpen = false);
                        unawaited(_selectAlbum(album));
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                album.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 15, color: ink(c)),
                              ),
                            ),
                            Text(
                              '${album.count}',
                              style: TextStyle(
                                fontSize: 13,
                                color: qchatMuted(c),
                              ),
                            ),
                            if (current) ...[
                              const SizedBox(width: 8),
                              const QChatIcon(
                                'check',
                                size: 18,
                                color: QChatColors.green,
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bottomBar(BuildContext c) {
    final empty = _selected.isEmpty;
    final base = widget.confirmLabel ?? tr(c, 'send');
    return ColoredBox(
      color: qchatSurface(c),
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(c).bottom),
        child: SizedBox(
          height: _kBottomBarHeight,
          child: Row(
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: empty ? null : () => _preview(_selected, 0),
                child: Padding(
                  padding: const EdgeInsets.only(left: 14, right: 8),
                  child: Row(
                    children: [
                      Text(
                        tr(c, 'preview'),
                        style: TextStyle(
                          fontSize: 15,
                          color: empty ? qchatMuted(c) : ink(c),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _PreviewRing(
                        thumb: empty ? null : _thumb(_selected.first),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Center(
                  child: _access == MediaAccess.limited
                      ? GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _widen,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Text(
                              tr(c, 'allPhotos'),
                              style: TextStyle(fontSize: 15, color: ink(c)),
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 8, right: 12),
                child: QChatButton(
                  empty ? base : '$base(${_selected.length})',
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 9,
                  ),
                  loading: _sending,
                  onTap: empty || _sending ? null : _submit,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AssetTile extends StatelessWidget {
  const _AssetTile({
    super.key,
    required this.asset,
    required this.thumb,
    required this.order,
    required this.onTap,
    required this.onPreview,
  });

  final MediaAsset asset;
  final Future<Uint8List?> thumb;

  /// The 0-based position in the selection, or -1 when the asset is not picked.
  final int order;
  final VoidCallback onTap;
  final VoidCallback onPreview;

  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    onLongPress: onPreview,
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
        if (asset.isVideo)
          Positioned(
            left: 5,
            bottom: 4,
            child: Row(
              children: [
                const QChatIcon(
                  'play',
                  size: 12,
                  color: QChatColors.white,
                ),
                const SizedBox(width: 3),
                Text(
                  formatMediaDuration(asset.duration),
                  style: const TextStyle(
                    fontSize: 11,
                    color: QChatColors.white,
                    shadows: [Shadow(blurRadius: 3, color: Color(0x99000000))],
                  ),
                ),
              ],
            ),
          ),
        Positioned(top: 4, right: 4, child: _SelectionBadge(order: order)),
      ],
    ),
  );
}

class _SelectionBadge extends StatelessWidget {
  const _SelectionBadge({required this.order});

  final int order;

  @override
  Widget build(BuildContext c) {
    final selected = order >= 0;
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? QChatColors.green : QChatColors.black38,
        border: Border.all(color: QChatColors.white, width: 1.5),
      ),
      child: selected
          ? Text(
              '${order + 1}',
              style: const TextStyle(
                color: QChatColors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            )
          : null,
    );
  }
}

class _PreviewRing extends StatelessWidget {
  const _PreviewRing({this.thumb});

  final Future<Uint8List?>? thumb;

  @override
  Widget build(BuildContext c) => Container(
    width: 34,
    height: 34,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: qchatFill(c),
      border: Border.all(color: qchatLine(c)),
    ),
    child: thumb == null
        ? null
        : FutureBuilder<Uint8List?>(
            future: thumb,
            builder: (_, snapshot) {
              final bytes = snapshot.data;
              if (bytes == null) return const SizedBox.shrink();
              return Image.memory(bytes, fit: BoxFit.cover);
            },
          ),
  );
}

class _MediaPreviewPage extends StatefulWidget {
  const _MediaPreviewPage({
    required this.library,
    required this.assets,
    this.index = 0,
  });

  final MediaLibrary library;
  final List<MediaAsset> assets;
  final int index;

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
            itemBuilder: (_, index) =>
                _PreviewAsset(library: widget.library, asset: widget.assets[index]),
          ),
        ),
        SafeArea(
          bottom: false,
          child: Row(
            children: [
              QChatIconButton(
                'close',
                label: tr(c, 'close'),
                color: QChatColors.white,
                onTap: () => Navigator.of(c).pop(),
              ),
              const Spacer(),
              if (widget.assets.length > 1)
                Padding(
                  padding: const EdgeInsets.only(right: 18),
                  child: Text(
                    '${_index + 1}/${widget.assets.length}',
                    style: const TextStyle(
                      color: QChatColors.white,
                      fontSize: 15,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
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
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(
          () => player.value.isPlaying ? player.pause() : player.play(),
        ),
        child: Center(
          child: AspectRatio(
            aspectRatio: player.value.aspectRatio,
            child: VideoPlayer(player),
          ),
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

/// `m:ss`, the way a chat shows a clip's length.
String formatMediaDuration(Duration duration) {
  final minutes = duration.inMinutes;
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}
