import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../app/providers.dart';
import '../design_system/components.dart';
import '../network/cached_video.dart';

/// A muted, looping video that fills its box like a photo.
///
/// Red-packet covers use it for live photos and short clips, which arrive as
/// ordinary media ids. The picture is scaled to cover the box, exactly like
/// [MediaImage] does for stills, so a cover never shows a letterboxed frame.
class MediaVideo extends ConsumerStatefulWidget {
  const MediaVideo({
    super.key,
    required this.id,
    this.fit = BoxFit.cover,
    this.loop = true,
    this.muted = true,
    this.placeholder,
  });

  final String id;
  final BoxFit fit;
  final bool loop, muted;

  /// Colour shown while the clip loads, so a cover can keep its own palette
  /// instead of flashing a neutral box.
  final Color? placeholder;

  @override
  ConsumerState<MediaVideo> createState() => _MediaVideoState();
}

class _MediaVideoState extends ConsumerState<MediaVideo> {
  CachedVideo? _video;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(covariant MediaVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      _video?.dispose();
      _video = null;
      _start();
    }
  }

  Future<void> _start() async {
    CachedVideo? source;
    try {
      source = await CachedVideo.load(ref.read(clientProvider), widget.id);
      final controller = source.controller;
      await controller.initialize();
      await controller.setLooping(widget.loop);
      await controller.setVolume(widget.muted ? 0 : 1);
      await controller.play();
      if (!mounted) {
        await source.dispose();
        return;
      }
      setState(() => _video = source);
    } catch (_) {
      await source?.dispose();
      // The cover keeps its colour underneath, so a failed clip simply leaves
      // the design's background showing instead of an error box.
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final video = _video;
    if (video == null) {
      return ColoredBox(
        color:
            widget.placeholder ??
            (qchatDark(context)
                ? const Color(0xff2a2a2a)
                : const Color(0xffededed)),
      );
    }
    final size = video.controller.value.size;
    return ClipRect(
      child: FittedBox(
        fit: widget.fit,
        clipBehavior: Clip.hardEdge,
        child: SizedBox(
          width: size.width,
          height: size.height,
          child: VideoPlayer(video.controller),
        ),
      ),
    );
  }
}
