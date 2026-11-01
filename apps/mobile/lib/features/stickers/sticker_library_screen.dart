import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_view.dart';

/// "Thư viện nhãn dán": the sticker gallery reached from the composer.
///
/// It lists sticker packs under one heading — the user's own selection first,
/// then the market — with no tab switcher. The bundled WeChat emoji stay in the
/// panel. A pack opens in [StickerPackScreen]; "Thêm" copies it into the user's
/// library.
class StickerLibraryScreen extends ConsumerStatefulWidget {
  const StickerLibraryScreen({super.key});

  @override
  ConsumerState<StickerLibraryScreen> createState() =>
      _StickerLibraryScreenState();
}

class _StickerLibraryScreenState extends ConsumerState<StickerLibraryScreen> {
  StickerLibrary? library;
  bool loading = true;
  bool failed = false;
  String? busyPack;
  String query = '';
  final search = TextEditingController();

  StickerApi get _api => StickerApi(ref.read(clientProvider));

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final next = await _api.library();
      if (!mounted) return;
      setState(() {
        library = next;
        loading = false;
        failed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        failed = library == null;
      });
    }
  }

  Future<void> _add(StickerPack pack) async {
    if (busyPack != null) return;
    setState(() => busyPack = pack.id);
    try {
      await _api.addToLibrary(pack.id);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerPackAdded'));
      await _load();
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busyPack = null);
    }
  }

  List<StickerPack> get _packs {
    final data = library;
    if (data == null) return const [];
    final seen = <String>{};
    final all = [...data.packs, ...data.market];
    final needle = _fold(query.trim());
    return [
      for (final pack in all)
        if (seen.add(pack.id) && _matches(pack, needle)) pack,
    ];
  }

  /// A pack answers to its name, its owner and the labels on its stickers, so
  /// "cười" finds a pack whose stickers are named that even when the pack name
  /// does not mention it. Both sides are folded, so typing "meo" still finds
  /// "Mèo".
  bool _matches(StickerPack pack, String needle) {
    if (needle.isEmpty) return true;
    if (_fold(pack.name).contains(needle) ||
        _fold(pack.ownerName).contains(needle)) {
      return true;
    }
    return pack.stickers.any(
      (sticker) => _fold(sticker.label).contains(needle),
    );
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    edgeToEdge: false,
    background: qchatBackground(c),
    child: Column(
      children: [
        _header(c),
        Expanded(
          child: loading && library == null
              ? const QChatLoading()
              : failed && library == null
              ? QChatError(error: tr(c, 'networkError'), retry: _load)
              : QChatRefresh(onRefresh: _load, child: _body(c)),
        ),
      ],
    ),
  );

  // ---------------------------------------------------------------------------
  // Header: back chevron, the section title and the centred search field
  // ---------------------------------------------------------------------------

  Widget _header(BuildContext c) => Container(
    color: qchatBackground(c),
    child: Column(
      children: [
        Row(
          children: [
            QChatIconButton(
              'back',
              label: tr(c, 'back'),
              size: 22,
              onTap: () => c.pop(),
            ),
            Expanded(
              child: Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.only(left: 2),
                  child: Text(
                    tr(c, 'stickerTabSelected'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: ink(c),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
          child: _searchField(c),
        ),
      ],
    ),
  );

  Widget _searchField(BuildContext c) => Container(
    width: double.infinity,
    height: 46,
    decoration: BoxDecoration(
      color: qchatSurface(c),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Stack(
      alignment: Alignment.center,
      children: [
        // The field fills the pill, so a tap on its edge focuses it too.
        Positioned.fill(
          child: CupertinoTextField(
            controller: search,
            onChanged: (value) => setState(() => query = value),
            textAlign: TextAlign.center,
            padding: const EdgeInsets.symmetric(horizontal: 42, vertical: 11),
            decoration: const BoxDecoration(),
            cursorColor: QChatColors.green,
            style: TextStyle(fontSize: 15, color: ink(c)),
          ),
        ),
        if (query.isEmpty)
          const IgnorePointer(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                QChatIcon('search', size: 19, color: QChatColors.muted),
                SizedBox(width: 7),
                _SearchHint(),
              ],
            ),
          )
        else
          Positioned(
            right: 4,
            child: GestureDetector(
              key: const ValueKey('sticker-search-clear'),
              behavior: HitTestBehavior.opaque,
              onTap: _clearSearch,
              child: const Padding(
                padding: EdgeInsets.all(9),
                child: QChatIcon('close', size: 17, color: QChatColors.muted),
              ),
            ),
          ),
      ],
    ),
  );

  void _clearSearch() {
    search.clear();
    setState(() => query = '');
  }

  // ---------------------------------------------------------------------------
  // Body: banner carousel and the pack rows
  // ---------------------------------------------------------------------------

  Widget _body(BuildContext c) {
    final packs = _packs;
    final banners = packs
        .where((pack) => _coverOf(pack) != null)
        .take(8)
        .toList();
    return ListView(
      padding: EdgeInsets.only(bottom: 34 + MediaQuery.paddingOf(c).bottom),
      children: [
        if (banners.isNotEmpty && query.trim().isEmpty) _banners(c, banners),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 10),
          child: Text(
            tr(c, 'stickerSelection'),
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: ink(c),
            ),
          ),
        ),
        if (packs.isEmpty)
          QChatEmptyState(tr(c, 'stickerEmpty'), icon: 'emoji')
        else
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: qchatSurface(c),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                for (var i = 0; i < packs.length; i++) ...[
                  _row(c, packs[i]),
                  if (i < packs.length - 1)
                    Container(
                      height: .5,
                      margin: const EdgeInsets.only(left: 90, right: 12),
                      color: qchatLine(c),
                    ),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _banners(BuildContext c, List<StickerPack> packs) => SizedBox(
    height: 172,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(12, 2, 12, 2),
      itemCount: packs.length,
      separatorBuilder: (_, _) => const SizedBox(width: 10),
      itemBuilder: (c, index) {
        final pack = packs[index];
        final artwork = _coverOf(pack);
        return GestureDetector(
          key: ValueKey('sticker-banner-${pack.id}'),
          behavior: HitTestBehavior.opaque,
          onTap: () => _open(pack),
          child: Container(
            width: MediaQuery.sizeOf(c).width * .85,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: const Color(0xff1c1c1c),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                MediaImage(id: artwork!, fit: BoxFit.cover),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color(0x33000000),
                        Color(0x00000000),
                        Color(0x8c000000),
                      ],
                      stops: [0, .5, 1],
                    ),
                  ),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const QChatIcon(
                        'stickerV',
                        size: 14,
                        color: QChatColors.white,
                      ),
                      const SizedBox(width: 5),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 200),
                        child: Text(
                          pack.ownerName.isEmpty
                              ? tr(c, 'stickers')
                              : pack.ownerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: QChatColors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  left: 14,
                  right: 14,
                  bottom: 12,
                  child: Text(
                    pack.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w600,
                      color: QChatColors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  );

  Widget _row(BuildContext c, StickerPack pack) {
    final avatar = pack.avatarMediaId ?? pack.coverMediaId;
    final fallback = _firstArtwork(pack);
    final busy = busyPack == pack.id;
    final added = pack.mine || pack.added;
    return GestureDetector(
      key: ValueKey('sticker-pack-${pack.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(pack),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                color: qchatFill(c),
                child: avatar != null
                    ? MediaImage(id: avatar, fit: BoxFit.cover)
                    : fallback != null
                    ? StickerView(mediaId: fallback, size: 54)
                    : QChatIcon('emoji', size: 30, color: ink(c)),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pack.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 16.5, color: ink(c)),
                  ),
                  if (!pack.mine && pack.ownerName.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      pack.ownerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: qchatMuted(c)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (added)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  tr(c, 'stickerAdded'),
                  style: TextStyle(fontSize: 15, color: qchatMuted(c)),
                ),
              )
            else
              GestureDetector(
                key: ValueKey('sticker-add-${pack.id}'),
                behavior: HitTestBehavior.opaque,
                onTap: busyPack == null ? () => _add(pack) : null,
                child: Container(
                  width: 78,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: qchatFill(c),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: busy
                      ? const QChatLoading(size: 15, color: QChatColors.green)
                      : Text(
                          tr(c, 'stickerAdd'),
                          style: TextStyle(fontSize: 15, color: ink(c)),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// The wide banner of a pack: its cover, then its avatar, then its first
  /// sticker so a fresh pack still shows something.
  String? _coverOf(StickerPack pack) =>
      pack.coverMediaId ?? pack.avatarMediaId ?? _firstArtwork(pack);

  String? _firstArtwork(StickerPack pack) {
    for (final sticker in pack.stickers) {
      if (sticker.mediaId.isNotEmpty) return sticker.mediaId;
    }
    return null;
  }

  void _open(StickerPack pack) {
    context.push<void>('/stickers/${pack.id}').then((_) {
      if (mounted) _load();
    });
  }
}

class _SearchHint extends StatelessWidget {
  const _SearchHint();

  @override
  Widget build(BuildContext context) => Text(
    tr(context, 'stickerSearchHint'),
    style: const TextStyle(fontSize: 15, color: QChatColors.muted),
  );
}

/// Vietnamese letters without their marks. Search folds both the query and the
/// pack text through this, because people type "meo" far more often than "mèo".
const _accents = <String, String>{
  'a': 'àáạảãâầấậẩẫăằắặẳẵ',
  'd': 'đ',
  'e': 'èéẹẻẽêềếệểễ',
  'i': 'ìíịỉĩ',
  'o': 'òóọỏõôồốộổỗơờớợởỡ',
  'u': 'ùúụủũưừứựửữ',
  'y': 'ỳýỵỷỹ',
};

final Map<String, String> _plainLetters = {
  for (final entry in _accents.entries)
    for (final rune in entry.value.runes) String.fromCharCode(rune): entry.key,
};

String _fold(String value) {
  final buffer = StringBuffer();
  for (final rune in value.toLowerCase().runes) {
    final char = String.fromCharCode(rune);
    buffer.write(_plainLetters[char] ?? char);
  }
  return buffer.toString();
}
