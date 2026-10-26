import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'qapp_contract.generated.dart';

/// Raised when a style object uses a key or a value the contract does not
/// allow. The tree parser converts this into a `QappTreeException`.
class QappStyleException implements Exception {
  const QappStyleException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// Small, Flutter-oriented style subset used by the QChat TSX runtime.
///
/// The values are parsed once per node when a render frame arrives so the
/// widget tree can be rebuilt cheaply on every state change. Every accepted key
/// and enum value comes from `qapp_contract.generated.dart`, so a frame that
/// uses an unknown key or an unsupported value is rejected instead of being
/// silently ignored.
class QappStyle {
  const QappStyle({
    this.width,
    this.height,
    this.widthFactor,
    this.heightFactor,
    this.minWidth,
    this.minHeight,
    this.maxWidth,
    this.maxHeight,
    this.padding = EdgeInsets.zero,
    this.margin = EdgeInsets.zero,
    this.gap = 0,
    this.rowGap,
    this.columnGap,
    this.flex,
    this.flexGrow,
    this.flexShrink,
    this.flexBasis,
    this.flexDirection = 'column',
    this.flexWrap = 'nowrap',
    this.alignItems,
    this.justifyContent,
    this.alignSelf,
    this.position = 'relative',
    this.top,
    this.right,
    this.bottom,
    this.left,
    this.zIndex = 0,
    this.backgroundColor,
    this.gradient,
    this.color,
    this.opacity = 1,
    this.borderRadius = BorderRadius.zero,
    this.borderWidth = 0,
    this.borderColor,
    this.borderTopWidth,
    this.borderTopColor,
    this.borderRightWidth,
    this.borderRightColor,
    this.borderBottomWidth,
    this.borderBottomColor,
    this.borderLeftWidth,
    this.borderLeftColor,
    this.fontSize,
    this.fontWeight,
    this.fontStyle,
    this.fontFamily,
    this.lineHeight,
    this.letterSpacing,
    this.textAlign,
    this.textDecoration,
    this.textTransform = 'none',
    this.numberOfLines,
    this.overflow = 'visible',
    this.shadow = false,
    this.boxShadows = const <BoxShadow>[],
    this.elevation = 0,
    this.aspectRatio,
    this.rotate = 0,
    this.scale = 1,
    this.translateX = 0,
    this.translateY = 0,
  });

  final double? width;
  final double? height;
  final double? widthFactor;
  final double? heightFactor;
  final double? minWidth;
  final double? minHeight;
  final double? maxWidth;
  final double? maxHeight;
  final EdgeInsets padding;
  final EdgeInsets margin;
  final double gap;
  final double? rowGap;
  final double? columnGap;
  final int? flex;
  final double? flexGrow;
  final double? flexShrink;
  final double? flexBasis;
  final String flexDirection;
  final String flexWrap;
  final String? alignItems;
  final String? justifyContent;
  final String? alignSelf;
  final String position;
  final double? top;
  final double? right;
  final double? bottom;
  final double? left;
  final int zIndex;
  final Color? backgroundColor;
  final Gradient? gradient;
  final Color? color;
  final double opacity;
  final BorderRadius borderRadius;
  final double borderWidth;
  final Color? borderColor;
  final double? borderTopWidth;
  final Color? borderTopColor;
  final double? borderRightWidth;
  final Color? borderRightColor;
  final double? borderBottomWidth;
  final Color? borderBottomColor;
  final double? borderLeftWidth;
  final Color? borderLeftColor;
  final double? fontSize;
  final FontWeight? fontWeight;
  final FontStyle? fontStyle;
  final String? fontFamily;
  final double? lineHeight;
  final double? letterSpacing;
  final TextAlign? textAlign;
  final TextDecoration? textDecoration;
  final String textTransform;
  final int? numberOfLines;
  final String overflow;
  final bool shadow;
  final List<BoxShadow> boxShadows;
  final double elevation;
  final double? aspectRatio;
  final double rotate;
  final double scale;
  final double translateX;
  final double translateY;

  bool get isAbsolute => position == 'absolute';
  bool get isRow => flexDirection == 'row' || flexDirection == 'row-reverse';
  bool get isReverse =>
      flexDirection == 'row-reverse' || flexDirection == 'column-reverse';
  bool get clipsContent => overflow == 'hidden' || overflow == 'clip';

  /// Distance between children along the main axis, honouring the axis
  /// specific overrides.
  double mainGapFor(bool isRow) => (isRow ? columnGap : rowGap) ?? gap;

  /// A per-edge border, falling back to the uniform `borderWidth`/`borderColor`
  /// for any edge that was not set.
  ///
  /// An edge without a width becomes `BorderSide.none`: a zero-width solid side
  /// is a *hairline*, so it would paint a one-pixel line on an edge the app
  /// never asked for, and Flutter refuses to paint a hairline together with a
  /// corner radius.
  Border? boxBorder() {
    final top = borderTopWidth ?? borderWidth;
    final right = borderRightWidth ?? borderWidth;
    final bottom = borderBottomWidth ?? borderWidth;
    final left = borderLeftWidth ?? borderWidth;
    if (top <= 0 && right <= 0 && bottom <= 0 && left <= 0) return null;
    final fallback = borderColor ?? const Color(0xff000000);
    BorderSide edge(double width, Color? color) => width > 0
        ? BorderSide(width: width, color: color ?? fallback)
        : BorderSide.none;
    return Border(
      top: edge(top, borderTopColor),
      right: edge(right, borderRightColor),
      bottom: edge(bottom, borderBottomColor),
      left: edge(left, borderLeftColor),
    );
  }

  factory QappStyle.fromMap(Object? raw) {
    if (raw is! Map) return const QappStyle();
    double? number(String key) => _number(raw[key]);
    String? text(String key) {
      final value = raw[key];
      return value is String && value.isNotEmpty ? value : null;
    }

    // CSS-like aliases (`"space-between"`) are normalized to the canonical
    // camelCase value in exactly one place, driven by the generated contract.
    String? enumText(String key) {
      final value = raw[key];
      if (value is! String || value.isEmpty) return null;
      final enumName = qappStyleEnumKeys[key];
      if (enumName == null) return value;
      return qappStyleEnumAliases[enumName]?[value] ?? value;
    }

    for (final key in raw.keys) {
      final name = key.toString();
      if (!qappStyleKeys.contains(name)) {
        throw QappStyleException(
          'STYLE_KEY_UNKNOWN',
          'Unknown style key: $name',
        );
      }
    }
    for (final entry in qappStyleEnumKeys.entries) {
      if (raw[entry.key] == null) continue;
      final normalized = enumText(entry.key);
      final allowed = qappStyleEnumValues[entry.value];
      if (allowed == null || normalized == null) continue;
      if (!allowed.contains(normalized)) {
        throw QappStyleException(
          'STYLE_VALUE_INVALID',
          'Invalid value for ${entry.key}: ${raw[entry.key]}',
        );
      }
    }

    double widthValue;
    double? widthFactor;
    final rawWidth = raw['width'];
    widthValue = _number(rawWidth) ?? 0;
    if (rawWidth is String && rawWidth.trim().endsWith('%')) {
      final percent = double.tryParse(
        rawWidth.trim().substring(0, rawWidth.trim().length - 1),
      );
      if (percent != null) {
        widthFactor = percent / 100;
        widthValue = 0;
      }
    }
    double heightValue;
    double? heightFactor;
    final rawHeight = raw['height'];
    heightValue = _number(rawHeight) ?? 0;
    if (rawHeight is String && rawHeight.trim().endsWith('%')) {
      final percent = double.tryParse(
        rawHeight.trim().substring(0, rawHeight.trim().length - 1),
      );
      if (percent != null) {
        heightFactor = percent / 100;
        heightValue = 0;
      }
    }

    final radius = number('borderRadius') ?? 0;
    final borderRadius = BorderRadius.only(
      topLeft: Radius.circular(number('borderTopLeftRadius') ?? radius),
      topRight: Radius.circular(number('borderTopRightRadius') ?? radius),
      bottomLeft: Radius.circular(number('borderBottomLeftRadius') ?? radius),
      bottomRight: Radius.circular(number('borderBottomRightRadius') ?? radius),
    );

    final flexValue = number('flex');
    final numberOfLinesValue = number('numberOfLines');
    return QappStyle(
      width: widthFactor == null && rawWidth != null ? widthValue : null,
      height: heightFactor == null && rawHeight != null ? heightValue : null,
      widthFactor: widthFactor,
      heightFactor: heightFactor,
      minWidth: number('minWidth'),
      minHeight: number('minHeight'),
      maxWidth: number('maxWidth'),
      maxHeight: number('maxHeight'),
      padding: _edges(
        raw,
        all: 'padding',
        horizontal: 'paddingHorizontal',
        vertical: 'paddingVertical',
        top: 'paddingTop',
        right: 'paddingRight',
        bottom: 'paddingBottom',
        left: 'paddingLeft',
      ),
      margin: _edges(
        raw,
        all: 'margin',
        horizontal: 'marginHorizontal',
        vertical: 'marginVertical',
        top: 'marginTop',
        right: 'marginRight',
        bottom: 'marginBottom',
        left: 'marginLeft',
      ),
      gap: number('gap') ?? 0,
      rowGap: number('rowGap'),
      columnGap: number('columnGap'),
      flex: flexValue?.round(),
      flexGrow: number('flexGrow'),
      flexShrink: number('flexShrink'),
      flexBasis: number('flexBasis'),
      flexDirection: enumText('flexDirection') ?? 'column',
      flexWrap: enumText('flexWrap') ?? 'nowrap',
      alignItems: enumText('alignItems'),
      justifyContent: enumText('justifyContent'),
      alignSelf: enumText('alignSelf'),
      position: enumText('position') ?? 'relative',
      top: number('top'),
      right: number('right'),
      bottom: number('bottom'),
      left: number('left'),
      zIndex: (number('zIndex') ?? 0).round(),
      backgroundColor: qappColor(raw['backgroundColor']),
      gradient: _gradient(raw['gradient']),
      color: qappColor(raw['color']),
      opacity: (number('opacity') ?? 1).clamp(0, 1),
      borderRadius: borderRadius,
      borderWidth: number('borderWidth') ?? 0,
      borderColor: qappColor(raw['borderColor']),
      borderTopWidth: number('borderTopWidth'),
      borderTopColor: qappColor(raw['borderTopColor']),
      borderRightWidth: number('borderRightWidth'),
      borderRightColor: qappColor(raw['borderRightColor']),
      borderBottomWidth: number('borderBottomWidth'),
      borderBottomColor: qappColor(raw['borderBottomColor']),
      borderLeftWidth: number('borderLeftWidth'),
      borderLeftColor: qappColor(raw['borderLeftColor']),
      fontSize: number('fontSize'),
      fontWeight: _fontWeight(raw['fontWeight']),
      fontStyle: enumText('fontStyle') == 'italic' ? FontStyle.italic : null,
      fontFamily: text('fontFamily'),
      lineHeight: number('lineHeight'),
      letterSpacing: number('letterSpacing'),
      textAlign: _textAlign(enumText('textAlign')),
      textDecoration: _decoration(enumText('textDecoration')),
      textTransform: enumText('textTransform') ?? 'none',
      numberOfLines: numberOfLinesValue?.round(),
      overflow: enumText('overflow') ?? 'visible',
      shadow: raw['shadow'] == true,
      boxShadows: _boxShadows(raw),
      elevation: number('elevation') ?? 0,
      aspectRatio: number('aspectRatio'),
      rotate: number('rotate') ?? 0,
      scale: number('scale') ?? 1,
      translateX: number('translateX') ?? 0,
      translateY: number('translateY') ?? 0,
    );
  }

  TextStyle toTextStyle({Color? fallbackColor, double? fallbackSize}) {
    final size = fontSize ?? fallbackSize;
    final height = lineHeight != null && size != null && size > 0
        ? lineHeight! / size
        : null;
    return TextStyle(
      color: color ?? fallbackColor,
      fontSize: size,
      fontWeight: fontWeight,
      fontStyle: fontStyle,
      fontFamily: fontFamily,
      height: height,
      letterSpacing: letterSpacing,
      decoration: textDecoration,
    );
  }

  static double? _number(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String) {
      final raw = value.trim().toLowerCase();
      if (raw.endsWith('%')) return null;
      return double.tryParse(raw.replaceAll('px', ''));
    }
    return null;
  }

  static EdgeInsets _edges(
    Map raw, {
    required String all,
    required String horizontal,
    required String vertical,
    required String top,
    required String right,
    required String bottom,
    required String left,
  }) {
    final fallback = _number(raw[all]) ?? 0;
    final h = _number(raw[horizontal]) ?? fallback;
    final v = _number(raw[vertical]) ?? fallback;
    return EdgeInsets.fromLTRB(
      _number(raw[left]) ?? h,
      _number(raw[top]) ?? v,
      _number(raw[right]) ?? h,
      _number(raw[bottom]) ?? v,
    );
  }

  static List<BoxShadow> _boxShadows(Map raw) {
    final result = <BoxShadow>[];
    final value = raw['boxShadow'];
    final entries = value is List
        ? value
        : (value is Map ? <Object>[value] : const <Object>[]);
    for (final entry in entries) {
      if (entry is! Map) continue;
      result.add(
        BoxShadow(
          color: qappColor(entry['color']) ?? const Color(0x1f000000),
          offset: Offset(_number(entry['offsetX']) ?? 0, _number(entry['offsetY']) ?? 0),
          blurRadius: _number(entry['blurRadius']) ?? 8,
          spreadRadius: _number(entry['spreadRadius']) ?? 0,
        ),
      );
    }
    if (result.isEmpty && raw['shadow'] == true) {
      result.add(
        const BoxShadow(
          color: Color(0x1f000000),
          blurRadius: 16,
          offset: Offset(0, 4),
        ),
      );
    }
    return result;
  }

  static Gradient? _gradient(Object? value) {
    if (value is! Map) return null;
    final rawStops = value['stops'];
    if (rawStops is! List || rawStops.isEmpty) return null;
    final colors = <Color>[];
    final positions = <double>[];
    for (final stop in rawStops) {
      if (stop is! Map) continue;
      final color = qappColor(stop['color']);
      if (color == null) continue;
      colors.add(color);
      positions.add((_number(stop['offset']) ?? 0).clamp(0.0, 1.0));
    }
    if (colors.length < 2) return null;
    if (value['type']?.toString() == 'radial') {
      return RadialGradient(colors: colors, stops: positions);
    }
    // CSS convention: 0deg points up, 90deg to the right, 180deg down.
    final angle = _number(value['angle']) ?? 180;
    final radians = angle * math.pi / 180;
    final dx = math.sin(radians);
    final dy = -math.cos(radians);
    return LinearGradient(
      begin: Alignment(-dx, -dy),
      end: Alignment(dx, dy),
      colors: colors,
      stops: positions,
    );
  }

  static FontWeight? _fontWeight(Object? value) {
    if (value is num) {
      final index = (value ~/ 100) - 1;
      if (index >= 0 && index < FontWeight.values.length) {
        return FontWeight.values[index];
      }
      return null;
    }
    return switch (value) {
      'normal' => FontWeight.w400,
      'bold' => FontWeight.w700,
      '100' => FontWeight.w100,
      '200' => FontWeight.w200,
      '300' => FontWeight.w300,
      '400' => FontWeight.w400,
      '500' => FontWeight.w500,
      '600' => FontWeight.w600,
      '700' => FontWeight.w700,
      '800' => FontWeight.w800,
      '900' => FontWeight.w900,
      _ => null,
    };
  }

  static TextAlign? _textAlign(Object? value) => switch (value) {
    'left' => TextAlign.left,
    'right' => TextAlign.right,
    'center' => TextAlign.center,
    'justify' => TextAlign.justify,
    _ => null,
  };

  static TextDecoration? _decoration(Object? value) => switch (value) {
    'underline' => TextDecoration.underline,
    'lineThrough' => TextDecoration.lineThrough,
    'none' => TextDecoration.none,
    _ => null,
  };
}

Color? qappColor(Object? value) {
  if (value is! String) return null;
  final raw = value.trim().toLowerCase();
  if (raw.isEmpty || raw == 'transparent' || raw == 'none') return null;
  if (raw.startsWith('#')) {
    var hex = raw.substring(1);
    if (hex.length == 3) {
      hex = hex.split('').map((part) => '$part$part').join();
    }
    if (hex.length == 6) hex = 'ff$hex';
    if (hex.length == 8) {
      final parsed = int.tryParse(hex, radix: 16);
      if (parsed != null) return Color(parsed);
    }
    return null;
  }
  final rgba = RegExp(r'^rgba?\(([^)]+)\)$').firstMatch(raw);
  if (rgba != null) {
    final parts = rgba
        .group(1)!
        .split(',')
        .map((part) => double.tryParse(part.trim()))
        .toList(growable: false);
    if (parts.length >= 3 && parts.take(3).every((part) => part != null)) {
      final alpha = parts.length >= 4 ? (parts[3] ?? 1).clamp(0.0, 1.0) : 1.0;
      return Color.fromRGBO(
        parts[0]!.clamp(0, 255).round(),
        parts[1]!.clamp(0, 255).round(),
        parts[2]!.clamp(0, 255).round(),
        alpha,
      );
    }
    return null;
  }
  return _namedColors[raw];
}

const _namedColors = <String, Color>{
  'black': Color(0xff000000),
  'white': Color(0xffffffff),
  'red': Color(0xfff44336),
  'green': Color(0xff0f7b45),
  'blue': Color(0xff2196f3),
  'grey': Color(0xff9e9e9e),
  'gray': Color(0xff9e9e9e),
  'orange': Color(0xffff9800),
  'purple': Color(0xff9c27b0),
  'yellow': Color(0xffffeb3b),
  'pink': Color(0xffe91e63),
};
