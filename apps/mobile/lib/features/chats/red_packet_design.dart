import 'dart:convert';
import 'package:flutter/widgets.dart';

/// Red of the default red-packet cover. Custom covers can paint their own
/// background, but this is the colour QChat uses everywhere a cover is not
/// configured (the chat bubble, the default design, the gold open button).
const redPacketRed = Color(0xffd93b30);

/// One free-floating element a designer can place on a cover.
///
/// `x`/`y` are fractions of the cover box, `size` is a fraction of its width
/// and `rotation` is in radians, so a design renders at any size.
class CoverDecoration {
  const CoverDecoration({
    required this.id,
    this.kind = 'emoji',
    required this.value,
    this.x = .5,
    this.y = .3,
    this.size = .2,
    this.rotation = 0,
    this.animation = 'none',
    this.area = 'top',
  });

  final String id;

  /// `emoji`, `text` or `image`.
  final String kind;
  final String value;
  final double x, y, size, rotation;

  /// `none`, `float`, `pulse` or `sparkle`.
  final String animation;

  /// `top`, `bottom` or `all`.
  final String area;

  CoverDecoration copyWith({
    String? kind,
    String? value,
    double? x,
    double? y,
    double? size,
    double? rotation,
    String? animation,
    String? area,
  }) => CoverDecoration(
    id: id,
    kind: kind ?? this.kind,
    value: value ?? this.value,
    x: x ?? this.x,
    y: y ?? this.y,
    size: size ?? this.size,
    rotation: rotation ?? this.rotation,
    animation: animation ?? this.animation,
    area: area ?? this.area,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'value': value,
    'x': x,
    'y': y,
    'size': size,
    'rotation': rotation,
    'animation': animation,
    'area': area,
  };

  static CoverDecoration fromJson(Map? json, int index) => CoverDecoration(
    id: json?['id']?.toString() ?? 'decoration-$index',
    kind: json?['kind']?.toString() ?? 'emoji',
    value: json?['value']?.toString() ?? '',
    x: _double(json?['x'], .5),
    y: _double(json?['y'], .3),
    size: _double(json?['size'], .2),
    rotation: _double(json?['rotation'], 0),
    animation: json?['animation']?.toString() ?? 'none',
    area: json?['area']?.toString() ?? 'top',
  );
}

/// Background of the part of the cover above the arch.
class CoverBackground {
  const CoverBackground({
    this.type = 'solid',
    this.color = redPacketRed,
    this.colors = const [],
    this.mediaId,
  });

  /// `solid`, `gradient` or `image`.
  final String type;
  final Color color;
  final List<Color> colors;
  final String? mediaId;

  bool get isImage => type == 'image' && (mediaId ?? '').isNotEmpty;

  CoverBackground copyWith({
    String? type,
    Color? color,
    List<Color>? colors,
    String? mediaId,
  }) => CoverBackground(
    type: type ?? this.type,
    color: color ?? this.color,
    colors: colors ?? this.colors,
    mediaId: mediaId ?? this.mediaId,
  );

  Map<String, dynamic> toJson() => {
    'type': type,
    'color': coverHex(color),
    'colors': colors.map(coverHex).toList(),
    if ((mediaId ?? '').isNotEmpty) 'mediaId': mediaId,
  };

  static CoverBackground fromJson(Map? json) {
    final type = json?['type']?.toString() ?? 'solid';
    final colors = json?['colors'];
    return CoverBackground(
      type: type,
      color: coverColor(json?['color'], redPacketRed),
      colors: colors is List
          ? [
              for (final value in colors)
                if (value != null) coverColor(value, redPacketRed),
            ]
          : const [],
      mediaId: json?['mediaId']?.toString(),
    );
  }
}

/// Effects the designer can switch on for the whole cover.
class CoverEffects {
  const CoverEffects({
    this.sparkles = false,
    this.float = false,
    this.pulse = false,
  });

  final bool sparkles, float, pulse;

  CoverEffects copyWith({bool? sparkles, bool? float, bool? pulse}) =>
      CoverEffects(
        sparkles: sparkles ?? this.sparkles,
        float: float ?? this.float,
        pulse: pulse ?? this.pulse,
      );

  Map<String, dynamic> toJson() => {
    'sparkles': sparkles,
    'float': float,
    'pulse': pulse,
  };

  static CoverEffects fromJson(Map? json) => CoverEffects(
    sparkles: json?['sparkles'] == true,
    float: json?['float'] == true,
    pulse: json?['pulse'] == true,
  );
}

/// Everything a designer can change about a red-packet cover.
///
/// The same object drives the closed cover, the popup overlay colour and the
/// decorated top of the opened receipt, so a cover looks the same everywhere.
class CoverDesign {
  const CoverDesign({
    this.background = const CoverBackground(),
    this.bottomColor = redPacketRed,
    this.topHeight = .80,
    this.receiptHeight = .34,
    this.overlayColor = const Color(0x80000000),
    this.openColor = const Color(0xfff6e3b0),
    this.openTextColor = const Color(0xffa8512f),
    this.openLabel = 'Mở',
    this.decorations = const [],
    this.effects = const CoverEffects(),
  });

  /// Painted above the arch.
  final CoverBackground background;

  /// Painted below the arch.
  final Color bottomColor;

  /// Lowest point of the arch, as a fraction of the cover height. Moving it up
  /// or down is what makes the top artwork taller or shorter.
  final double topHeight;

  /// Height of the decorated header of the opened receipt, as a fraction of the
  /// screen. Designers can push it down or pull it up freely.
  final double receiptHeight;

  /// Scrim shown behind the popup when the cover is tapped.
  final Color overlayColor;

  final Color openColor, openTextColor;
  final String openLabel;
  final List<CoverDecoration> decorations;
  final CoverEffects effects;

  static const CoverDesign defaultDesign = CoverDesign();

  CoverDesign copyWith({
    CoverBackground? background,
    Color? bottomColor,
    double? topHeight,
    double? receiptHeight,
    Color? overlayColor,
    Color? openColor,
    Color? openTextColor,
    String? openLabel,
    List<CoverDecoration>? decorations,
    CoverEffects? effects,
  }) => CoverDesign(
    background: background ?? this.background,
    bottomColor: bottomColor ?? this.bottomColor,
    topHeight: topHeight ?? this.topHeight,
    receiptHeight: receiptHeight ?? this.receiptHeight,
    overlayColor: overlayColor ?? this.overlayColor,
    openColor: openColor ?? this.openColor,
    openTextColor: openTextColor ?? this.openTextColor,
    openLabel: openLabel ?? this.openLabel,
    decorations: decorations ?? this.decorations,
    effects: effects ?? this.effects,
  );

  Map<String, dynamic> toJson() => {
    'background': background.toJson(),
    'bottomColor': coverHex(bottomColor),
    'topHeight': topHeight,
    'receiptHeight': receiptHeight,
    'overlayColor': coverHex(overlayColor),
    'openColor': coverHex(openColor),
    'openTextColor': coverHex(openTextColor),
    'openLabel': openLabel,
    'decorations': decorations.map((item) => item.toJson()).toList(),
    'effects': effects.toJson(),
  };

  String toJsonString() => jsonEncode(toJson());

  static CoverDesign fromJson(Object? raw) {
    Map? json;
    if (raw is Map) {
      json = raw;
    } else if (raw is String && raw.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) json = decoded;
      } catch (_) {}
    }
    if (json == null) return defaultDesign;
    final decorations = json['decorations'];
    return CoverDesign(
      background: CoverBackground.fromJson(
        json['background'] is Map ? json['background'] as Map : null,
      ),
      bottomColor: coverColor(json['bottomColor'], redPacketRed),
      topHeight: _double(json['topHeight'], .80).clamp(.45, .92).toDouble(),
      receiptHeight: _double(
        json['receiptHeight'],
        .34,
      ).clamp(.12, .70).toDouble(),
      overlayColor: coverColor(
        json['overlayColor'],
        const Color(0x80000000),
      ),
      openColor: coverColor(json['openColor'], const Color(0xfff6e3b0)),
      openTextColor: coverColor(json['openTextColor'], const Color(0xffa8512f)),
      openLabel: json['openLabel']?.toString() ?? 'Mở',
      decorations: decorations is List
          ? [
              for (var index = 0; index < decorations.length; index++)
                if (decorations[index] is Map)
                  CoverDecoration.fromJson(
                    decorations[index] as Map,
                    index,
                  ),
            ]
          : const [],
      effects: CoverEffects.fromJson(
        json['effects'] is Map ? json['effects'] as Map : null,
      ),
    );
  }
}

double _double(Object? value, double fallback) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? fallback;

/// Parses `#rrggbb` or `#aarrggbb`; anything else falls back.
Color coverColor(Object? value, Color fallback) {
  final text = value?.toString().replaceFirst('#', '') ?? '';
  if (text.length == 6) {
    final parsed = int.tryParse(text, radix: 16);
    return parsed == null ? fallback : Color(0xff000000 | parsed);
  }
  if (text.length == 8) {
    final parsed = int.tryParse(text, radix: 16);
    return parsed == null ? fallback : Color(parsed);
  }
  return fallback;
}

/// `#aarrggbb`, the form the API stores.
String coverHex(Color color) =>
    '#${color.toARGB32().toRadixString(16).padLeft(8, '0')}';

/// A cover returned by the API, with the metadata the gallery needs.
class RedPacketCoverData {
  const RedPacketCoverData({
    required this.id,
    required this.name,
    this.description = '',
    this.design = CoverDesign.defaultDesign,
    this.status = 'DRAFT',
    this.claimCount = 0,
    this.designerId,
    this.designerName = '',
    this.designerAvatar,
    this.designerQchatId = '',
    this.selected = false,
    this.mine = false,
    this.owned = false,
  });

  final String id, name, description, status;
  final CoverDesign design;
  final int claimCount;
  final String? designerId, designerAvatar;
  final String designerName, designerQchatId;
  final bool selected, mine, owned;

  bool get published => status == 'PUBLISHED';

  RedPacketCoverData copyWith({
    String? name,
    String? description,
    CoverDesign? design,
    String? status,
    int? claimCount,
    bool? selected,
    bool? owned,
    bool? mine,
  }) => RedPacketCoverData(
    id: id,
    name: name ?? this.name,
    description: description ?? this.description,
    design: design ?? this.design,
    status: status ?? this.status,
    claimCount: claimCount ?? this.claimCount,
    designerId: designerId,
    designerName: designerName,
    designerAvatar: designerAvatar,
    designerQchatId: designerQchatId,
    selected: selected ?? this.selected,
    mine: mine ?? this.mine,
    owned: owned ?? this.owned,
  );

  static RedPacketCoverData? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final designer = raw['designer'] is Map
        ? Map<String, dynamic>.from(raw['designer'] as Map)
        : const <String, dynamic>{};
    final user = designer['user'] is Map
        ? Map<String, dynamic>.from(designer['user'] as Map)
        : const <String, dynamic>{};
    return RedPacketCoverData(
      id: raw['id']?.toString() ?? '',
      name: raw['name']?.toString() ?? '',
      description: raw['description']?.toString() ?? '',
      design: CoverDesign.fromJson(raw['design']),
      status: raw['status']?.toString() ?? 'DRAFT',
      claimCount: (raw['claimCount'] as num?)?.toInt() ?? 0,
      designerId: designer['userId']?.toString() ?? raw['designerId']?.toString(),
      designerName:
          designer['displayName']?.toString() ??
          user['nickname']?.toString() ??
          '',
      designerAvatar: user['avatarId']?.toString(),
      designerQchatId: user['qchatId']?.toString() ?? '',
      selected: raw['selected'] == true,
      mine: raw['mine'] == true,
      owned: raw['owned'] == true || raw['mine'] == true,
    );
  }

  /// The built-in cover every account owns.
  static RedPacketCoverData get defaultCover => const RedPacketCoverData(
    id: 'default',
    name: 'Mặc định',
    design: CoverDesign.defaultDesign,
    status: 'PUBLISHED',
    selected: true,
    mine: true,
    owned: true,
  );
}
