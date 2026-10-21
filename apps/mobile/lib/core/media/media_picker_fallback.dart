import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';
import '../../features/chats/preview_video_web.dart'
    if (dart.library.io) '../../features/chats/preview_video_native.dart';
import '../localization/strings.dart';

Future<List<XFile>> pickDeviceMedia(
  BuildContext context, {
  required bool imagesOnly,
  required int maxAssets,
  String? confirmLabel,
}) async =>
    await Navigator.of(context).push<List<XFile>>(
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
    ) ??
    [];

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
          if (!widget.imagesOnly) ...['mp4', 'mov'],
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
    final route = MaterialPageRoute<void>(
      builder: (c) => Theme(
        data: ThemeData.dark(),
        child: Scaffold(
          appBar: AppBar(title: Text(tr(c, 'attachmentPreview'))),
          backgroundColor: Colors.black,
          body: PageView.builder(
            controller: controller,
            itemCount: items.length,
            itemBuilder: (_, i) => _LocalMedia(file: items[i], preview: true),
          ),
        ),
      ),
    );
    await Navigator.of(context).push(route);
    await route.completed;
    controller.dispose();
  }

  @override
  Widget build(BuildContext c) => Theme(
    data: ThemeData.dark().copyWith(
      scaffoldBackgroundColor: const Color(0xff191919),
    ),
    child: Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xff252525),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(c),
        ),
        centerTitle: true,
        title: TextButton.icon(
          onPressed: busy ? null : browse,
          icon: const Icon(Icons.expand_more, color: Colors.white),
          label: Text(
            tr(c, 'fromFiles'),
            style: const TextStyle(color: Colors.white),
          ),
        ),
      ),
      body: Column(
        children: [
          if (error != null)
            Padding(padding: const EdgeInsets.all(12), child: Text(error!)),
          Expanded(
            child: files.isEmpty
                ? Center(
                    child: TextButton.icon(
                      onPressed: busy ? null : browse,
                      icon: const Icon(Icons.photo_library_outlined),
                      label: busy
                          ? const SizedBox.square(
                              dimension: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(tr(c, 'chooseMedia')),
                    ),
                  )
                : GridView.builder(
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
                            top: 2,
                            right: 2,
                            child: IconButton(
                              onPressed: () => toggle(files[i]),
                              icon: selected.contains(files[i])
                                  ? CircleAvatar(
                                      radius: 13,
                                      backgroundColor: const Color(0xff07c160),
                                      child: Text(
                                        '${selected.indexOf(files[i]) + 1}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                        ),
                                      ),
                                    )
                                  : const Icon(
                                      Icons.radio_button_unchecked,
                                      color: Colors.white,
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
      bottomNavigationBar: ColoredBox(
        color: const Color(0xff252525),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                TextButton(
                  onPressed: selected.isEmpty
                      ? null
                      : () => preview(0, List.of(selected)),
                  child: Text(tr(c, 'attachmentPreview')),
                ),
                const Spacer(),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff07c160),
                  ),
                  onPressed: selected.isEmpty || busy
                      ? null
                      : () => Navigator.pop(c, List<XFile>.of(selected)),
                  child: Text(
                    '${widget.confirmLabel ?? tr(c, 'select')} (${selected.length})',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
      r'\.(mp4|mov)$',
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
      if (failed) return const Center(child: Icon(Icons.videocam_off_outlined));
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
              IconButton(
                icon: Icon(
                  value.isPlaying ? Icons.pause_circle : Icons.play_circle,
                  color: Colors.white,
                  size: 48,
                ),
                onPressed: () =>
                    value.isPlaying ? player.pause() : player.play(),
              ),
            if (value.isInitialized)
              Positioned(
                bottom: 5,
                right: 5,
                child: Text(
                  '${value.duration.inMinutes}:${value.duration.inSeconds.remainder(60).toString().padLeft(2, '0')}',
                  style: const TextStyle(
                    color: Colors.white,
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
          return const Center(child: Icon(Icons.image_outlined));
        }
        final image = Image.memory(
          snapshot.data!,
          fit: widget.preview ? BoxFit.contain : BoxFit.cover,
          errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined),
        );
        return widget.preview
            ? InteractiveViewer(child: Center(child: image))
            : image;
      },
    );
  }
}
