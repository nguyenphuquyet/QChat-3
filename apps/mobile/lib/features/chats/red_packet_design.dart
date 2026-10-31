import 'dart:convert';
import 'package:flutter/widgets.dart';

/// Red of the default red-packet cover. Custom covers can paint their own
/// background, but this is the colour QChat uses everywhere a cover is not
/// configured (the chat bubble, the default design, the gold open button).
const redPacketRed = Color(0xffd93b30);

/// Gold at the head of a red-packet message. It is the colour the chat uses
/// when the sender picked no cover, so both paths start from the same warm
/// gold instead of two slightly different oranges.
const redPacketGold = Color(0xfff5a83a);

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
    x: _double(json?['x'], .5).clamp(-.2, 1.2).toDouble(),
    y: _double(json?['y'], .3).clamp(-.2, 1.2).toDouble(),
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
    this.imageScale = 1,
    this.imageOffsetX = 0,
    this.imageOffsetY = 0,
  });

  /// `solid`, `gradient`, `image` or `video`.
  ///
  /// `image` is a still photo and `video` is the only animated form a cover
  /// accepts: a short, silent MP4/H.264 loop, the same container WeChat uses, so
  /// iOS, Android and web all play it. Every picture fills the flap edge to
  /// edge, so a designer never sees letterboxing.
  final String type;
  final Color color;
  final List<Color> colors;
  final String? mediaId;

  /// How the picture sits inside the flap, so a designer can frame a face or a
  /// detail instead of living with the automatic centre crop.
  ///
  /// [imageScale] is the zoom (1 = cover the flap, 3 = three times closer) and
  /// the offsets are fractions of the flap's width and height: dragging the
  /// preview writes them, and the renderer clamps them so an edge never shows.
  final double imageScale, imageOffsetX, imageOffsetY;

  bool get isVideo => type == 'video' && (mediaId ?? '').isNotEmpty;
  bool get isImage =>
      (type == 'image' || type == 'gif') && (mediaId ?? '').isNotEmpty;
  bool get hasMedia => isImage || isVideo;

  /// Whether the designer has moved or zoomed the picture away from its
  /// automatic centre crop.
  bool get hasMediaCrop =>
      imageScale != 1 || imageOffsetX != 0 || imageOffsetY != 0;

  CoverBackground copyWith({
    String? type,
    Color? color,
    List<Color>? colors,
    String? mediaId,
    double? imageScale,
    double? imageOffsetX,
    double? imageOffsetY,
  }) => CoverBackground(
    type: type ?? this.type,
    color: color ?? this.color,
    colors: colors ?? this.colors,
    mediaId: mediaId ?? this.mediaId,
    imageScale: imageScale ?? this.imageScale,
    imageOffsetX: imageOffsetX ?? this.imageOffsetX,
    imageOffsetY: imageOffsetY ?? this.imageOffsetY,
  );

  /// Resets the picture to its automatic centre crop, keeping the file.
  CoverBackground withCentredMedia() =>
      copyWith(imageScale: 1, imageOffsetX: 0, imageOffsetY: 0);

  Map<String, dynamic> toJson() => {
    'type': type,
    'color': coverHex(color),
    'colors': colors.map(coverHex).toList(),
    if ((mediaId ?? '').isNotEmpty) 'mediaId': mediaId,
    if (imageScale != 1) 'imageScale': imageScale,
    if (imageOffsetX != 0) 'imageOffsetX': imageOffsetX,
    if (imageOffsetY != 0) 'imageOffsetY': imageOffsetY,
  };

  static CoverBackground fromJson(Map? json) {
    final rawType = json?['type']?.toString() ?? 'solid';
    // `gif` and `mp4` are read from covers saved before covers required a
    // single video form; `mp4` is the same design as `video`.
    final raw = rawType == 'mp4' ? 'video' : rawType;
    final type =
        const ['solid', 'gradient', 'image', 'gif', 'video'].contains(raw)
        ? raw
        : 'solid';
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
      imageScale: coverScale(json?['imageScale']),
      imageOffsetX: coverOffset(json?['imageOffsetX']),
      imageOffsetY: coverOffset(json?['imageOffsetY']),
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

/// Everything a designer can change about the red-packet bubble in the chat.
///
/// The message is edited separately from the cover: its own picture and its own
/// gold wash, so a packet can wear a cover photo on the packet and a different
/// picture (or none) in the conversation. The picture fades in from the gold
/// head and the tail keeps a light gold tint, so the greeting stays readable.
class CoverMessage {
  const CoverMessage({
    this.imageId,
    this.startColor = redPacketGold,
    this.endColor = const Color(0xfff7c65a),
    this.imageScale = 1,
    this.imageOffsetX = 0,
    this.imageOffsetY = 0,
  });

  /// Media id of the picture shown inside the bubble. The cover background is
  /// deliberately not reused here.
  final String? imageId;

  /// Gold at the head of the bubble, where the greeting sits.
  final Color startColor;

  /// Gold at the tail of the bubble. Keep it warm, so the card still reads as
  /// a red packet after the picture.
  final Color endColor;

  /// Framing of [imageId] inside the bubble. A chat card is short and wide, so
  /// the automatic crop often cuts a face in half; the designer can drag the
  /// picture in the studio preview to choose the part that shows.
  final double imageScale, imageOffsetX, imageOffsetY;

  bool get hasImage => (imageId ?? '').isNotEmpty;

  bool get hasImageCrop =>
      imageScale != 1 || imageOffsetX != 0 || imageOffsetY != 0;

  CoverMessage copyWith({
    String? imageId,
    Color? startColor,
    Color? endColor,
    double? imageScale,
    double? imageOffsetX,
    double? imageOffsetY,
  }) => CoverMessage(
    imageId: imageId ?? this.imageId,
    startColor: startColor ?? this.startColor,
    endColor: endColor ?? this.endColor,
    imageScale: imageScale ?? this.imageScale,
    imageOffsetX: imageOffsetX ?? this.imageOffsetX,
    imageOffsetY: imageOffsetY ?? this.imageOffsetY,
  );

  /// Sets or clears the picture. [copyWith] keeps the old id, so removing the
  /// picture goes through this method instead. A new picture starts centred,
  /// because the old framing belonged to the old file.
  CoverMessage withImage(String? id) =>
      CoverMessage(imageId: id, startColor: startColor, endColor: endColor);

  /// Resets the picture to its automatic crop, keeping the file.
  CoverMessage withCentredImage() =>
      copyWith(imageScale: 1, imageOffsetX: 0, imageOffsetY: 0);

  Map<String, dynamic> toJson() => {
    if ((imageId ?? '').isNotEmpty) 'imageId': imageId,
    'startColor': coverHex(startColor),
    'endColor': coverHex(endColor),
    if (imageScale != 1) 'imageScale': imageScale,
    if (imageOffsetX != 0) 'imageOffsetX': imageOffsetX,
    if (imageOffsetY != 0) 'imageOffsetY': imageOffsetY,
  };

  static CoverMessage fromJson(Map? json) => CoverMessage(
    imageId: json?['imageId']?.toString(),
    startColor: coverColor(json?['startColor'], redPacketGold),
    endColor: coverColor(json?['endColor'], const Color(0xfff7c65a)),
    imageScale: coverScale(json?['imageScale']),
    imageOffsetX: coverOffset(json?['imageOffsetX']),
    imageOffsetY: coverOffset(json?['imageOffsetY']),
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
    this.archLine = true,
    this.overlayColor = const Color(0x80000000),
    this.openColor = const Color(0xfff6e3b0),
    this.openTextColor = const Color(0xffa8512f),
    this.openLabel = 'Mở',
    this.decorations = const [],
    this.effects = const CoverEffects(),
    this.message = const CoverMessage(),
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

  /// Whether the hairline seam between the flap and the body is drawn. Turning
  /// it off leaves the cover flat, as if only the lower half were showing.
  final bool archLine;

  /// Scrim shown behind the popup when the cover is tapped.
  final Color overlayColor;

  final Color openColor, openTextColor;
  final String openLabel;
  final List<CoverDecoration> decorations;
  final CoverEffects effects;

  /// The chat bubble wears this, independent of the cover's own background.
  final CoverMessage message;

  static const CoverDesign defaultDesign = CoverDesign();

  CoverDesign copyWith({
    CoverBackground? background,
    Color? bottomColor,
    double? topHeight,
    double? receiptHeight,
    bool? archLine,
    Color? overlayColor,
    Color? openColor,
    Color? openTextColor,
    String? openLabel,
    List<CoverDecoration>? decorations,
    CoverEffects? effects,
    CoverMessage? message,
  }) => CoverDesign(
    background: background ?? this.background,
    bottomColor: bottomColor ?? this.bottomColor,
    topHeight: topHeight ?? this.topHeight,
    receiptHeight: receiptHeight ?? this.receiptHeight,
    archLine: archLine ?? this.archLine,
    overlayColor: overlayColor ?? this.overlayColor,
    openColor: openColor ?? this.openColor,
    openTextColor: openTextColor ?? this.openTextColor,
    openLabel: openLabel ?? this.openLabel,
    decorations: decorations ?? this.decorations,
    effects: effects ?? this.effects,
    message: message ?? this.message,
  );

  Map<String, dynamic> toJson() => {
    'background': background.toJson(),
    'bottomColor': coverHex(bottomColor),
    'topHeight': topHeight,
    'receiptHeight': receiptHeight,
    'archLine': archLine,
    'overlayColor': coverHex(overlayColor),
    'openColor': coverHex(openColor),
    'openTextColor': coverHex(openTextColor),
    'openLabel': openLabel,
    'decorations': decorations.map((item) => item.toJson()).toList(),
    'effects': effects.toJson(),
    'message': message.toJson(),
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
      archLine: json['archLine'] != false,
      overlayColor: coverColor(json['overlayColor'], const Color(0x80000000)),
      openColor: coverColor(json['openColor'], const Color(0xfff6e3b0)),
      openTextColor: coverColor(json['openTextColor'], const Color(0xffa8512f)),
      openLabel: json['openLabel']?.toString() ?? 'Mở',
      decorations: decorations is List
          ? [
              for (var index = 0; index < decorations.length; index++)
                if (decorations[index] is Map)
                  CoverDecoration.fromJson(decorations[index] as Map, index),
            ]
          : const [],
      effects: CoverEffects.fromJson(
        json['effects'] is Map ? json['effects'] as Map : null,
      ),
      message: CoverMessage.fromJson(
        json['message'] is Map ? json['message'] as Map : null,
      ),
    );
  }
}

double _double(Object? value, double fallback) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? fallback;

/// Zoom of a picture inside the flap or bubble. One means "cover the frame";
/// the renderer never lets it drop below that, so no edge can show.
double coverScale(Object? value) => _double(value, 1).clamp(1, 3).toDouble();

/// Normalised pan of a picture, as a fraction of the frame. The renderer clamps
/// it further against the real crop, so a saved value can never expose a gap.
double coverOffset(Object? value) => _double(value, 0).clamp(-1, 1).toDouble();

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
      designerId:
          designer['userId']?.toString() ?? raw['designerId']?.toString(),
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
