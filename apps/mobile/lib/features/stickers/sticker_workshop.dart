import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_view.dart';

/// "Xưởng nhãn dán", embedded in the design studio.
///
/// It owns the user's sticker packs — create a pack, open it and add artwork —
/// and links to the full sticker gallery. The panel's "+" and the empty custom
/// tab open the same pack flow.
class StickerWorkshop extends ConsumerStatefulWidget {
  const StickerWorkshop({super.key, this.accent = QChatColors.green});

  /// Accent of the host studio (the design studio uses its coral).
  final Color accent;

  @override
  ConsumerState<StickerWorkshop> createState() => StickerWorkshopState();
}

class StickerWorkshopState extends ConsumerState<StickerWorkshop> {
  StickerLibrary? library;
  bool loading = true;
  bool creating = false;

  StickerApi get _api => StickerApi(ref.read(clientProvider));

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final next = await _api.library();
      if (!mounted) return;
      setState(() {
        library = next;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    if (creating) return;
    final name = await editText(
      context,
      tr(context, 'stickerNewPack'),
      maxLength: 40,
    );
    final trimmed = name?.trim() ?? '';
    if (trimmed.isEmpty || !mounted) return;
    setState(() => creating = true);
    try {
      final pack = await _api.createPack(trimmed);
      if (!mounted) return;
      setState(() => creating = false);
      await context.push<void>('/stickers/${pack.id}');
      if (mounted) load();
    } catch (_) {
      if (!mounted) return;
      setState(() => creating = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  void _open(StickerPack pack) {
    context.push<void>('/stickers/${pack.id}').then((_) {
      if (mounted) load();
    });
  }

  @override
  Widget build(BuildContext c) {
    final packs = library?.mine ?? const <StickerPack>[];
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      decoration: BoxDecoration(
        color: surface(c),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              QChatIcon('stickerV', size: 20, color: widget.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr(c, 'stickerStudio'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: ink(c),
                  ),
                ),
              ),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => c.push<void>('/stickers').then((_) {
                  if (mounted) load();
                }),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      tr(c, 'stickerMore'),
                      style: TextStyle(fontSize: 12, color: widget.accent),
                    ),
                    const SizedBox(width: 2),
                    QChatIcon('chevron', size: 13, color: widget.accent),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            tr(c, 'stickerStudioShort'),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11.5, height: 1.4, color: qchatMuted(c)),
          ),
          const SizedBox(height: 12),
          if (loading)
            const SizedBox(
              height: 84,
              child: Center(child: QChatLoading(size: 18)),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final pack in packs) ...[
                    _packTile(c, pack),
                    const SizedBox(width: 10),
                  ],
                  _createTile(c),
                ],
              ),
            ),
          if (!loading && packs.isEmpty) ...[
            const SizedBox(height: 10),
            Text(
              tr(c, 'stickerEmpty'),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                height: 1.4,
                color: qchatMuted(c),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// One pack in the rail: artwork, its sticker count and its name. The rail
  /// keeps the packs in one swipeable line instead of pushing the covers off
  /// the screen with a tall list.
  Widget _packTile(BuildContext c, StickerPack pack) {
    final avatar = pack.avatarMediaId ?? pack.coverMediaId;
    final fallback = _firstArtwork(pack);
    return GestureDetector(
      key: ValueKey('workshop-pack-${pack.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(pack),
      child: SizedBox(
        width: 68,
        child: Column(
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 68,
                    height: 68,
                    alignment: Alignment.center,
                    color: qchatFill(c),
                    child: avatar != null
                        ? MediaImage(id: avatar, fit: BoxFit.cover)
                        : fallback != null
                        ? StickerView(mediaId: fallback, size: 58)
                        : QChatIcon('emoji', size: 26, color: ink(c)),
                  ),
                ),
                Positioned(
                  right: 4,
                  bottom: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 4,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x99000000),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${pack.stickers.length}',
                      style: const TextStyle(
                        fontSize: 9.5,
                        color: QChatColors.white,
                      ),
                    ),
                  ),
                ),
                if (pack.published)
                  Positioned(
                    left: 5,
                    top: 5,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: QChatColors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              pack.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: ink(c)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _createTile(BuildContext c) => GestureDetector(
    key: const ValueKey('sticker-workshop-create'),
    behavior: HitTestBehavior.opaque,
    onTap: creating ? null : _create,
    child: SizedBox(
      width: 68,
      child: Column(
        children: [
          Container(
            width: 68,
            height: 68,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: widget.accent.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: widget.accent.withValues(alpha: .45),
                width: 1,
              ),
            ),
            child: creating
                ? QChatLoading(size: 18, color: widget.accent)
                : QChatIcon('plus', size: 24, color: widget.accent),
          ),
          const SizedBox(height: 5),
          Text(
            tr(c, 'stickerNewPackShort'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, color: widget.accent),
          ),
        ],
      ),
    ),
  );

  String? _firstArtwork(StickerPack pack) {
    for (final sticker in pack.stickers) {
      if (sticker.mediaId.isNotEmpty) return sticker.mediaId;
    }
    return null;
  }
}
