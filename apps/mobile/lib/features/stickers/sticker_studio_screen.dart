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

/// "Nhãn dán" in Xưởng thiết kế: the designer's own sticker albums plus the
/// packs published by others. Packs are built one artwork at a time in
/// [StickerPackScreen]; a published pack can be added by anyone.
class StickerStudioScreen extends ConsumerStatefulWidget {
  const StickerStudioScreen({super.key, this.create = false});

  /// The sticker tab's "+" opens the studio already asking for a new pack.
  final bool create;

  @override
  ConsumerState<StickerStudioScreen> createState() =>
      _StickerStudioScreenState();
}

class _StickerStudioScreenState extends ConsumerState<StickerStudioScreen> {
  StickerLibrary? library;
  bool loading = true;
  bool busy = false;
  bool failed = false;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.create) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _newPack());
    }
  }

  Future<void> _load() async {
    try {
      final data = await StickerApi(ref.read(clientProvider)).library();
      if (!mounted) return;
      setState(() {
        library = data;
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

  StickerApi get _api => StickerApi(ref.read(clientProvider));

  Future<void> _newPack() async {
    if (busy) return;
    final name = await editText(
      context,
      tr(context, 'stickerNewPack'),
      maxLength: 40,
    );
    if (name == null || name.trim().isEmpty || !mounted) return;
    setState(() => busy = true);
    try {
      final pack = await _api.createPack(name.trim());
      if (!mounted) return;
      setState(() => busy = false);
      await context.push<void>('/red-packets/designer/stickers/${pack.id}');
      if (mounted) _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => busy = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _open(StickerPack pack) async {
    await context.push<void>('/red-packets/designer/stickers/${pack.id}');
    if (mounted) _load();
  }

  Future<void> _add(StickerPack pack) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await _api.addToLibrary(pack.id);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerPackAdded'));
      await _load();
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'stickerStudio'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'plus',
      label: tr(c, 'stickerNewPack'),
      onTap: _newPack,
    ),
    child: loading
        ? const QChatLoading()
        : failed || library == null
        ? QChatError(error: tr(c, 'networkError'), retry: _load)
        : _body(c, library!),
  );

  Widget _body(BuildContext c, StickerLibrary data) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
    children: [
      Text(
        tr(c, 'stickerStudioNote'),
        style: TextStyle(fontSize: 13, height: 1.5, color: qchatMuted(c)),
      ),
      const SizedBox(height: 20),
      _title(c, 'stickerMyPacks'),
      if (data.mine.isEmpty)
        _emptyCard(c, 'stickerEmpty')
      else
        for (final pack in data.mine) _packCard(c, pack),
      const SizedBox(height: 22),
      _title(c, 'stickerMarket'),
      if (data.market.isEmpty)
        _emptyCard(c, 'stickerMarketEmpty')
      else
        for (final pack in data.market)
          _packCard(
            c,
            pack,
            action: pack.added
                ? Text(
                    tr(c, 'stickerAdded'),
                    style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
                  )
                : QChatButton(
                    tr(c, 'stickerAdd'),
                    secondary: true,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    onTap: () => _add(pack),
                  ),
          ),
    ],
  );

  Widget _title(BuildContext c, String key) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(
      tr(c, key),
      style: TextStyle(
        fontSize: 14.5,
        fontWeight: FontWeight.w600,
        color: ink(c),
      ),
    ),
  );

  Widget _emptyCard(BuildContext c, String key) => Container(
    padding: const EdgeInsets.symmetric(vertical: 26),
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      tr(c, key),
      style: TextStyle(fontSize: 13, color: qchatMuted(c)),
    ),
  );

  Widget _packCard(
    BuildContext c,
    StickerPack pack, {
    Widget? action,
  }) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: () => _open(pack),
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: surface(c),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 54,
            child: pack.coverMediaId == null
                ? const Center(child: QChatIcon('emoji', size: 28))
                : StickerView(mediaId: pack.coverMediaId!, size: 54),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pack.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                    color: ink(c),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${pack.stickers.length} ${tr(c, 'stickerCount')}'
                  '${pack.mine ? ' · ${tr(c, pack.published ? 'stickerPublished' : 'stickerDraft')}' : pack.ownerName.isEmpty ? '' : ' · ${pack.ownerName}'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          action ??
              (pack.mine
                  ? Text(
                      tr(c, 'stickerManage'),
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: QChatColors.green,
                      ),
                    )
                  : const SizedBox.shrink()),
        ],
      ),
    ),
  );
}
