import 'package:flutter/widgets.dart';

import 'qapp_style.dart';

/// Draws the declarative path language used by the TSX `CustomPaint`
/// component: `fill:#rrggbb stroke:#rrggbb strokeWidth:2 cap:butt M 0 0 L 100 0 Z`.
///
/// Only absolute `M`, `L`, `Q`, `C` and `Z` commands are accepted. Malformed
/// input draws nothing instead of throwing into the widget tree.
///
/// `cap:` picks the stroke ending and defaults to `round`. `butt` is what an
/// arc wants: a round cap grows by half the stroke width past the end angle, so
/// a gauge would bleed over its own track at the start.
class QappPathPainter extends CustomPainter {
  QappPathPainter(this.source);

  final String source;

  @override
  void paint(Canvas canvas, Size size) {
    final command = _ParsedPath.parse(source);
    if (command == null || command.path == null) return;
    final path = command.path!;
    final fill = command.fill;
    final stroke = command.stroke;
    if (fill != null) {
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.fill
          ..isAntiAlias = true
          ..color = fill,
      );
    }
    if (stroke != null || fill == null) {
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..isAntiAlias = true
          ..strokeWidth = command.strokeWidth
          ..strokeCap = command.strokeCap
          ..strokeJoin = StrokeJoin.round
          ..color = stroke ?? const Color(0xff000000),
      );
    }
  }

  @override
  bool shouldRepaint(QappPathPainter oldDelegate) =>
      oldDelegate.source != source;
}

class _ParsedPath {
  _ParsedPath(
    this.path,
    this.fill,
    this.stroke,
    this.strokeWidth,
    this.strokeCap,
  );

  final Path? path;
  final Color? fill;
  final Color? stroke;
  final double strokeWidth;
  final StrokeCap strokeCap;

  static _ParsedPath? parse(String source) {
    if (source.trim().isEmpty) return null;
    final tokens = source
        .trim()
        .split(RegExp(r'\s+'))
        .where((token) => token.isNotEmpty)
        .toList(growable: false);
    Color? fill;
    Color? stroke;
    var strokeWidth = 2.0;
    var strokeCap = StrokeCap.round;
    final path = Path();
    var index = 0;
    var started = false;

    double? number() {
      if (index >= tokens.length) return null;
      final parsed = double.tryParse(tokens[index]);
      if (parsed == null) return null;
      index += 1;
      return parsed;
    }

    while (index < tokens.length) {
      final token = tokens[index];
      final lower = token.toLowerCase();
      if (lower.startsWith('fill:')) {
        fill = qappColor(token.substring(5));
        index += 1;
        continue;
      }
      if (lower.startsWith('stroke:')) {
        stroke = qappColor(token.substring(7));
        index += 1;
        continue;
      }
      if (lower.startsWith('strokewidth:')) {
        strokeWidth = double.tryParse(token.substring(12)) ?? 2;
        index += 1;
        continue;
      }
      if (lower.startsWith('cap:')) {
        strokeCap = switch (token.substring(4).toLowerCase()) {
          'butt' => StrokeCap.butt,
          'square' => StrokeCap.square,
          'round' => StrokeCap.round,
          // Unknown cap names keep the historical round ending instead of
          // rejecting an otherwise valid path.
          _ => StrokeCap.round,
        };
        index += 1;
        continue;
      }
      index += 1;
      switch (token) {
        case 'M':
          final x = number();
          final y = number();
          if (x == null || y == null) return null;
          if (started) path.close();
          path.moveTo(x, y);
          started = true;
          break;
        case 'L':
          final x = number();
          final y = number();
          if (x == null || y == null || !started) return null;
          path.lineTo(x, y);
          break;
        case 'Q':
          final cx = number();
          final cy = number();
          final x = number();
          final y = number();
          if (cx == null || cy == null || x == null || y == null || !started) {
            return null;
          }
          path.quadraticBezierTo(cx, cy, x, y);
          break;
        case 'C':
          final c1x = number();
          final c1y = number();
          final c2x = number();
          final c2y = number();
          final x = number();
          final y = number();
          if (c1x == null ||
              c1y == null ||
              c2x == null ||
              c2y == null ||
              x == null ||
              y == null ||
              !started) {
            return null;
          }
          path.cubicTo(c1x, c1y, c2x, c2y, x, y);
          break;
        case 'Z':
          if (!started) return null;
          path.close();
          break;
        default:
          return null;
      }
    }
    if (!started) return null;
    return _ParsedPath(
      path,
      fill,
      stroke,
      strokeWidth.clamp(0.1, 64),
      strokeCap,
    );
  }
}
