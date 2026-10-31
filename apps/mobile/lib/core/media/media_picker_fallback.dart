import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';
import '../../features/chats/preview_video_web.dart'
    if (dart.library.io) '../../features/chats/preview_video_native.dart';
import '../design_system/components.dart';
import '../localization/strings.dart';
import 'media_fit.dart';

Future<List<XFile>> pickDeviceMedia(
  BuildContext context, {
  required bool imagesOnly,
  required int maxAssets,
  String? confirmLabel,
  MediaFit? fit,
}) async {
  final files = await Navigator.of(context).push<List<XFile>>(
    PageRouteBuilder(
      pageBuilder: (_, _, _) => LocalMediaPicker(
        imagesOnly: imagesOnly,
        maxAssets: maxAssets,
        confirmLabel: confirmLabel,
      ),
      transitionDuration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 300),
      transitionsBuilder: (_, animation, _, child) => SlideTransition(
        position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
          CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        ),
        child: child,
      ),
    ),
  ) ?? [];
  if (fit == null) return files;
  return [for (final file in files) await fitImageFile(file, fit)];
}

class LocalMediaPicker extends StatefulWidget {
  const LocalMediaPicker({
    super.key,
    required this.imagesOnly,
    required this.maxAssets,
    this.confirmLabel,
  });
  final bool imagesOnly;
  final int maxAssets;
  final String? confirmLabel;
  @override
  State<LocalMediaPicker> createState() => _LocalMediaPickerState();
}

class _LocalMediaPickerState extends State<LocalMediaPicker> {
  final files = <XFile>[];
  final selected = <XFile>[];
  bool busy = false;
  String? error;

  Future<void> browse() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final picked = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          'jpg',
          'jpeg',
          'png',
          'gif',
          'webp',
          if (!widget.imagesOnly) ...['mp4', 'mov', 'webm'],
        ],
      );
      if (!mounted) return;
      setState(() {
        for (final file in picked) {
          final x = file.xFile;
          if (files.any((f) => f.path == x.path)) continue;
          files.add(x);
          if (selected.length < widget.maxAssets) selected.add(x);
        }
      });
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'mediaUnavailable'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void toggle(XFile file) => setState(() {
    if (selected.contains(file)) {
      selected.remove(file);
    } else if (selected.length < widget.maxAssets) {
      selected.add(file);
    } else {
      error = '${tr(context, 'selectionLimit')} ${widget.maxAssets}';
    }
  });

  Future<void> preview(int index, List<XFile> items) async {
    final controller = PageController(initialPage: index);
    await Navigator.of(context).push<void>(
      PageRouteBuilder(
        opaque: true,
        pageBuilder: (c, _, _) => _PreviewPage(
          controller: controller,
          items: items,
          title: tr(c, 'attachmentPreview'),
        ),
        transitionDuration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 240),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
    controller.dispose();
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'chooseMedia'),
    leading: QChatIconButton(
      'close',
      label: tr(c, 'close'),
      onTap: () => Navigator.pop(c),
    ),
    trailing: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: busy ? null : browse,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Text(
          tr(c, 'fromFiles'),
          style: const TextStyle(fontSize: 15, color: QChatColors.green),
        ),
      ),
    ),
    bottom: Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: selected.isEmpty
                ? null
                : () => preview(0, List.of(selected)),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 12,
              ),
              child: Text(
                tr(c, 'attachmentPreview'),
                style: TextStyle(
                  fontSize: 15,
                  color: selected.isEmpty
                      ? qchatMuted(c)
                      : QChatColors.green,
                ),
              ),
            ),
          ),
          const Spacer(),
          QChatButton(
            '${widget.confirmLabel ?? tr(c, 'select')} (${selected.length})',
            loading: busy,
            onTap: selected.isEmpty || busy
                ? null
                : () => Navigator.pop(c, List<XFile>.of(selected)),
          ),
        ],
      ),
    ),
    child: Column(
      children: [
        if (error != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              error!,
              style: const TextStyle(
                fontSize: 13,
                color: QChatColors.danger,
              ),
            ),
          ),
        Expanded(
          child: files.isEmpty
              ? Center(
                  child: QChatButton(
                    tr(c, 'chooseMedia'),
                    secondary: true,
                    loading: busy,
                    onTap: busy ? null : browse,
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(2),
                  itemCount: files.length,
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        crossAxisSpacing: 2,
                        mainAxisSpacing: 2,
                      ),
                  itemBuilder: (_, i) => GestureDetector(
                    onTap: () => preview(i, files),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        _LocalMedia(file: files[i]),
                        Positioned(
                          top: 3,
                          right: 3,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => toggle(files[i]),
                            child: _SelectionBadge(
                              index: selected.indexOf(files[i]),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
      ],
    ),
  );
}

class _SelectionBadge extends StatelessWidget {
  const _SelectionBadge({required this.index});
  final int index;
  @override
  Widget build(BuildContext context) {
    final selected = index >= 0;
    return Container(
      width: 26,
      height: 26,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? QChatColors.green : const Color(0x66000000),
        border: Border.all(color: QChatColors.white, width: 1.4),
      ),
      child: selected
          ? Text(
              '${index + 1}',
              style: const TextStyle(
                color: QChatColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            )
          : null,
    );
  }
}

class _PreviewPage extends StatelessWidget {
  const _PreviewPage({
    required this.controller,
    required this.items,
    required this.title,
  });
  final PageController controller;
  final List<XFile> items;
  final String title;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: QChatColors.black,
    child: Stack(
      children: [
        Positioned.fill(
          child: PageView.builder(
            controller: controller,
            itemCount: items.length,
            itemBuilder: (_, i) => _LocalMedia(file: items[i], preview: true),
          ),
        ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: Row(
              children: [
                QChatIconButton(
                  'close',
                  label: tr(context, 'close'),
                  color: QChatColors.white,
                  onTap: () => Navigator.pop(context),
                ),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: QChatColors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _LocalMedia extends StatefulWidget {
  const _LocalMedia({required this.file, this.preview = false});
  final XFile file;
  final bool preview;
  @override
  State<_LocalMedia> createState() => _LocalMediaState();
}

class _LocalMediaState extends State<_LocalMedia> {
  VideoPlayerController? video;
  Future<Uint8List>? bytes;
  bool failed = false;
  @override
  void initState() {
    super.initState();
    if (RegExp(
      r'\.(mp4|mov|webm)$',
      caseSensitive: false,
    ).hasMatch(widget.file.name)) {
      final player = previewVideoController(widget.file.path);
      video = player;
      player
          .initialize()
          .then((_) {
            if (mounted) setState(() {});
          })
          .catchError((_) {
            if (mounted) setState(() => failed = true);
          });
    } else {
      bytes = widget.file.readAsBytes();
    }
  }

  @override
  void dispose() {
    video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    final player = video;
    if (player != null) {
      if (failed) {
        return Center(
          child: QChatIcon(
            'videoCall',
            color: widget.preview ? QChatColors.white70 : qchatMuted(c),
            size: 32,
          ),
        );
      }
      return ValueListenableBuilder<VideoPlayerValue>(
        valueListenable: player,
        builder: (_, value, _) => Stack(
          alignment: Alignment.center,
          children: [
            if (value.isInitialized)
              Center(
                child: AspectRatio(
                  aspectRatio: value.aspectRatio,
                  child: VideoPlayer(player),
                ),
              ),
            if (widget.preview)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () =>
                    value.isPlaying ? player.pause() : player.play(),
                child: Container(
                  width: 56,
                  height: 56,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0x55000000),
                  ),
                  child: Center(
                    child: QChatIcon(
                      value.isPlaying ? 'pause' : 'play',
                      color: QChatColors.white,
                      size: 26,
                    ),
                  ),
                ),
              ),
            if (value.isInitialized)
              Positioned(
                bottom: 5,
                right: 5,
                child: Text(
                  '${value.duration.inMinutes}:${value.duration.inSeconds.remainder(60).toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: QChatColors.white,
                    shadows: [Shadow(blurRadius: 3)],
                  ),
                ),
              ),
          ],
        ),
      );
    }
    return FutureBuilder<Uint8List>(
      future: bytes,
      builder: (_, snapshot) {
        if (!snapshot.hasData) {
          return Center(
            child: QChatIcon(
              'image',
              color: widget.preview ? QChatColors.white70 : qchatMuted(c),
              size: 30,
            ),
          );
        }
        final image = Image.memory(
          snapshot.data!,
          fit: widget.preview ? BoxFit.contain : BoxFit.cover,
          errorBuilder: (_, _, _) => Center(
            child: QChatIcon(
              'file',
              color: widget.preview ? QChatColors.white70 : qchatMuted(c),
              size: 30,
            ),
          ),
        );
        return widget.preview
            ? InteractiveViewer(child: Center(child: image))
            : image;
      },
    );
  }
}
