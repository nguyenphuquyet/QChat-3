import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/design_system/media_widgets.dart';
import '../../core/media/media_video.dart';

/// Room a picture has to move inside a frame before an edge shows, as
/// fractions of the frame's width and height.
typedef CoverMediaLimits = ({double x, double y});

/// How far a picture can drift inside [box] at [scale].
///
/// [aspect] is the source's width divided by its height. A landscape clip in a
/// portrait flap already overflows on the sides at scale 1, so it can be panned
/// even without zooming; a portrait clip in a wide chat bubble overflows
/// vertically. Unknown geometry falls back to the frame's own shape, which is
/// the safest crop (no movement until the designer zooms in).
CoverMediaLimits coverMediaLimits(Size box, double scale, double? aspect) {
  if (box.width <= 0 || box.height <= 0) return (x: 0, y: 0);
  final frame = box.width / box.height;
  final source = aspect != null && aspect > 0 ? aspect : frame;
  final double coverWidth, coverHeight;
  if (source >= frame) {
    coverHeight = box.height;
    coverWidth = box.height * source;
  } else {
    coverWidth = box.width;
    coverHeight = box.width / source;
  }
  final roomX = math.max(0.0, (coverWidth * scale - box.width) / 2) / box.width;
  final roomY =
      math.max(0.0, (coverHeight * scale - box.height) / 2) / box.height;
  return (x: roomX, y: roomY);
}

/// Width divided by height of a media item, when its bytes have already been
/// measured. Both stills and clips record these in [MediaCache].
double? coverMediaAspect(String id) {
  final info = MediaCache.infoFromMemory(id);
  final width = info?['width'];
  final height = info?['height'];
  if (width is num && height is num && width > 0 && height > 0) {
    return width.toDouble() / height.toDouble();
  }
  return null;
}

/// Matrix that zooms [box] by [scale] and then shifts it by the normalised
/// [x] and [y] offsets.
Matrix4 coverMediaMatrix(Size box, double scale, double x, double y) =>
    Matrix4.identity()
      ..setEntry(0, 0, scale)
      ..setEntry(1, 1, scale)
      ..setEntry(0, 3, x * box.width)
      ..setEntry(1, 3, y * box.height);

/// A cover picture or clip, cropped and framed the way its design says.
///
/// The media always fills its box (`BoxFit.cover`); [scale] zooms in and the
/// offsets slide it, both clamped against the real overflow so a moved picture
/// never leaves a letterbox behind. The same widget draws the flap, the chat
/// bubble and the studio previews, so what a designer frames is what the packet
/// shows.
class CoverMediaView extends StatelessWidget {
  const CoverMediaView({
    super.key,
    required this.id,
    this.video = false,
    this.scale = 1,
    this.offsetX = 0,
    this.offsetY = 0,
    this.placeholder,
  });

  final String id;
  final bool video;
  final double scale, offsetX, offsetY;

  /// Colour shown while a clip loads.
  final Color? placeholder;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final size = Size(box.maxWidth, box.maxHeight);
      final limits = coverMediaLimits(size, scale, coverMediaAspect(id));
      final x = offsetX.clamp(-limits.x, limits.x).toDouble();
      final y = offsetY.clamp(-limits.y, limits.y).toDouble();
      final Widget picture = video
          ? MediaVideo(id: id, fit: BoxFit.cover, placeholder: placeholder)
          : MediaImage(id: id, fit: BoxFit.cover);
      if (scale == 1 && x.abs() < .0001 && y.abs() < .0001) {
        return ClipRect(child: picture);
      }
      return ClipRect(
        child: Transform(
          alignment: Alignment.center,
          transform: coverMediaMatrix(size, scale, x, y),
          child: picture,
        ),
      );
    },
  );
}

/// Drag and pinch surface that reframes a cover picture.
///
/// Dragging moves the picture and pinching zooms it. A double tap is
/// deliberately not wired here: it competes with the scale recognizer and
/// starves it of move events, which made dragging feel dead. Studio sections
/// carry an explicit reset control instead.
class CoverMediaGesture extends StatefulWidget {
  const CoverMediaGesture({
    super.key,
    required this.id,
    required this.scale,
    required this.offsetX,
    required this.offsetY,
    required this.onChanged,
    this.child,
    this.semanticsLabel,
  });

  final String id;
  final double scale, offsetX, offsetY;

  /// Called with the new zoom and normalised offsets on every drag or pinch.
  final void Function(double scale, double offsetX, double offsetY) onChanged;

  /// The picture to move. Without one the surface is invisible and only
  /// captures gestures, which is how the flap preview is adjusted.
  final Widget? child;

  final String? semanticsLabel;

  @override
  State<CoverMediaGesture> createState() => _CoverMediaGestureState();
}

class _CoverMediaGestureState extends State<CoverMediaGesture> {
  double _startScale = 1, _startX = 0, _startY = 0;
  Offset _focal = Offset.zero;
  Size _box = Size.zero;

  void _start(ScaleStartDetails details) {
    _startScale = widget.scale;
    _startX = widget.offsetX;
    _startY = widget.offsetY;
    _focal = details.localFocalPoint;
  }

  void _update(ScaleUpdateDetails details) {
    if (_box.width <= 0 || _box.height <= 0) return;
    final scale = (_startScale * details.scale).clamp(1.0, 3.0).toDouble();
    // Zooming changes how much room the picture has, so measure the limits at
    // the zoom the gesture is heading towards, not the one it started at.
    final limits = coverMediaLimits(_box, scale, coverMediaAspect(widget.id));
    final delta = details.localFocalPoint - _focal;
    widget.onChanged(
      scale,
      (_startX + delta.dx / _box.width).clamp(-limits.x, limits.x).toDouble(),
      (_startY + delta.dy / _box.height).clamp(-limits.y, limits.y).toDouble(),
    );
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      _box = Size(box.maxWidth, box.maxHeight);
      return Semantics(
        label: widget.semanticsLabel,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onScaleStart: _start,
          onScaleUpdate: _update,
          child: widget.child ?? const SizedBox.expand(),
        ),
      );
    },
  );
}
