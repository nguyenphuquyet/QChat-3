import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:video_player/video_player.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'preview_video_web.dart'
    if (dart.library.io) 'preview_video_native.dart';

/// Files stay local until the user confirms sending.
Future<bool> previewAttachment(
  BuildContext context,
  PlatformFile file,
  Uint8List bytes,
  String mime,
) async =>
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => AttachmentPreview(file: file, bytes: bytes, mime: mime),
        fullscreenDialog: true,
      ),
    ) ??
    false;

class AttachmentPreview extends StatefulWidget {
  const AttachmentPreview({
    super.key,
    required this.file,
    required this.bytes,
    required this.mime,
  });
  final PlatformFile file;
  final Uint8List bytes;
  final String mime;

  @override
  State<AttachmentPreview> createState() => _AttachmentPreviewState();
}

class _AttachmentPreviewState extends State<AttachmentPreview> {
  VideoPlayerController? video;
  bool videoFailed = false;

  @override
  void initState() {
    super.initState();
    if (widget.mime.startsWith('video/')) initializeVideo();
  }

  Future<void> initializeVideo() async {
    try {
      final controller = previewVideoController(widget.file.xFile.path);
      video = controller;
      await controller.initialize();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => videoFailed = true);
    }
  }

  @override
  void dispose() {
    video?.dispose();
    super.dispose();
  }

  Widget content(BuildContext c) {
    if (widget.mime.startsWith('image/')) {
      return InteractiveViewer(
        child: Center(
          child: Image.memory(
            widget.bytes,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) =>
                QChatEmptyState(tr(c, 'previewUnavailable'), icon: 'file'),
          ),
        ),
      );
    }
    if (widget.mime.startsWith('video/')) {
      if (videoFailed) {
        return QChatEmptyState(tr(c, 'videoPlaybackError'), icon: 'file');
      }
      final controller = video;
      if (controller == null || !controller.value.isInitialized) {
        return const QChatLoading();
      }
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Flexible(
            child: AspectRatio(
              aspectRatio: controller.value.aspectRatio,
              child: VideoPlayer(controller),
            ),
          ),
          VideoProgressIndicator(controller, allowScrubbing: true),
          ValueListenableBuilder<VideoPlayerValue>(
            valueListenable: controller,
            builder: (c, value, _) => QChatButton(
              tr(c, value.isPlaying ? 'pause' : 'play'),
              onTap: () =>
                  value.isPlaying ? controller.pause() : controller.play(),
            ),
          ),
        ],
      );
    }
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const QChatIcon('file', size: 64),
          const SizedBox(height: 16),
          Text(widget.file.extension?.toUpperCase() ?? tr(c, 'file')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'attachmentPreview'),
    leading: QChatIconButton(
      'back',
      label: tr(c, 'cancel'),
      onTap: () => Navigator.pop(c, false),
    ),
    child: SafeArea(
      top: false,
      child: Column(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: content(c),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  widget.file.name,
                  textAlign: TextAlign.center,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Text(
                  '${(widget.bytes.length / 1024).toStringAsFixed(1)} KB',
                  style: const TextStyle(color: QChatColors.muted),
                ),
                const SizedBox(height: 16),
                QChatButton(tr(c, 'send'), onTap: () => Navigator.pop(c, true)),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
