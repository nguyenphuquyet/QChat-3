import 'dart:async';
import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';
import 'package:just_audio/just_audio.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/network/video_meta.dart';
import '../../core/network/cached_video.dart';
import '../../core/network/cached_audio.dart';
import '../../core/localization/strings.dart';
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

class _MessageAttachmentState extends ConsumerState<MessageAttachment>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? video;
  CachedVideo? cachedVideo;
  CachedAudio? cachedAudio;
  VideoMeta? meta;
  final AudioPlayer audio = AudioPlayer();
  bool audioLoading = false;
  bool audioPlaying = false;
  Duration? loadedAudioDuration;
  late final AnimationController speakerWave = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  @override
  void initState() {
    super.initState();
    meta =
        VideoMetaCache.fromMemory(widget.id) ??
        VideoMeta.fromJson(MediaCache.infoFromMemory(widget.id));
    if (widget.kind == 'VIDEO') loadVideo();
    if (widget.kind == 'IMAGE') loadImage();
    if (widget.kind == 'AUDIO') {
      audio.playerStateStream.listen((state) {
        if (!mounted) return;
        final active =
            state.playing && state.processingState != ProcessingState.completed;
        setState(() => audioPlaying = active);
        if (active) {
          if (!speakerWave.isAnimating) speakerWave.repeat();
        } else if (speakerWave.isAnimating) {
          speakerWave
            ..stop()
            ..value = 0;
        }
      });
    }
  }

  Future<void> loadImage() async {
    final client = ref.read(clientProvider);
    final details = await MediaCache.info(client, widget.id);
    if (mounted && details != null) {
      setState(() => meta = VideoMeta.fromJson(details));
    }
    await MediaCache.load(client, widget.id);
    if (mounted) {
      setState(
        () => meta =
            VideoMeta.fromJson(MediaCache.infoFromMemory(widget.id)) ?? meta,
      );
    }
  }

  Future<void> loadVideo() async {
    final client = ref.read(clientProvider);
    // Saved geometry lets the preview keep the real video shape immediately
    // on later opens, even before the player starts.
    final cached = await VideoMetaCache.load(client.local, widget.id);
    if (cached != null && mounted) setState(() => meta = cached);
    try {
      final source = await CachedVideo.load(client, widget.id);
      if (!mounted) {
        await source.dispose();
        return;
      }
      cachedVideo = source;
      final controller = source.controller;
      video = controller;
      setState(() => meta = VideoMetaCache.fromMemory(widget.id) ?? meta);
      await controller.initialize();
      if (!mounted) return;
      final value = controller.value;
      if (value.isInitialized) {
        final resolved = VideoMeta(
          width: value.size.width.round(),
          height: value.size.height.round(),
          duration: value.duration,
        );
        if (resolved.isValid) {
          VideoMetaCache.remember(widget.id, resolved, local: client.local);
          meta = resolved;
        }
      }
      setState(() {});
    } catch (_) {}
  }

  @override
  void dispose() {
    cachedVideo?.dispose();
    final audioSource = cachedAudio;
    if (audioSource == null) {
      audio.dispose();
    } else {
      // Close the player before deleting the cached temp file/blob.
      unawaited(audio.dispose().then((_) => audioSource.dispose()));
    }
    speakerWave.dispose();
    super.dispose();
  }

  int? get voiceSeconds {
    final seconds =
        int.tryParse(widget.name.trim()) ??
        loadedAudioDuration?.inSeconds ??
        meta?.duration?.inSeconds;
    return seconds?.clamp(1, 60).toInt();
  }

  Future<void> toggleAudio() async {
    if (audioLoading) return;
    try {
      if (audioPlaying) {
        await audio.pause();
        return;
      }
      if (audio.audioSource == null) {
        setState(() => audioLoading = true);
        // Reads the local cache first and only downloads the first time;
        // replays never touch the network again.
        final cached = await CachedAudio.load(
          ref.read(clientProvider),
          widget.id,
        );
        if (!mounted) {
          await cached.dispose();
          return;
        }
        cachedAudio = cached;
        await audio.setAudioSource(cached.source);
        loadedAudioDuration = audio.duration;
        if (mounted) setState(() {});
      }
      if (audio.processingState == ProcessingState.completed) {
        await audio.seek(Duration.zero);
      }
      await audio.play();
    } catch (_) {
      if (mounted) qchatSheet(context, [(tr(context, 'audioPlaybackError'), () {})]);
    } finally {
      if (mounted) setState(() => audioLoading = false);
    }
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
            child: SizedBox(
              width: meta == null
                  ? null
                  : (260 * meta!.aspectRatio).clamp(0.0, 210.0),
              height: meta == null
                  ? null
                  : (260 * meta!.aspectRatio).clamp(0.0, 210.0) /
                        meta!.aspectRatio,
              child: MediaImage(id: widget.id, fit: BoxFit.contain),
            ),
          ),
        ),
      );
    }
    if (widget.kind == 'VIDEO') {
      final controller = video;
      final ready = controller != null && controller.value.isInitialized;
      final known = meta;
      final ratio = ready
          ? controller.value.aspectRatio
          : known != null && known.isValid
          ? known.aspectRatio
          : null;
      // Until the real shape is known, avoid reserving a wrong (portrait)
      // frame: the probe resolves the ratio before playback is ready.
      final width = ratio == null ? 210.0 : (260 * ratio).clamp(0.0, 210.0);
      final height = ratio == null ? 150.0 : width / ratio;
      final duration =
          known?.duration ?? (ready ? controller.value.duration : null);
      return Hero(
        tag: widget.sourceTag ?? MediaScreen.heroTag(widget.id),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: SizedBox(
            key: ValueKey('video-frame-${widget.id}'),
            width: width,
            height: height,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const Positioned.fill(child: ColoredBox(color: QChatColors.black87)),
                if (ready)
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
                    border: Border.all(color: QChatColors.white70, width: 1.5),
                  ),
                  child: const QChatIcon(
                    'play',
                    color: QChatColors.white,
                    size: 34,
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
                          colors: [QChatColors.transparent, QChatColors.black38],
                        ),
                      ),
                      child: Text(
                        '${duration.inMinutes}:${duration.inSeconds.remainder(60).toString().padLeft(2, '0')}',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          color: QChatColors.white,
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
    if (widget.kind == 'AUDIO') {
      final seconds = voiceSeconds ?? 1;
      // Width derives from the sent duration only, so the bubble keeps the
      // exact size it had at send time even before the audio is loaded.
      final width = 50 + 64 * math.sqrt(seconds.clamp(1, 60) / 60);
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: audioLoading ? null : toggleAudio,
        child: SizedBox(
          width: width,
          height: 24,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                '$seconds"',
                maxLines: 1,
                style: const TextStyle(
                  fontSize: 17,
                  height: 1,
                  color: QChatColors.ink,
                ),
              ),
              const SizedBox(width: 8),
              if (audioLoading)
                const SizedBox.square(dimension: 22, child: QChatLoading())
              else
                _VoiceSpeaker(animation: speakerWave, playing: audioPlaying),
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

class _VoiceSpeaker extends StatelessWidget {
  const _VoiceSpeaker({required this.animation, required this.playing});
  final Animation<double> animation;
  final bool playing;
  @override
  Widget build(BuildContext c) => AnimatedBuilder(
    animation: animation,
    builder: (c, _) => CustomPaint(
      size: const Size.square(22),
      painter: _SpeakerPainter(animation.value, playing),
    ),
  );
}

/// Dot plus two sound arcs, the voice note marker of the reference bubble.
class _SpeakerPainter extends CustomPainter {
  const _SpeakerPainter(this.progress, this.playing);
  final double progress;
  final bool playing;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 24, size.height / 24);
    const ink = QChatColors.ink;
    const origin = Offset(8.4, 12);
    canvas.drawCircle(origin, 1.8, Paint()..color = ink);
    final wave = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 2; i++) {
      final radius = 4.0 + i * 3.7;
      final pulse = playing ? (progress + i * .5) % 1 : 0.0;
      final opacity = playing ? 1 - .55 * pulse : 1.0;
      canvas.drawArc(
        Rect.fromCircle(center: origin, radius: radius + (playing ? pulse * 1.2 : 0)),
        -.72,
        1.44,
        false,
        wave..color = ink.withValues(alpha: opacity),
      );
    }
  }

  @override
  bool shouldRepaint(_SpeakerPainter old) =>
      old.progress != progress || old.playing != playing;
}
