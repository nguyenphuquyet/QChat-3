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
              QChatIcon('stickerV', size: 22, color: ink(c)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr(c, 'stickerStudio'),
                  style: TextStyle(
                    fontSize: 14,
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
            style: TextStyle(fontSize: 11.5, height: 1.4, color: qchatMuted(c)),
          ),
          const SizedBox(height: 10),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Center(child: QChatLoading(size: 18)),
            )
          else if (packs.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                tr(c, 'stickerEmpty'),
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.45,
                  color: qchatMuted(c),
                ),
              ),
            )
          else
            for (final pack in packs) _packRow(c, pack),
          const SizedBox(height: 8),
          GestureDetector(
            key: const ValueKey('sticker-workshop-create'),
            behavior: HitTestBehavior.opaque,
            onTap: creating ? null : _create,
            child: Container(
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: widget.accent,
                borderRadius: BorderRadius.circular(6),
              ),
              child: creating
                  ? const QChatLoading(size: 17, color: QChatColors.white)
                  : Text(
                      tr(c, 'stickerNewPack'),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: QChatColors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _packRow(BuildContext c, StickerPack pack) {
    final avatar = pack.avatarMediaId ?? pack.coverMediaId;
    final fallback = _firstArtwork(pack);
    return GestureDetector(
      key: ValueKey('workshop-pack-${pack.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _open(pack),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                color: qchatFill(c),
                child: avatar != null
                    ? MediaImage(id: avatar, fit: BoxFit.cover)
                    : fallback != null
                    ? StickerView(mediaId: fallback, size: 34)
                    : QChatIcon('emoji', size: 22, color: ink(c)),
              ),
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
                    style: TextStyle(fontSize: 13.5, color: ink(c)),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${pack.stickers.length} ${tr(c, 'stickerCount')} · '
                    '${tr(c, pack.published ? 'stickerPublished' : 'stickerDraft')}',
                    style: TextStyle(fontSize: 11, color: qchatMuted(c)),
                  ),
                ],
              ),
            ),
            QChatIcon('chevron', size: 15, color: QChatColors.muted),
          ],
        ),
      ),
    );
  }

  String? _firstArtwork(StickerPack pack) {
    for (final sticker in pack.stickers) {
      if (sticker.mediaId.isNotEmpty) return sticker.mediaId;
    }
    return null;
  }
}
