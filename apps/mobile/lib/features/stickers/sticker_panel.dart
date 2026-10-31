import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_view.dart';
import 'wechat_emoji.dart';

/// The composer's emoji and sticker panel.
///
/// Three tabs, like the reference: the bundled WeChat emoji, the stickers in
/// the user's own library, and the packs themselves. Stickers are sent straight
/// from the grid; the pack tab is where a new pack starts.
class StickerPanel extends ConsumerStatefulWidget {
  const StickerPanel({
    super.key,
    required this.onEmoji,
    required this.onSticker,
    required this.onOpenStudio,
    required this.safeBottom,
  });

  /// Receives a bracketed code such as `[微笑]` for the message text.
  final ValueChanged<String> onEmoji;
  final ValueChanged<Sticker> onSticker;

  /// Opens the studio, optionally on one pack or on the new-pack flow.
  final void Function({String? packId, bool create}) onOpenStudio;
  final double safeBottom;

  @override
  ConsumerState<StickerPanel> createState() => StickerPanelState();
}

class StickerPanelState extends ConsumerState<StickerPanel> {
  final tabs = const [
    'stickerTabEmoji',
    'stickerTabStickers',
    'stickerTabPacks',
  ];
  int tab = 0;
  StickerLibrary? library;
  bool loading = true;
  bool failed = false;
  String? busyPack;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    if (mounted) setState(() => loading = library == null);
    try {
      final next = await StickerApi(ref.read(clientProvider)).library();
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

  Future<void> addPack(StickerPack pack) async {
    if (busyPack != null) return;
    setState(() => busyPack = pack.id);
    try {
      await StickerApi(ref.read(clientProvider)).addToLibrary(pack.id);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerPackAdded'));
      await reload();
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busyPack = null);
    }
  }

  @override
  Widget build(BuildContext c) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 2, 8, 0),
        child: QChatTabBar(
          labels: [for (final tab in tabs) tr(c, tab)],
          index: tab,
          onChanged: (value) => setState(() => tab = value),
        ),
      ),
      Expanded(child: _body(c)),
    ],
  );

  Widget _body(BuildContext c) {
    if (tab == 0) return _emojiGrid();
    if (loading) return const Center(child: QChatLoading());
    if (failed || library == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tr(c, 'stickerLoadFailed'),
              style: TextStyle(fontSize: 13, color: qchatMuted(c)),
            ),
            const SizedBox(height: 10),
            QChatButton(tr(c, 'retry'), onTap: reload),
          ],
        ),
      );
    }
    return tab == 1 ? _stickerLibrary(c) : _packList(c);
  }

  Widget _emojiGrid() => GridView.builder(
    padding: EdgeInsets.fromLTRB(8, 6, 8, 8 + widget.safeBottom),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 9,
      mainAxisSpacing: 2,
      crossAxisSpacing: 2,
    ),
    itemCount: wechatEmojiSet.length,
    itemBuilder: (c, index) {
      final emoji = wechatEmojiSet[index];
      return Semantics(
        button: true,
        label: emoji.code,
        child: GestureDetector(
          key: ValueKey('wechat-emoji-${emoji.code}'),
          behavior: HitTestBehavior.opaque,
          onTap: () => widget.onEmoji(emoji.token),
          child: Center(
            child: Image.asset(
              emoji.asset,
              width: 30,
              height: 30,
              filterQuality: FilterQuality.medium,
              excludeFromSemantics: true,
            ),
          ),
        ),
      );
    },
  );

  Widget _stickerLibrary(BuildContext c) {
    final data = library!;
    final recent = data.recent;
    final all = data.all.take(140).toList();
    if (recent.isEmpty && all.isEmpty) {
      return _emptyLibrary(c);
    }
    return ListView(
      padding: EdgeInsets.fromLTRB(12, 10, 12, 12 + widget.safeBottom),
      children: [
        if (recent.isNotEmpty) ...[
          _sectionTitle(c, 'stickerRecent'),
          _grid(recent),
          const SizedBox(height: 10),
        ],
        Row(
          children: [
            _sectionTitle(c, 'stickerCustom'),
            const Spacer(),
            if (data.mine.isNotEmpty)
              _link(c, 'stickerManage', () => widget.onOpenStudio()),
          ],
        ),
        _grid(
          data.mine.expand((pack) => pack.stickers).toList(),
          leading: _addTile(c),
        ),
        const SizedBox(height: 10),
        _sectionTitle(c, 'stickerAll'),
        _grid(all),
      ],
    );
  }

  Widget _emptyLibrary(BuildContext c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const QChatIcon('emoji', size: 34, color: QChatColors.muted),
          const SizedBox(height: 8),
          Text(
            tr(c, 'stickerEmpty'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.4, color: qchatMuted(c)),
          ),
          const SizedBox(height: 12),
          QChatButton(
            tr(c, 'stickerCreatePack'),
            secondary: true,
            onTap: () => widget.onOpenStudio(create: true),
          ),
        ],
      ),
    ),
  );

  Widget _packList(BuildContext c) {
    final data = library!;
    return ListView(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 12 + widget.safeBottom),
      children: [
        Row(
          children: [
            _sectionTitle(c, 'stickerMyPacks'),
            const Spacer(),
            _link(c, 'stickerNewPack', () => widget.onOpenStudio(create: true)),
          ],
        ),
        if (data.mine.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              tr(c, 'stickerEmpty'),
              style: TextStyle(fontSize: 13, color: qchatMuted(c)),
            ),
          )
        else
          for (final pack in data.mine)
            _packRow(c, pack, mine: true),
        const SizedBox(height: 8),
        _sectionTitle(c, 'stickerMarket'),
        if (data.market.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              tr(c, 'stickerMarketEmpty'),
              style: TextStyle(fontSize: 13, color: qchatMuted(c)),
            ),
          )
        else
          for (final pack in data.market) _packRow(c, pack, mine: false),
      ],
    );
  }

  Widget _packRow(BuildContext c, StickerPack pack, {required bool mine}) {
    final cover = pack.coverMediaId;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: mine
          ? () => widget.onOpenStudio(packId: pack.id)
          : () => widget.onOpenStudio(packId: pack.id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: qchatFill(c).withValues(alpha: .45),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            SizedBox.square(
              dimension: 40,
              child: cover == null
                  ? const QChatIcon('emoji', size: 28)
                  : StickerView(mediaId: cover, size: 40),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pack.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: ink(c),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${pack.stickers.length} ${tr(c, 'stickerCount')}',
                    style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                  ),
                ],
              ),
            ),
            if (mine)
              Text(
                tr(c, 'edit'),
                style: const TextStyle(fontSize: 12.5, color: QChatColors.green),
              )
            else if (pack.added)
              Text(
                tr(c, 'stickerAdded'),
                style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
              )
            else
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: busyPack == null ? () => addPack(pack) : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: surface(c),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: busyPack == pack.id
                      ? const SizedBox.square(
                          dimension: 14,
                          child: QChatLoading(size: 14),
                        )
                      : Text(
                          tr(c, 'stickerAdd'),
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: QChatColors.green,
                          ),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext c, String key) => Padding(
    padding: const EdgeInsets.only(top: 6, bottom: 8),
    child: Text(
      tr(c, key),
      style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
    ),
  );

  Widget _link(BuildContext c, String key, VoidCallback onTap) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Text(
            tr(c, key),
            style: const TextStyle(fontSize: 12.5, color: QChatColors.green),
          ),
        ),
      );

  Widget _grid(List<Sticker> items, {Widget? leading}) => Wrap(
    spacing: 4,
    runSpacing: 4,
    children: [
      ?leading,
      for (final sticker in items) _stickerTile(sticker),
    ],
  );

  Widget _stickerTile(Sticker sticker) => GestureDetector(
    key: ValueKey('sticker-${sticker.id}'),
    behavior: HitTestBehavior.opaque,
    onTap: () => widget.onSticker(sticker),
    child: StickerView(mediaId: sticker.mediaId, size: 46),
  );

  Widget _addTile(BuildContext c) => GestureDetector(
    key: const ValueKey('sticker-add-studio'),
    behavior: HitTestBehavior.opaque,
    onTap: () => widget.onOpenStudio(create: true),
    child: Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        border: Border.all(color: qchatLine(c), width: .8),
        borderRadius: BorderRadius.circular(4),
      ),
      child: const Center(child: QChatIcon('plus', size: 22)),
    ),
  );
}
