/// A single sticker as the server stores it. The picture is a media row, so
/// the panel and a received bubble load it through the same cache.
class Sticker {
  const Sticker({
    required this.id,
    required this.mediaId,
    required this.label,
    required this.animated,
    required this.packId,
    required this.packName,
    required this.position,
  });

  final String id;
  final String mediaId;
  final String label;

  /// GIF artwork is served unchanged and animates in [MediaImage].
  final bool animated;
  final String packId;
  final String packName;
  final int position;

  factory Sticker.fromJson(Object? raw) {
    final json = raw is Map ? raw : const {};
    return Sticker(
      id: json['id']?.toString() ?? '',
      mediaId: json['mediaId']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      animated: json['animated'] == true,
      packId: json['packId']?.toString() ?? '',
      packName: json['packName']?.toString() ?? '',
      position: json['position'] is int ? json['position'] as int : 0,
    );
  }

  @override
  bool operator ==(Object other) => other is Sticker && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// A sticker album. `mine` packs are edited in the studio; `added` packs are in
/// the library and can be sent; a published pack can be added from the market.
class StickerPack {
  const StickerPack({
    required this.id,
    required this.name,
    required this.description,
    required this.coverMediaId,
    required this.avatarMediaId,
    required this.published,
    required this.mine,
    required this.added,
    required this.ownerName,
    required this.stickers,
  });

  final String id;
  final String name;
  final String description;
  final String? coverMediaId;

  /// The square picture shown in the library list. Falls back to [coverMediaId]
  /// and then to the first sticker when the owner has not picked one.
  final String? avatarMediaId;
  final bool published;
  final bool mine;
  final bool added;
  final String ownerName;
  final List<Sticker> stickers;

  factory StickerPack.fromJson(Object? raw) {
    final json = raw is Map ? raw : const {};
    final cover = json['coverMediaId']?.toString() ?? '';
    final avatar = json['avatarMediaId']?.toString() ?? '';
    return StickerPack(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      coverMediaId: cover.isEmpty ? null : cover,
      avatarMediaId: avatar.isEmpty ? null : avatar,
      published: json['published'] == true,
      mine: json['mine'] == true,
      added: json['added'] == true,
      ownerName: json['ownerName']?.toString() ?? '',
      stickers: [
        for (final item
            in (json['stickers'] is List ? json['stickers'] as List : const []))
          Sticker.fromJson(item),
      ],
    );
  }

  StickerPack copyWith({bool? published}) => StickerPack(
    id: id,
    name: name,
    description: description,
    coverMediaId: coverMediaId,
    avatarMediaId: avatarMediaId,
    published: published ?? this.published,
    mine: mine,
    added: added,
    ownerName: ownerName,
    stickers: stickers,
  );
}

/// Everything the sticker panel and the studio need in one round trip.
class StickerLibrary {
  const StickerLibrary({
    this.packs = const [],
    this.market = const [],
    this.recent = const [],
  });

  final List<StickerPack> packs;
  final List<StickerPack> market;
  final List<Sticker> recent;

  factory StickerLibrary.fromJson(Object? raw) {
    final json = raw is Map ? raw : const {};
    List<T> list<T>(String key, T Function(Object?) build) => [
      for (final item in (json[key] is List ? json[key] as List : const []))
        build(item),
    ];
    return StickerLibrary(
      packs: list('packs', StickerPack.fromJson),
      market: list('market', StickerPack.fromJson),
      recent: list('recent', Sticker.fromJson),
    );
  }

  List<Sticker> get all {
    final seen = <String>{};
    return [
      for (final pack in packs)
        for (final sticker in pack.stickers)
          if (seen.add(sticker.id)) sticker,
    ];
  }

  List<StickerPack> get mine => [
    for (final pack in packs)
      if (pack.mine) pack,
  ];
}
