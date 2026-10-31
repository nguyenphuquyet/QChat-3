import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/localization/strings.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_view.dart';

/// One sticker album. The owner adds artwork, publishes the pack and removes
/// pieces; anyone else can look at a published pack and add it to their library.
class StickerPackScreen extends ConsumerStatefulWidget {
  const StickerPackScreen({super.key, required this.packId});

  final String packId;

  @override
  ConsumerState<StickerPackScreen> createState() => _StickerPackScreenState();
}

class _StickerPackScreenState extends ConsumerState<StickerPackScreen> {
  StickerPack? pack;
  bool loading = true;
  bool failed = false;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  StickerApi get _api => StickerApi(ref.read(clientProvider));

  Future<void> _load() async {
    try {
      final next = await _api.pack(widget.packId);
      if (!mounted) return;
      setState(() {
        pack = next;
        loading = false;
        failed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        failed = pack == null;
      });
    }
  }

  Future<void> _publish(bool published) async {
    setState(() => busy = true);
    try {
      final next = await _api.updatePack(widget.packId, published: published);
      if (!mounted) return;
      setState(() {
        pack = next;
        busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => busy = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      tr(context, 'stickerDeletePack'),
      tr(context, 'stickerDeleteConfirm'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      await _api.deletePack(widget.packId);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerDeleted'));
      context.pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => busy = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _removeSticker(Sticker sticker) async {
    final ok = await confirmAction(
      context,
      tr(context, 'stickerRemove'),
      tr(context, 'stickerRemoveConfirm'),
    );
    if (!ok || !mounted) return;
    try {
      await _api.removeSticker(widget.packId, sticker.id);
      await _load();
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _addToLibrary() async {
    setState(() => busy = true);
    try {
      await _api.addToLibrary(widget.packId);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerPackAdded'));
      await _load();
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _import() async {
    final saved = await context.push<bool>(
      '/red-packets/designer/stickers/${widget.packId}/import',
    );
    if (saved == true && mounted) _load();
  }

  @override
  Widget build(BuildContext c) {
    final data = pack;
    return QChatPage(
      title: data?.name ?? tr(c, 'stickerStudio'),
      glassHeader: false,
      leading: QChatIconButton(
        'back',
        label: tr(c, 'back'),
        onTap: () => c.pop(),
      ),
      trailing: data != null && data.mine
          ? QChatIconButton(
              'plus',
              label: tr(c, 'stickerAddSticker'),
              onTap: _import,
            )
          : null,
      child: loading
          ? const QChatLoading()
          : failed || data == null
          ? QChatError(error: tr(c, 'networkError'), retry: _load)
          : _body(c, data),
    );
  }

  Widget _body(BuildContext c, StickerPack data) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
    children: [
      Row(
        children: [
          SizedBox.square(
            dimension: 58,
            child: data.coverMediaId == null
                ? const Center(child: QChatIcon('emoji', size: 32))
                : StickerView(mediaId: data.coverMediaId!, size: 58),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.name,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: ink(c),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  data.mine
                      ? '${data.stickers.length} ${tr(c, 'stickerCount')} · ${tr(c, data.published ? 'stickerPublished' : 'stickerDraft')}'
                      : '${data.ownerName} · ${data.stickers.length} ${tr(c, 'stickerCount')}',
                  style: TextStyle(fontSize: 12, color: qchatMuted(c)),
                ),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 18),
      if (data.mine) ...[
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: surface(c),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr(c, 'stickerPublish'),
                      style: TextStyle(fontSize: 14, color: ink(c)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tr(c, 'stickerPublishNote'),
                      style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                    ),
                  ],
                ),
              ),
              QChatSwitch(
                value: data.published,
                onChanged: busy ? null : _publish,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
      ] else
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: QChatButton(
            tr(c, data.added ? 'stickerAdded' : 'stickerAddPack'),
            loading: busy,
            onTap: data.added ? null : _addToLibrary,
          ),
        ),
      if (data.stickers.isEmpty)
        QChatEmptyState(tr(c, 'stickerPackEmpty'), icon: 'emoji')
      else
        GridView.count(
          crossAxisCount: 4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 6,
          crossAxisSpacing: 6,
          children: [
            for (final sticker in data.stickers)
              GestureDetector(
                key: ValueKey('studio-sticker-${sticker.id}'),
                behavior: HitTestBehavior.opaque,
                onLongPress: data.mine ? () => _removeSticker(sticker) : null,
                child: Center(
                  child: StickerView(mediaId: sticker.mediaId, size: 72),
                ),
              ),
          ],
        ),
      if (data.mine) ...[
        const SizedBox(height: 18),
        QChatButton(
          tr(c, 'stickerAddSticker'),
          secondary: true,
          onTap: _import,
        ),
        const SizedBox(height: 10),
        QChatButton(
          tr(c, 'stickerDeletePack'),
          secondary: true,
          onTap: busy ? null : _delete,
        ),
      ],
    ],
  );
}
