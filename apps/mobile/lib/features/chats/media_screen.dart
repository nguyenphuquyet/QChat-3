import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../../core/network/cached_video.dart';
import '../../core/network/client.dart';

/// Immersive, chrome-free image and video viewer.
class MediaScreen extends ConsumerStatefulWidget {
  const MediaScreen({super.key, required this.id, this.sourceTag});
  final String id;
  final String? sourceTag;

  /// Tag shared with the thumbnail that opens this viewer, so the media grows
  /// out of its original frame.
  static String heroTag(String id) => 'media-hero-$id';

  @override
  ConsumerState<MediaScreen> createState() => _MediaScreenState();
}

class _MediaScreenState extends ConsumerState<MediaScreen> {
  late Future<Map<String, dynamic>> access;

  @override
  void initState() {
    super.initState();
    access = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final client = ref.read(clientProvider);
    final cached = await MediaCache.info(client, widget.id);
    if (cached != null) return cached;
    final data = await ref
        .read(clientProvider)
        .get('/media/${widget.id}/access', cached: false);
    return Map<String, dynamic>.from(data as Map);
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    edgeToEdge: true,
    background: Colors.black,
    statusBackground: Colors.black,
    navigationBackground: Colors.black,
    child: Stack(
      children: [
        Positioned.fill(
          child: Hero(
            tag: widget.sourceTag ?? MediaScreen.heroTag(widget.id),
            flightShuttleBuilder:
                (flightContext, animation, direction, from, to) {
                  final thumbnail =
                      (direction == HeroFlightDirection.push
                              ? from.widget
                              : to.widget)
                          as Hero;
                  return FittedBox(
                    fit: BoxFit.contain,
                    child: SizedBox.fromSize(
                      size:
                          ((direction == HeroFlightDirection.push ? from : to)
                                      .findRenderObject()
                                  as RenderBox)
                              .size,
                      child: thumbnail.child,
                    ),
                  );
                },
            child: FutureBuilder<Map<String, dynamic>>(
              future: access,
              builder: (c, s) {
                if (s.hasError) {
                  return _ViewerMessage(
                    text: tr(c, 'networkError'),
                    onRetry: () => setState(() => access = _load()),
                  );
                }
                if (!s.hasData) {
                  return MediaCache.getFromMemory(widget.id) != null
                      ? _ImageViewer(id: widget.id)
                      : const _ViewerPlaceholder();
                }
                final data = s.data!;
                final mime = data['mime'] as String? ?? '';
                return mime.startsWith('video/')
                    ? VideoMedia(
                        url: data['url']?.toString() ?? '',
                        mediaId: widget.id,
                        client: ref.read(clientProvider),
                      )
                    : _ImageViewer(id: widget.id);
              },
            ),
          ),
        ),
        Positioned(
          top: 0,
          left: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: _ViewerButton(
                icon: 'close',
                label: tr(c, 'back'),
                onTap: () => context.pop(),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.id});
  final String id;

  @override
  Widget build(BuildContext c) => InteractiveViewer(
    minScale: 1,
    maxScale: 4,
    child: Center(
      child: MediaImage(id: id, fit: BoxFit.contain),
    ),
  );
}

/// Circular translucent control used on top of media.
class _ViewerButton extends StatelessWidget {
  const _ViewerButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final String icon, label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: const BoxDecoration(
          color: Color(0x59000000),
          shape: BoxShape.circle,
        ),
        child: Center(child: QChatIcon(icon, color: Colors.white, size: 23)),
      ),
    ),
  );
}

class _PlainIconButton extends StatelessWidget {
  const _PlainIconButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final String icon, label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: QChatIcon(icon, color: Colors.white, size: 26),
      ),
    ),
  );
}

class _ViewerPlaceholder extends StatelessWidget {
  const _ViewerPlaceholder();

  @override
  Widget build(BuildContext c) => const ColoredBox(color: Color(0xff0a0a0a));
}

class _ViewerMessage extends StatelessWidget {
  const _ViewerMessage({required this.text, required this.onRetry});
  final String text;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 15),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: onRetry,
            child: Text(
              tr(c, 'retry'),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class VideoMedia extends StatefulWidget {
  const VideoMedia({
    super.key,
    required this.url,
    this.heroTag,
    this.mediaId,
    this.client,
  });
  final String url;
  final String? mediaId;
  final QChatClient? client;
  final String? heroTag;
  @override
  State<VideoMedia> createState() => _VideoMediaState();
}

class _VideoMediaState extends State<VideoMedia> {
  VideoPlayerController? controller;
  CachedVideo? cachedVideo;
  final speedKey = GlobalKey();
  bool failed = false;
  double speed = 1;

  @override
  void initState() {
    super.initState();
    start();
  }

  Future<void> start() async {
    try {
      if (widget.mediaId != null && widget.client != null) {
        final source = await CachedVideo.load(widget.client!, widget.mediaId!);
        if (!mounted) {
          await source.dispose();
          return;
        }
        cachedVideo = source;
      }
      final created =
          cachedVideo?.controller ??
          VideoPlayerController.networkUrl(Uri.parse(widget.url));
      controller = created;
      await created.initialize();
      if (!mounted) return;
      await created.setLooping(true);
      await created.play();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => failed = true);
    }
  }

  @override
  void dispose() {
    if (cachedVideo != null) {
      cachedVideo!.dispose();
    } else {
      controller?.dispose();
    }
    super.dispose();
  }

  String clock(Duration d) =>
      '${d.inMinutes.remainder(60).toString().padLeft(2, '0')}:'
      '${d.inSeconds.remainder(60).toString().padLeft(2, '0')}';

  Future<void> pickSpeed(BuildContext c) async {
    final box = speedKey.currentContext?.findRenderObject() as RenderBox?;
    final overlay = Overlay.of(c).context.findRenderObject() as RenderBox;
    final origin = box?.localToGlobal(Offset.zero, ancestor: overlay);
    final chosen = await showMenu<double>(
      context: c,
      color: const Color(0xff2b2b2b),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      position: RelativeRect.fromLTRB(
        (origin?.dx ?? overlay.size.width - 120) - 40,
        (origin?.dy ?? overlay.size.height) - 250,
        overlay.size.width - (origin?.dx ?? overlay.size.width - 120),
        0,
      ),
      items: [
        for (final value in const [0.5, 0.75, 1.0, 1.5, 2.0])
          PopupMenuItem(
            value: value,
            height: 44,
            child: Text(
              '${value}x',
              style: TextStyle(
                fontSize: 15,
                color: value == speed ? QChatColors.green : Colors.white,
              ),
            ),
          ),
      ],
    );
    final player = controller;
    if (chosen == null || player == null) return;
    await player.setPlaybackSpeed(chosen);
    if (mounted) setState(() => speed = chosen);
  }

  Widget video(Widget child) {
    final tag = widget.heroTag;
    return tag == null ? child : Hero(tag: tag, child: child);
  }

  @override
  Widget build(BuildContext c) {
    if (failed) {
      return _ViewerMessage(
        text: tr(c, 'videoPlaybackError'),
        onRetry: () {
          setState(() => failed = false);
          start();
        },
      );
    }
    final player = controller;
    if (player == null || !player.value.isInitialized) {
      return const _ViewerPlaceholder();
    }
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: player,
      builder: (c, value, _) {
        final total = value.duration.inMilliseconds;
        final played = value.position.inMilliseconds.clamp(
          0,
          total <= 0 ? 0 : total,
        );
        return Stack(
          children: [
            Positioned.fill(
              child: Center(
                child: video(
                  AspectRatio(
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
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x00000000), Color(0x99000000)],
                  ),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 56, 14, 6),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: [
                            _PlainIconButton(
                              icon: value.isPlaying ? 'pause' : 'play',
                              label: tr(c, value.isPlaying ? 'pause' : 'play'),
                              onTap: () => value.isPlaying
                                  ? player.pause()
                                  : player.play(),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${clock(value.position)} / '
                              '${clock(value.duration)}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                height: 1.2,
                              ),
                            ),
                            const Spacer(),
                            GestureDetector(
                              key: speedKey,
                              behavior: HitTestBehavior.opaque,
                              onTap: () => pickSpeed(c),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 6,
                                ),
                                child: Text(
                                  speed == 1
                                      ? tr(c, 'playbackSpeed')
                                      : '${tr(c, 'playbackSpeed')} ${speed}x',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    height: 1.2,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        SliderTheme(
                          data: SliderThemeData(
                            trackHeight: 2,
                            activeTrackColor: Colors.white,
                            inactiveTrackColor: const Color(0x4dffffff),
                            thumbColor: Colors.white,
                            thumbShape: const RoundSliderThumbShape(
                              enabledThumbRadius: 6,
                            ),
                            overlayShape: SliderComponentShape.noOverlay,
                          ),
                          child: Slider(
                            value: played.toDouble(),
                            max: total <= 0 ? 1 : total.toDouble(),
                            onChanged: (v) => player.seekTo(
                              Duration(milliseconds: v.round()),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
