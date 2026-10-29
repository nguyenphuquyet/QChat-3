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

const double _kBarHeight = 56;
const double _kBottomBarHeight = 64;
const double _kGridGap = 2;
const double _kBadgeSize = 26;
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
  final _covers = <String, Future<Uint8List?>>{};
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
      CupertinoPageRoute(
        fullscreenDialog: true,
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
    color: qchatBackground(c),
    child: SafeArea(
      bottom: false,
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
                  size: 26,
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
    final name = _album?.name ?? tr(c, 'recentMedia');
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _albums.length < 2
          ? null
          : () => setState(() => _albumsOpen = !_albumsOpen),
      child: Container(
        height: 44,
        padding: const EdgeInsets.only(left: 18, right: 6),
        decoration: BoxDecoration(
          color: qchatFill(c),
          borderRadius: BorderRadius.circular(22),
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
                  fontSize: 17,
                  fontWeight: FontWeight.w500,
                  color: ink(c),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: qchatDark(c)
                    ? const Color(0xff3d3d3d)
                    : const Color(0xffe3e3e3),
              ),
              child: AnimatedRotation(
                turns: _albumsOpen ? .5 : 0,
                duration: const Duration(milliseconds: 180),
                child: RotatedBox(
                  quarterTurns: 1,
                  child: QChatIcon('chevron', size: 18, color: ink(c)),
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
          count: _selected.length,
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
    final top = MediaQuery.paddingOf(c).top + _kBarHeight;
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => _albumsOpen = false),
        child: Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: EdgeInsets.only(top: top),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {},
              child: Container(
                width: double.infinity,
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(c).height * .62,
                ),
                color: qchatBackground(c),
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
    );
  }

  Widget _albumRow(BuildContext c, MediaAlbum album) {
    final current = album.id == _album?.id;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        setState(() => _albumsOpen = false);
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
                '${album.name}(${album.count})',
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

  Widget _bottomBar(BuildContext c) => ColoredBox(
    color: qchatBackground(c),
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
    required this.count,
    required this.onTap,
    required this.onPreview,
  });

  final MediaAsset asset;
  final Future<Uint8List?> thumb;

  /// The 0-based position in the selection, or -1 when the asset is not picked.
  final int order;

  /// How many assets are picked in total, so a single pick shows a check.
  final int count;
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
        if (asset.isVideo) ...[
          Center(
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: QChatColors.black38,
                border: Border.all(color: QChatColors.white, width: 1.5),
              ),
              child: const QChatIcon(
                'play',
                size: 20,
                color: QChatColors.white,
              ),
            ),
          ),
          Positioned(
            right: 5,
            bottom: 5,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
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
        ],
        Positioned(
          top: 4,
          right: 4,
          child: _SelectionBadge(order: order, count: count),
        ),
      ],
    ),
  );
}

class _SelectionBadge extends StatelessWidget {
  const _SelectionBadge({required this.order, required this.count});

  final int order;
  final int count;

  @override
  Widget build(BuildContext c) {
    final selected = order >= 0;
    // One pick is unambiguous, so it shows a tick; a set shows the order the
    // user tapped, so the send button's count has a visible cause.
    final single = selected && count <= 1;
    return Container(
      width: _kBadgeSize,
      height: _kBadgeSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? QChatColors.green : QChatColors.transparent,
        border: Border.all(color: QChatColors.white, width: 2),
      ),
      child: !selected
          ? null
          : single
          ? const QChatIcon('check', size: 15, color: QChatColors.white)
          : Text(
              '${order + 1}',
              style: const TextStyle(
                color: QChatColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
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
        height: 44,
        constraints: const BoxConstraints(minWidth: 92),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: enabled
              ? QChatColors.green
              : qchatDark(c)
              ? const Color(0xff2b2b2b)
              : const Color(0xfff2f2f2),
          borderRadius: BorderRadius.circular(6),
        ),
        child: loading
            ? const QChatLoading(size: 18, color: QChatColors.white)
            : Text(
                label,
                style: TextStyle(
                  fontSize: 16,
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
    child: Column(
      children: [
        _topBar(c),
        Expanded(
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
        _bottomBar(c),
      ],
    ),
  );

  Widget _topBar(BuildContext c) => ColoredBox(
    color: QChatColors.black,
    child: SafeArea(
      bottom: false,
      child: SizedBox(
        height: _kBarHeight,
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
                        size: 26,
                        color: QChatColors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Center(
              child: Text(
                '${_index + 1}/${widget.assets.length}',
                style: const TextStyle(
                  fontSize: 17,
                  color: QChatColors.white,
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

  Widget _checkButton() {
    final selected = widget.selection.contains(widget.assets[_index]);
    return GestureDetector(
      key: const ValueKey('previewToggle'),
      behavior: HitTestBehavior.opaque,
      onTap: _toggleCurrent,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? QChatColors.green : QChatColors.transparent,
          border: Border.all(color: QChatColors.white, width: 2),
        ),
        child: selected
            ? const QChatIcon('check', size: 18, color: QChatColors.white)
            : null,
      ),
    );
  }

  Widget _bottomBar(BuildContext c) {
    final count = widget.selection.length;
    final base = widget.confirmLabel ?? tr(c, 'send');
    return ColoredBox(
      color: QChatColors.black,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _kBottomBarHeight,
          child: Row(
            children: [
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16),
                    child: _CurrentThumb(
                      library: widget.library,
                      asset: widget.assets[_index],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Padding(
                    padding: const EdgeInsets.only(right: 16),
                    child: _SendButton(
                      key: const ValueKey('previewSend'),
                      label: count > 0 ? '$base ($count)' : base,
                      enabled: count > 0,
                      loading: false,
                      onTap: _send,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CurrentThumb extends StatelessWidget {
  const _CurrentThumb({required this.library, required this.asset});

  final MediaLibrary library;
  final MediaAsset asset;

  @override
  Widget build(BuildContext c) => Container(
    width: 48,
    height: 48,
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: QChatColors.darkFill,
      border: Border.all(color: QChatColors.green, width: 2),
    ),
    child: FutureBuilder<Uint8List?>(
      future: library.thumbnail(asset, size: 120),
      builder: (_, snapshot) {
        final bytes = snapshot.data;
        if (bytes == null) return const SizedBox.shrink();
        return Image.memory(bytes, fit: BoxFit.cover);
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
