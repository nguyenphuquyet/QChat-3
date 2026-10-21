import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:video_player/video_player.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';

class MessageAttachment extends ConsumerStatefulWidget {
  const MessageAttachment({
    super.key,
    required this.id,
    required this.kind,
    required this.name,
  });
  final String id, kind, name;
  @override
  ConsumerState<MessageAttachment> createState() => _MessageAttachmentState();
}

class _MessageAttachmentState extends ConsumerState<MessageAttachment> {
  VideoPlayerController? video;
  bool failed = false;
  @override
  void initState() {
    super.initState();
    if (widget.kind == 'VIDEO') loadVideo();
  }

  Future<void> loadVideo() async {
    try {
      final access = await ref
          .read(clientProvider)
          .get('/media/${widget.id}/access', cached: false);
      if (!mounted) return;
      final controller = VideoPlayerController.networkUrl(
        Uri.parse(access['url']),
      );
      video = controller;
      await controller.initialize();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => failed = true);
    }
  }

  @override
  void dispose() {
    video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    if (widget.kind == 'IMAGE') {
      return ClipRRect(
        borderRadius: BorderRadius.circular(5),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 210, maxHeight: 260),
          child: MediaImage(id: widget.id, fit: BoxFit.contain),
        ),
      );
    }
    if (widget.kind == 'VIDEO') {
      final controller = video;
      return ClipRRect(
        borderRadius: BorderRadius.circular(5),
        child: SizedBox(
          width: 210,
          height: 160,
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Positioned.fill(child: ColoredBox(color: Colors.black87)),
              if (controller != null && controller.value.isInitialized)
                AspectRatio(
                  aspectRatio: controller.value.aspectRatio,
                  child: VideoPlayer(controller),
                ),
              if (!failed &&
                  (controller == null || !controller.value.isInitialized))
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                const Icon(
                  Icons.play_circle_fill,
                  color: Colors.white,
                  size: 48,
                ),
            ],
          ),
        ),
      );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 210),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          QChatIcon(widget.kind == 'AUDIO' ? 'music' : 'file', size: 36),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              widget.name,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
