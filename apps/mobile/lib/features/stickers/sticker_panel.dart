import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_view.dart';
import 'wechat_emoji.dart';

/// The composer's emoji and sticker panel, laid out like the reference app.
///
/// A row of icons — search, emoji, recent stickers, custom stickers — sits
/// under the composer, and every pack in the library follows it with its own
/// avatar, so a pack is one tap away instead of a trip through the library.
/// The content sits below the row. Backspace and send float over the
/// bottom-right corner of the content, because the keyboard is closed while the
/// panel is open.
class StickerPanel extends ConsumerStatefulWidget {
  const StickerPanel({
    super.key,
    required this.onEmoji,
    required this.onSticker,
    required this.onOpenStudio,
    required this.onOpenLibrary,
    this.onBackspace,
    this.onSend,
    this.canSend = false,
    required this.safeBottom,
  });

  /// Receives a bracketed code such as `[微笑]` for the message text.
  final ValueChanged<String> onEmoji;
  final ValueChanged<Sticker> onSticker;

  /// Opens the studio, optionally on one pack or on the new-pack flow.
  final void Function({String? packId, bool create}) onOpenStudio;

  /// Opens the full sticker library.
  final VoidCallback onOpenLibrary;

  /// Deletes one character from the composer.
  final VoidCallback? onBackspace;
  final VoidCallback? onSend;
  final bool canSend;
  final double safeBottom;

  @override
  ConsumerState<StickerPanel> createState() => StickerPanelState();
}

class StickerPanelState extends ConsumerState<StickerPanel> {
  static const _recentEmojiKey = 'sticker:recentEmoji';

  /// The four fixed tabs: 0 search, 1 emoji, 2 recent stickers, 3 custom
  /// stickers. From here on each tab is one pack of the library, in order.
  static const _packTabStart = 4;

  int tab = 1;
  StickerLibrary? library;
  bool loading = true;
  bool failed = false;
  String query = '';
  final search = TextEditingController();
  final recentEmoji = <String>[];

  List<StickerPack> get _packs => library?.packs ?? const <StickerPack>[];

  /// The pack whose tab is open, or null when the library has changed under it.
  StickerPack? get _openPack {
    final index = tab - _packTabStart;
    final packs = _packs;
    return index >= 0 && index < packs.length ? packs[index] : null;
  }

  @override
  void initState() {
    super.initState();
    reload();
    _loadRecentEmoji();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _loadRecentEmoji() async {
    try {
      final saved = await SharedPreferences.getInstance();
      final stored = saved.getStringList(_recentEmojiKey);
      if (!mounted || stored == null) return;
      final known = {for (final emoji in wechatEmojiSet) emoji.code};
      setState(() {
        recentEmoji
          ..clear()
          ..addAll(stored.where(known.contains));
      });
    } catch (_) {
      // The recent strip is a convenience; a storage failure is harmless.
    }
  }

  Future<void> _rememberEmoji(String code) async {
    if (mounted) {
      setState(() {
        recentEmoji
          ..remove(code)
          ..insert(0, code);
        if (recentEmoji.length > 16) {
          recentEmoji.removeRange(16, recentEmoji.length);
        }
      });
    }
    try {
      final saved = await SharedPreferences.getInstance();
      await saved.setStringList(_recentEmojiKey, recentEmoji);
    } catch (_) {
      // Keep the in-memory strip even when the write fails.
    }
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
        // A pack can be removed while it is the open tab; fall back to the
        // custom sticker tab rather than showing nothing.
        if (tab >= _packTabStart + next.packs.length) tab = 3;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        failed = library == null;
      });
    }
  }

  double get _contentBottom => 66 + widget.safeBottom;

  @override
  // The panel paints no surface of its own: in the chat it sits inside the
  // composer's QChatGlass, and an opaque fill here would hide the blur and the
  // messages sliding under it.
  Widget build(BuildContext c) => Column(
    children: [
      _iconRow(c),
      Container(height: .5, color: qchatLine(c)),
      Expanded(
        child: Stack(
          children: [
            Positioned.fill(
              child: Column(
                children: [
                  const _DragHandle(),
                  Expanded(child: _content(c)),
                ],
              ),
            ),
            if (tab == 1)
              Positioned(
                right: 14,
                bottom: 10 + widget.safeBottom,
                child: _floatingActions(c),
              ),
          ],
        ),
      ),
    ],
  );

  Widget _content(BuildContext c) {
    if (tab == 0) return _searchTab(c);
    if (tab == 1) return _emojiTab(c);
    if (tab == 2) return _recentTab(c);
    final pack = _openPack;
    return pack == null ? _customTab(c) : _packTab(c, pack);
  }

  // ---------------------------------------------------------------------------
  // Tab 0: search
  // ---------------------------------------------------------------------------

  Widget _searchTab(BuildContext c) {
    final data = library;
    final needle = query.trim().toLowerCase();
    final results = data == null
        ? const <Sticker>[]
        : (needle.isEmpty
                  ? data.all.take(18)
                  : data.all.where(
                      (sticker) =>
                          sticker.label.toLowerCase().contains(needle) ||
                          sticker.packName.toLowerCase().contains(needle),
                    ))
              .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 6),
          child: QChatSearchField(
            controller: search,
            hintText: tr(c, 'stickerSearchHint'),
            onChanged: (value) => setState(() => query = value),
          ),
        ),
        Expanded(
          child: loading && data == null
              ? const Center(child: QChatLoading())
              : failed && data == null
              ? _failure(c)
              : results.isEmpty
              ? Center(
                  child: Text(
                    tr(c, 'stickerNoResults'),
                    style: TextStyle(fontSize: 13, color: qchatMuted(c)),
                  ),
                )
              : ListView(
                  padding: EdgeInsets.fromLTRB(14, 4, 14, _contentBottom),
                  children: [_stickerGrid(results, columns: 4, size: 58)],
                ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Tab 1: emoji
  // ---------------------------------------------------------------------------

  Widget _emojiTab(BuildContext c) {
    final recent = [
      for (final code in recentEmoji)
        for (final emoji in wechatEmojiSet)
          if (emoji.code == code) emoji,
    ];
    return ListView(
      padding: EdgeInsets.fromLTRB(16, 10, 16, _contentBottom),
      children: [
        if (recent.isNotEmpty) ...[
          _sectionTitle(c, 'stickerRecent'),
          // One row only: the strip is a shortcut, and a second row would push
          // the whole set down every time one more emoji is used.
          _emojiGrid(recent.take(7).toList(), size: 36),
          const SizedBox(height: 18),
        ],
        _sectionTitle(c, 'stickerAll'),
        _emojiGrid(wechatEmojiSet, size: 34),
      ],
    );
  }

  Widget _emojiGrid(List<WeChatEmoji> emoji, {required double size}) =>
      GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 7,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
        ),
        itemCount: emoji.length,
        itemBuilder: (c, index) {
          final item = emoji[index];
          return Semantics(
            button: true,
            label: item.code,
            child: GestureDetector(
              key: ValueKey('wechat-emoji-${item.code}'),
              behavior: HitTestBehavior.opaque,
              onTap: () {
                widget.onEmoji(item.token);
                _rememberEmoji(item.code);
              },
              child: Center(
                child: Image.asset(
                  item.asset,
                  width: size,
                  height: size,
                  filterQuality: FilterQuality.medium,
                  excludeFromSemantics: true,
                ),
              ),
            ),
          );
        },
      );

  // ---------------------------------------------------------------------------
  // Tab 2: recently used stickers
  // ---------------------------------------------------------------------------

  Widget _recentTab(BuildContext c) {
    if (loading && library == null) return const Center(child: QChatLoading());
    if (failed && library == null) return _failure(c);
    final recent = library?.recent ?? const <Sticker>[];
    if (recent.isEmpty) return _emptyRecent(c);
    return ListView(
      padding: EdgeInsets.fromLTRB(14, 8, 14, _contentBottom),
      children: [_stickerGrid(recent, columns: 4, size: 66)],
    );
  }

  Widget _emptyRecent(BuildContext c) => Center(
    child: Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, _contentBottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const QChatIcon('heart', size: 32, color: QChatColors.muted),
          const SizedBox(height: 10),
          Text(
            tr(c, 'stickerEmpty'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.4, color: qchatMuted(c)),
          ),
          const SizedBox(height: 12),
          _link(c, 'stickerMore', widget.onOpenLibrary, arrow: true),
        ],
      ),
    ),
  );

  // ---------------------------------------------------------------------------
  // Tab 3: custom stickers
  // ---------------------------------------------------------------------------

  Widget _customTab(BuildContext c) {
    if (loading && library == null) return const Center(child: QChatLoading());
    if (failed && library == null) return _failure(c);
    final mine =
        library?.mine.expand((pack) => pack.stickers).toList() ??
        const <Sticker>[];
    if (mine.isEmpty) return _recordEmpty(c);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 14, 2),
          child: Row(
            children: [
              Text(
                tr(c, 'stickerCustom'),
                style: TextStyle(fontSize: 15.5, color: ink(c)),
              ),
              const Spacer(),
              _link(c, 'stickerMore', widget.onOpenLibrary, arrow: true),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(14, 6, 14, _contentBottom),
            children: [
              _stickerGrid(mine, columns: 4, size: 62, leading: _addTile(c)),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // One tab per sticker pack in the library
  // ---------------------------------------------------------------------------

  /// The stickers of [pack], shown under the pack's own icon in the row. A tap
  /// sends the sticker straight away, like the custom sticker tab.
  Widget _packTab(BuildContext c, StickerPack pack) {
    if (loading && library == null) return const Center(child: QChatLoading());
    if (failed && library == null) return _failure(c);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 14, 2),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  pack.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15.5, color: ink(c)),
                ),
              ),
              const SizedBox(width: 10),
              _link(c, 'stickerMore', widget.onOpenLibrary, arrow: true),
            ],
          ),
        ),
        Expanded(
          child: pack.stickers.isEmpty
              ? Center(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(24, 10, 24, _contentBottom),
                    child: Text(
                      tr(c, 'stickerEmpty'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        height: 1.45,
                        color: qchatMuted(c),
                      ),
                    ),
                  ),
                )
              : ListView(
                  padding: EdgeInsets.fromLTRB(14, 6, 14, _contentBottom),
                  children: [
                    _stickerGrid(
                      pack.stickers,
                      columns: 4,
                      size: 62,
                      keyPrefix: 'sticker-pack-sticker',
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _recordEmpty(BuildContext c) => Center(
    child: SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 10, 24, _contentBottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            key: const ValueKey('sticker-record'),
            behavior: HitTestBehavior.opaque,
            onTap: () => widget.onOpenStudio(create: true),
            child: SizedBox.square(
              dimension: 118,
              child: CustomPaint(
                painter: _DashedBorderPainter(color: qchatMuted(c), radius: 10),
                child: Center(
                  child: QChatIcon('camera', size: 40, color: ink(c)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            tr(c, 'stickerRecord'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: ink(c)),
          ),
          const SizedBox(height: 10),
          Text(
            tr(c, 'stickerRecordNote'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, height: 1.45, color: qchatMuted(c)),
          ),
        ],
      ),
    ),
  );

  // ---------------------------------------------------------------------------
  // Icons and floating actions
  // ---------------------------------------------------------------------------

  Widget _iconRow(BuildContext c) {
    final packs = _packs;
    // The row scrolls sideways once the packs outgrow the width, so adding a
    // pack never pushes the emoji tab out of reach. It always spans the panel,
    // so the first tab stays at the leading edge instead of drifting inward.
    return SizedBox(
      width: double.infinity,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Row(
          children: [
            _tabButton(c, 0, 'search', tr(c, 'stickerSearchHint')),
            const SizedBox(width: 14),
            _tabButton(c, 1, 'emoji', tr(c, 'stickerTabEmoji')),
            const SizedBox(width: 14),
            _tabButton(c, 2, 'heart', tr(c, 'stickerRecent')),
            const SizedBox(width: 14),
            _tabButton(c, 3, 'stickerV', tr(c, 'stickerCustom')),
            for (var i = 0; i < packs.length; i++) ...[
              const SizedBox(width: 14),
              _packButton(c, _packTabStart + i, packs[i]),
            ],
          ],
        ),
      ),
    );
  }

  /// A library pack's own place in the row: its square picture, like the pack
  /// icons the reference app puts after the emoji and favourite tabs.
  Widget _packButton(BuildContext c, int index, StickerPack pack) {
    final selected = tab == index;
    final avatar = pack.avatarMediaId ?? pack.coverMediaId;
    final fallback = _firstArtwork(pack);
    return Semantics(
      button: true,
      selected: selected,
      label: pack.name,
      child: GestureDetector(
        key: ValueKey('sticker-pack-tab-${pack.id}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => tab = index),
        child: Container(
          width: 46,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? qchatSurface(c) : QChatColors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              width: 30,
              height: 30,
              child: avatar != null
                  ? MediaImage(
                      id: avatar,
                      fit: BoxFit.cover,
                      // A broken avatar must not eat the tap: the tab stays
                      // usable and falls back to the emoji glyph.
                      errorWidget: Center(
                        child: QChatIcon('emoji', size: 20, color: ink(c)),
                      ),
                    )
                  : fallback != null
                  ? StickerView(mediaId: fallback, size: 30)
                  : QChatIcon('emoji', size: 22, color: ink(c)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _tabButton(BuildContext c, int index, String icon, String label) {
    final selected = tab == index;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        key: ValueKey('sticker-tab-$index'),
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => tab = index),
        // The highlight switches at once: animating it fades the old tab out
        // and the new one in at the same time, so a quick tap shows two grey
        // pills before either settles.
        child: Container(
          width: 46,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? qchatSurface(c) : QChatColors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: QChatIcon(icon, size: 26, color: ink(c)),
        ),
      ),
    );
  }

  Widget _floatingActions(BuildContext c) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _actionTile(
        c,
        key: const ValueKey('sticker-backspace'),
        onTap: widget.onBackspace,
        semantic: tr(c, 'delete'),
        child: QChatIcon('backspace', size: 22, color: qchatMuted(c)),
      ),
      const SizedBox(width: 10),
      Semantics(
        button: true,
        enabled: widget.canSend,
        label: tr(c, 'send'),
        child: GestureDetector(
          key: const ValueKey('sticker-send'),
          behavior: HitTestBehavior.opaque,
          onTap: widget.canSend ? widget.onSend : null,
          child: Container(
            width: 56,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: widget.canSend
                  ? QChatColors.green
                  : qchatFill(c).withValues(alpha: .75),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              tr(c, 'send'),
              style: TextStyle(
                fontSize: 15,
                color: widget.canSend ? QChatColors.white : qchatMuted(c),
              ),
            ),
          ),
        ),
      ),
    ],
  );

  Widget _actionTile(
    BuildContext c, {
    required Key key,
    required VoidCallback? onTap,
    required String semantic,
    required Widget child,
  }) => Semantics(
    button: true,
    label: semantic,
    child: GestureDetector(
      key: key,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 50,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: qchatFill(c).withValues(alpha: .75),
          borderRadius: BorderRadius.circular(10),
        ),
        child: child,
      ),
    ),
  );

  // ---------------------------------------------------------------------------
  // Shared pieces
  // ---------------------------------------------------------------------------

  /// The first sticker that has artwork, so a pack with no avatar or cover still
  /// shows something in the row.
  String? _firstArtwork(StickerPack pack) {
    for (final sticker in pack.stickers) {
      if (sticker.mediaId.isNotEmpty) return sticker.mediaId;
    }
    return null;
  }

  Widget _failure(BuildContext c) => Center(
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

  Widget _sectionTitle(BuildContext c, String key) => Padding(
    padding: const EdgeInsets.only(bottom: 10, left: 2),
    child: Text(
      tr(c, key),
      style: TextStyle(fontSize: 15, color: qchatMuted(c)),
    ),
  );

  Widget _link(
    BuildContext c,
    String key,
    VoidCallback onTap, {
    bool arrow = false,
  }) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          tr(c, key),
          style: const TextStyle(fontSize: 13.5, color: Color(0xff576b95)),
        ),
        if (arrow) ...[
          const SizedBox(width: 3),
          const QChatIcon('chevron', size: 14, color: Color(0xff576b95)),
        ],
      ],
    ),
  );

  Widget _stickerGrid(
    List<Sticker> items, {
    required int columns,
    required double size,
    Widget? leading,
    String keyPrefix = 'sticker',
  }) => GridView.builder(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    padding: EdgeInsets.zero,
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: columns,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
    ),
    itemCount: items.length + (leading == null ? 0 : 1),
    itemBuilder: (c, index) {
      if (leading != null && index == 0) return Center(child: leading);
      final sticker = items[index - (leading == null ? 0 : 1)];
      return GestureDetector(
        key: ValueKey('$keyPrefix-${sticker.id}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onSticker(sticker),
        child: Center(
          child: StickerView(mediaId: sticker.mediaId, size: size),
        ),
      );
    },
  );

  Widget _addTile(BuildContext c) => GestureDetector(
    key: const ValueKey('sticker-add-studio'),
    behavior: HitTestBehavior.opaque,
    onTap: () => widget.onOpenStudio(create: true),
    child: SizedBox.square(
      dimension: 64,
      child: CustomPaint(
        painter: _DashedBorderPainter(color: qchatMuted(c), radius: 8),
        child: Center(child: QChatIcon('plus', size: 30, color: ink(c))),
      ),
    ),
  );
}

/// The small grabber at the top of the panel content, like the reference.
class _DragHandle extends StatelessWidget {
  const _DragHandle();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 7, bottom: 3),
    child: Center(
      child: Container(
        width: 38,
        height: 4,
        decoration: BoxDecoration(
          color: const Color(0xffd3d3d3),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    ),
  );
}

/// Draws a dashed rounded outline, used by the empty and add stickers tiles.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color, required this.radius});

  final Color color;
  final double radius;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)),
      );
    const dash = 6.0, gap = 5.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance = end + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color || old.radius != radius;
}
