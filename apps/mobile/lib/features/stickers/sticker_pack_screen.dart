import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../../core/media/media_picker.dart';
import 'sticker_api.dart';
import 'sticker_models.dart';
import 'sticker_upload.dart';
import 'sticker_view.dart';

/// One sticker album, drawn the way WeChat draws an album page: a full-bleed
/// cover under the status bar, the name and a green "Thêm" button, then the
/// artwork in four columns. Tapping a piece opens its preview sheet.
///
/// The owner gets a settings button over the cover: rename, set the cover or
/// the avatar, publish, add stickers and delete the pack.
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
  bool savingArtwork = false;

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

  Future<void> _run(Future<StickerPack> Function() action) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final next = await action();
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

  Future<void> _publish(bool published) =>
      _run(() => _api.updatePack(widget.packId, published: published));

  Future<void> _rename() async {
    final data = pack;
    if (data == null) return;
    final name = await editText(
      context,
      tr(context, 'stickerRename'),
      initial: data.name,
      maxLength: 40,
    );
    final trimmed = name?.trim() ?? '';
    if (trimmed.isEmpty || trimmed == data.name || !mounted) return;
    await _run(() => _api.updatePack(widget.packId, name: trimmed));
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

  Future<void> _addToLibrary() => _run(() => _api.addToLibrary(widget.packId));

  Future<void> _import() async {
    final saved = await context.push<bool>('/stickers/${widget.packId}/import');
    if (saved == true && mounted) _load();
  }

  // ---------------------------------------------------------------------------
  // Cover and avatar
  // ---------------------------------------------------------------------------

  Future<void> _artworkSheet({required bool cover}) async {
    final data = pack;
    if (data == null || savingArtwork) return;
    final current = cover ? data.coverMediaId : data.avatarMediaId;
    await qchatSheet(context, [
      (
        tr(context, cover ? 'stickerChooseCover' : 'stickerChooseAvatar'),
        () => _pickArtwork(cover: cover),
      ),
      if (current != null)
        (tr(context, 'stickerClearPicture'), () => _clearArtwork(cover: cover)),
    ]);
  }

  Future<void> _pickArtwork({required bool cover}) async {
    if (savingArtwork) return;
    final files = await pickQChatMedia(context, imagesOnly: true, maxAssets: 1);
    if (files.isEmpty || !mounted) return;
    setState(() => savingArtwork = true);
    try {
      final fitted = await fitImageFile(
        files.first,
        const MediaFit(width: 1600, height: 1600, quality: .9),
      );
      final bytes = await fitted.readAsBytes();
      // A picture that is not one of the formats the server stores (a HEIC the
      // platform decoder could not open, for one) is refused here, so the user
      // sees what is wrong instead of a connection error.
      final mime = fitted.mimeType ?? imageMimeFromBytes(bytes);
      if (mime == null) {
        if (!mounted) return;
        setState(() => savingArtwork = false);
        showQChatToast(context, tr(context, 'mediaUnavailable'));
        return;
      }
      final extension = imageExtension(mime);
      final client = ref.read(clientProvider);
      final mediaId = await uploadStickerArtwork(
        client,
        bytes,
        mime,
        name:
            'sticker-${cover ? 'cover' : 'avatar'}-'
            '${DateTime.now().microsecondsSinceEpoch}.$extension',
      );
      final next = cover
          ? await _api.setPackCover(widget.packId, mediaId)
          : await _api.setPackAvatar(widget.packId, mediaId);
      if (!mounted) return;
      setState(() {
        pack = next;
        savingArtwork = false;
      });
      showQChatToast(
        context,
        tr(context, cover ? 'stickerCoverUpdated' : 'stickerAvatarUpdated'),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => savingArtwork = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _clearArtwork({required bool cover}) async {
    if (savingArtwork) return;
    setState(() => savingArtwork = true);
    try {
      final next = cover
          ? await _api.setPackCover(widget.packId, null)
          : await _api.setPackAvatar(widget.packId, null);
      if (!mounted) return;
      setState(() {
        pack = next;
        savingArtwork = false;
      });
      showQChatToast(context, tr(context, 'stickerPictureRemoved'));
    } catch (_) {
      if (!mounted) return;
      setState(() => savingArtwork = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  Future<void> _useSticker(Sticker sticker, {required bool cover}) async {
    if (savingArtwork) return;
    setState(() => savingArtwork = true);
    try {
      final next = cover
          ? await _api.setPackCover(widget.packId, sticker.mediaId)
          : await _api.setPackAvatar(widget.packId, sticker.mediaId);
      if (!mounted) return;
      setState(() {
        pack = next;
        savingArtwork = false;
      });
      showQChatToast(
        context,
        tr(context, cover ? 'stickerCoverUpdated' : 'stickerAvatarUpdated'),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => savingArtwork = false);
      showQChatToast(context, tr(context, 'networkError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Single sticker sheet
  // ---------------------------------------------------------------------------

  Future<void> _previewSticker(Sticker sticker) {
    final data = pack;
    if (data == null) return Future.value();
    return showQChatSheet<void>(
      context,
      (c) => _StickerSheet(
        sticker: sticker,
        onAdd: () => _addStickerToLibrary(sticker),
        onSend: () => _sendSticker(sticker),
      ),
      showCancel: false,
      maxHeightFactor: .78,
    );
  }

  /// "Thêm": puts the pack in the library if needed and records the send, so the
  /// piece also shows up under "recently used" in the composer.
  Future<bool> _addStickerToLibrary(Sticker sticker) async {
    try {
      final data = pack;
      final wasAdded = data != null && (data.mine || data.added);
      if (data != null && !data.mine && !data.added) {
        await _api.addToLibrary(widget.packId);
      }
      await _api.markUsed(sticker.id);
      if (data != null && !data.mine) await _load();
      if (mounted) {
        showQChatToast(
          context,
          tr(context, wasAdded ? 'stickerAddedToRecent' : 'stickerPackAdded'),
        );
      }
      return true;
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
      return false;
    }
  }

  /// "Gửi đến Trò chuyện": pick a conversation, then send the artwork as a
  /// STICKER message through the normal outbox.
  Future<void> _sendSticker(Sticker sticker) async {
    final client = ref.read(clientProvider);
    try {
      final raw = await client.get('/conversations');
      if (!mounted) return;
      final rows = raw is List
          ? raw.whereType<Map>().take(12).toList()
          : const <Map>[];
      if (rows.isEmpty) {
        showQChatToast(context, tr(context, 'stickerNoChats'));
        return;
      }
      final id = await showQChatSheet<String>(
        context,
        (c) => _ConversationPicker(
          chats: [
            for (final row in rows)
              (
                row['id']?.toString() ?? '',
                _conversationName(row, client.userId ?? ''),
              ),
          ],
        ),
        maxHeightFactor: .7,
      );
      if (id == null || id.isEmpty || !mounted) return;
      await client.send(id, '', kind: 'STICKER', mediaId: sticker.mediaId);
      await StickerApi(client).markUsed(sticker.id).catchError((_) {});
      if (mounted) showQChatToast(context, tr(context, 'stickerSent'));
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    }
  }

  String _conversationName(Map row, String userId) {
    if (row['kind'] == 'GROUP') return row['title']?.toString() ?? 'QChat';
    final members = row['members'] is List ? row['members'] as List : const [];
    for (final member in members) {
      if (member is! Map || member['userId'] == userId) continue;
      final user = member['user'];
      if (user is Map) {
        final nickname = user['nickname']?.toString() ?? '';
        if (nickname.isNotEmpty) return nickname;
      }
    }
    return 'QChat';
  }

  // ---------------------------------------------------------------------------
  // Owner tools
  // ---------------------------------------------------------------------------

  void _ownerMenu() {
    final data = pack;
    if (data == null) return;
    qchatSheet(context, [
      (tr(context, 'stickerRename'), _rename),
      (tr(context, 'stickerCover'), () => _artworkSheet(cover: true)),
      (tr(context, 'stickerAvatar'), () => _artworkSheet(cover: false)),
      (tr(context, 'stickerAddSticker'), _import),
      (
        tr(context, data.published ? 'stickerUnpublish' : 'stickerPublish'),
        () => _publish(!data.published),
      ),
      (tr(context, 'stickerDeletePack'), _delete),
    ]);
  }

  void _stickerActions(Sticker sticker) => qchatSheet(context, [
    (tr(context, 'stickerSendToChat'), () => _sendSticker(sticker)),
    (tr(context, 'stickerUseAsCover'), () => _useSticker(sticker, cover: true)),
    (
      tr(context, 'stickerUseAsAvatar'),
      () => _useSticker(sticker, cover: false),
    ),
    (tr(context, 'stickerRemove'), () => _removeSticker(sticker)),
  ]);

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext c) {
    final data = pack;
    final top = MediaQuery.paddingOf(c).top;
    return QChatPage(
      edgeToEdge: true,
      background: qchatSurface(c),
      statusBackground: QChatColors.black,
      child: Stack(
        children: [
          Positioned.fill(
            child: loading && data == null
                ? const QChatLoading()
                : failed || data == null
                ? QChatError(error: tr(c, 'networkError'), retry: _load)
                : _body(c, data),
          ),
          Positioned(
            top: top + 4,
            left: 6,
            child: _coverButton('back', tr(c, 'back'), () => c.pop()),
          ),
          if (data != null && data.mine)
            Positioned(
              top: top + 4,
              right: 6,
              child: _coverButton(
                'more',
                tr(c, 'stickerOwnerTools'),
                _ownerMenu,
              ),
            ),
        ],
      ),
    );
  }

  Widget _coverButton(String icon, String label, VoidCallback onTap) =>
      Semantics(
        button: true,
        label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0x4d000000),
              shape: BoxShape.circle,
            ),
            child: QChatIcon(icon, size: 21, color: QChatColors.white),
          ),
        ),
      );

  Widget _body(BuildContext c, StickerPack data) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _cover(c, data),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Text(
                        data.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 26,
                          height: 1.2,
                          fontWeight: FontWeight.w600,
                          color: ink(c),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _addButton(c, data),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _subtitle(c, data),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 15, color: qchatMuted(c)),
              ),
              if (data.description.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    data.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: qchatMuted(c),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (data.mine)
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _toolChip(
                  c,
                  'image',
                  tr(c, 'stickerCover'),
                  () => _artworkSheet(cover: true),
                ),
                _toolChip(
                  c,
                  'camera',
                  tr(c, 'stickerAvatar'),
                  () => _artworkSheet(cover: false),
                ),
              ],
            ),
          ),
        if (data.stickers.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 30, 16, 0),
            child: QChatEmptyState(tr(c, 'stickerPackEmpty'), icon: 'emoji'),
          )
        else
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
            child: LayoutBuilder(
              builder: (c, box) {
                final cell = (box.maxWidth - 3 * 12) / 4;
                return Wrap(
                  spacing: 12,
                  runSpacing: 16,
                  children: [
                    for (final sticker in data.stickers)
                      SizedBox.square(
                        dimension: cell,
                        child: GestureDetector(
                          key: ValueKey('studio-sticker-${sticker.id}'),
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _previewSticker(sticker),
                          onLongPress: data.mine
                              ? () => _stickerActions(sticker)
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(5),
                            child: StickerView(
                              mediaId: sticker.mediaId,
                              size: cell - 10,
                            ),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        SizedBox(height: 40 + MediaQuery.paddingOf(c).bottom),
      ],
    );
  }

  Widget _cover(BuildContext c, StickerPack data) {
    final width = MediaQuery.sizeOf(c).width;
    final height = math.min(math.max(width * .52, 180.0), 300.0);
    final cover =
        data.coverMediaId ?? data.avatarMediaId ?? _firstArtwork(data);
    return GestureDetector(
      key: const ValueKey('sticker-pack-cover'),
      behavior: HitTestBehavior.opaque,
      onTap: data.mine ? () => _artworkSheet(cover: true) : null,
      child: SizedBox(
        width: double.infinity,
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (cover != null)
              MediaImage(id: cover, fit: BoxFit.cover)
            else
              ColoredBox(
                color: qchatDark(c)
                    ? const Color(0xff242424)
                    : const Color(0xffe7e7e7),
                child: Center(
                  child: QChatIcon('stickerV', size: 56, color: qchatMuted(c)),
                ),
              ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x73000000), Color(0x00000000)],
                  stops: [0, .42],
                ),
              ),
            ),
            if (data.mine)
              Positioned(
                left: 16,
                bottom: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x59000000),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const QChatIcon(
                        'camera',
                        size: 14,
                        color: QChatColors.white,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        tr(c, 'stickerCover'),
                        style: const TextStyle(
                          fontSize: 12,
                          color: QChatColors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _addButton(BuildContext c, StickerPack data) {
    final mine = data.mine;
    final added = data.added;
    final off = !mine && added;
    return Semantics(
      button: true,
      enabled: !off && !busy,
      child: GestureDetector(
        key: const ValueKey('sticker-pack-add'),
        behavior: HitTestBehavior.opaque,
        onTap: busy || off ? null : (mine ? _import : _addToLibrary),
        child: Container(
          height: 42,
          constraints: const BoxConstraints(minWidth: 96),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: off ? qchatFill(c) : QChatColors.green,
            borderRadius: BorderRadius.circular(6),
          ),
          child: busy
              ? const QChatLoading(size: 16, color: QChatColors.white)
              : Text(
                  tr(c, off ? 'stickerAdded' : 'stickerAdd'),
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: off ? qchatMuted(c) : QChatColors.white,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _toolChip(
    BuildContext c,
    String icon,
    String label,
    VoidCallback onTap,
  ) => Semantics(
    button: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 34,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: qchatSurface(c),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            QChatIcon(icon, size: 15, color: ink(c)),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: 13, color: ink(c))),
          ],
        ),
      ),
    ),
  );

  String _subtitle(BuildContext c, StickerPack data) {
    if (!data.mine && data.ownerName.isNotEmpty) return data.ownerName;
    final count = '${data.stickers.length} ${tr(c, 'stickerCount')}';
    if (!data.mine) return count;
    return '$count · '
        '${tr(c, data.published ? 'stickerPublished' : 'stickerDraft')}';
  }

  String? _firstArtwork(StickerPack pack) {
    for (final sticker in pack.stickers) {
      if (sticker.mediaId.isNotEmpty) return sticker.mediaId;
    }
    return null;
  }
}

/// The preview sheet of one sticker: artwork, its label, then "Thêm" and
/// "Gửi đến Trò chuyện".
class _StickerSheet extends StatefulWidget {
  const _StickerSheet({
    required this.sticker,
    required this.onAdd,
    required this.onSend,
  });

  final Sticker sticker;
  final Future<bool> Function() onAdd;
  final Future<void> Function() onSend;

  @override
  State<_StickerSheet> createState() => _StickerSheetState();
}

class _StickerSheetState extends State<_StickerSheet> {
  bool adding = false;

  Future<void> _add() async {
    if (adding) return;
    setState(() => adding = true);
    final ok = await widget.onAdd();
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() => adding = false);
    }
  }

  void _send() {
    Navigator.of(context).pop();
    widget.onSend();
  }

  @override
  Widget build(BuildContext c) {
    final size = math.min(MediaQuery.sizeOf(c).width * .52, 240.0);
    final label = widget.sticker.label.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 5,
            decoration: BoxDecoration(
              color: qchatDark(c)
                  ? const Color(0xff3a3a3a)
                  : const Color(0xffd9d9d9),
              borderRadius: BorderRadius.circular(2.5),
            ),
          ),
          const SizedBox(height: 30),
          SizedBox.square(
            dimension: size,
            child: MediaImage(id: widget.sticker.mediaId, fit: BoxFit.contain),
          ),
          const SizedBox(height: 16),
          if (label.isNotEmpty)
            Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 15, color: ink(c)),
            ),
          const SizedBox(height: 28),
          _SheetButton(
            key: const ValueKey('sticker-sheet-add'),
            label: tr(c, 'stickerAdd'),
            background: QChatColors.green,
            foreground: QChatColors.white,
            loading: adding,
            onTap: _add,
          ),
          const SizedBox(height: 12),
          _SheetButton(
            key: const ValueKey('sticker-sheet-send'),
            label: tr(c, 'stickerSendToChat'),
            background: qchatFill(c),
            foreground: ink(c),
            onTap: _send,
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    required this.onTap,
    this.loading = false,
  });

  final String label;
  final Color background, foreground;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: loading ? null : onTap,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(7),
        ),
        child: loading
            ? QChatLoading(size: 18, color: foreground)
            : Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w500,
                  color: foreground,
                ),
              ),
      ),
    ),
  );
}

/// The conversation list opened by "Gửi đến Trò chuyện".
class _ConversationPicker extends StatelessWidget {
  const _ConversationPicker({required this.chats});

  final List<(String, String)> chats;

  @override
  Widget build(BuildContext c) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 10),
        child: Text(
          tr(c, 'stickerPickChat'),
          style: TextStyle(fontSize: 15, color: qchatMuted(c)),
        ),
      ),
      for (final chat in chats)
        QChatOverlayAction(
          label: chat.$2,
          onTap: () => Navigator.of(c).pop(chat.$1),
        ),
    ],
  );
}
