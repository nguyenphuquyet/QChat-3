import 'package:flutter/widgets.dart';

import 'qapp_contract.generated.dart';

/// Small, Flutter-oriented style subset used by the QChat TSX runtime.
///
/// The values are parsed once per node when a render frame arrives so the
/// widget tree can be rebuilt cheaply on every state change.
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
    this.flex,
    this.flexGrow,
    this.flexShrink,
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
    this.backgroundColor,
    this.color,
    this.opacity = 1,
    this.borderRadius = BorderRadius.zero,
    this.borderWidth = 0,
    this.borderColor,
    this.fontSize,
    this.fontWeight,
    this.fontStyle,
    this.fontFamily,
    this.lineHeight,
    this.letterSpacing,
    this.textAlign,
    this.textDecoration,
    this.textTransform = 'none',
    this.overflowHidden = false,
    this.shadow = false,
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
  final int? flex;
  final double? flexGrow;
  final double? flexShrink;
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
  final Color? backgroundColor;
  final Color? color;
  final double opacity;
  final BorderRadius borderRadius;
  final double borderWidth;
  final Color? borderColor;
  final double? fontSize;
  final FontWeight? fontWeight;
  final FontStyle? fontStyle;
  final String? fontFamily;
  final double? lineHeight;
  final double? letterSpacing;
  final TextAlign? textAlign;
  final TextDecoration? textDecoration;
  final String textTransform;
  final bool overflowHidden;
  final bool shadow;
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
      flex: flexValue?.round(),
      flexGrow: number('flexGrow'),
      flexShrink: number('flexShrink'),
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
      backgroundColor: qappColor(raw['backgroundColor']),
      color: qappColor(raw['color']),
      opacity: (number('opacity') ?? 1).clamp(0, 1),
      borderRadius: borderRadius,
      borderWidth: number('borderWidth') ?? 0,
      borderColor: qappColor(raw['borderColor']),
      fontSize: number('fontSize'),
      fontWeight: _fontWeight(raw['fontWeight']),
      fontStyle: enumText('fontStyle') == 'italic' ? FontStyle.italic : null,
      fontFamily: text('fontFamily'),
      lineHeight: number('lineHeight'),
      letterSpacing: number('letterSpacing'),
      textAlign: _textAlign(enumText('textAlign')),
      textDecoration: _decoration(enumText('textDecoration')),
      textTransform: enumText('textTransform') ?? 'none',
      overflowHidden: raw['overflow'] == 'hidden' || raw['overflow'] == 'clip',
      shadow: raw['shadow'] == true,
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
