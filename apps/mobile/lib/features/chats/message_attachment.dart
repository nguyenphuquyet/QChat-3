import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:video_player/video_player.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import 'media_screen.dart';

class MessageAttachment extends ConsumerStatefulWidget {
  const MessageAttachment({
    super.key,
    required this.id,
    required this.kind,
    required this.name,
    this.sourceTag,
  });
  final String id, kind, name;
  final String? sourceTag;
  @override
  ConsumerState<MessageAttachment> createState() => _MessageAttachmentState();
}

class _MessageAttachmentState extends ConsumerState<MessageAttachment> {
  VideoPlayerController? video;
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
    } catch (_) {}
  }

  @override
  void dispose() {
    video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    if (widget.kind == 'IMAGE') {
      return Hero(
        tag: widget.sourceTag ?? MediaScreen.heroTag(widget.id),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 210, maxHeight: 260),
            child: MediaImage(id: widget.id, fit: BoxFit.contain),
          ),
        ),
      );
    }
    if (widget.kind == 'VIDEO') {
      final controller = video;
      final ready = controller != null && controller.value.isInitialized;
      final ratio = ready ? controller.value.aspectRatio : 9 / 16;
      final width = ratio < 1 ? (260 * ratio).clamp(120.0, 210.0) : 210.0;
      final height = (width / ratio).clamp(80.0, 300.0);
      final duration = ready ? controller.value.duration : null;
      return Hero(
        tag: widget.sourceTag ?? MediaScreen.heroTag(widget.id),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: SizedBox(
            width: width,
            height: height,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Positioned.fill(child: ColoredBox(color: Colors.black87)),
                if (controller != null && controller.value.isInitialized)
                  AspectRatio(
                    aspectRatio: controller.value.aspectRatio,
                    child: VideoPlayer(controller),
                  ),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0x55000000),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white70, width: 1.5),
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 40,
                  ),
                ),
                if (duration != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(8, 24, 8, 6),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black38],
                        ),
                      ),
                      child: Text(
                        '${duration.inMinutes}:${duration.inSeconds.remainder(60).toString().padLeft(2, '0')}',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          decoration: TextDecoration.none,
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
