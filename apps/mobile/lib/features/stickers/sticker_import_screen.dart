import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../../core/media/media_picker.dart';
import 'sticker_api.dart';
import 'sticker_cutout.dart';
import 'sticker_upload.dart';

/// Adds artwork to a pack.
///
/// Two switches decide how a picked picture becomes stickers:
/// * "Tự tách nhãn dán" finds separate drawings on a sheet and crops each one.
/// * "Tách nền" is off unless the user turns it on. It removes the background
///   connected to the picture's border, so a drawing on a plain sheet becomes
///   transparent.
///
/// A GIF keeps all of its frames; the same crops are applied to every frame and
/// the result is written back as an animated GIF.
class StickerImportScreen extends ConsumerStatefulWidget {
  const StickerImportScreen({super.key, required this.packId});

  final String packId;

  @override
  ConsumerState<StickerImportScreen> createState() =>
      _StickerImportScreenState();
}

class _StickerImportScreenState extends ConsumerState<StickerImportScreen> {
  /// A pack holds up to 60 stickers; the server enforces the same limit.
  static const maxStickers = 60;

  int remaining = maxStickers;
  Uint8List? source;
  String pickedName = '';
  bool animated = false;
  bool split = true;
  bool cutout = false;
  bool picking = false;
  bool extracting = false;
  bool saving = false;
  String progress = '';
  String? error;
  List<ExtractedSticker> preview = const [];
  int found = 0;

  @override
  void initState() {
    super.initState();
    _loadRemaining();
  }

  Future<void> _loadRemaining() async {
    try {
      final pack = await StickerApi(ref.read(clientProvider)).pack(
        widget.packId,
      );
      if (!mounted) return;
      setState(() {
        remaining = (maxStickers - pack.stickers.length).clamp(0, maxStickers);
      });
    } catch (_) {
      // The save call still reports a full pack; the counter is only a hint.
    }
  }

  Future<void> _pick() async {
    if (picking || saving) return;
    setState(() => picking = true);
    try {
      final files = await pickQChatMedia(
        context,
        imagesOnly: true,
        maxAssets: 1,
      );
      if (files.isEmpty || !mounted) return;
      final bytes = await files.first.readAsBytes();
      if (!mounted) return;
      setState(() {
        source = bytes;
        pickedName = files.first.name;
        animated = _isGif(bytes);
        preview = const [];
        found = 0;
        error = null;
      });
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'mediaUnavailable'));
    } finally {
      if (mounted) setState(() => picking = false);
    }
  }

  Future<void> _extract() async {
    final bytes = source;
    if (bytes == null || extracting || saving) return;
    if (remaining <= 0) {
      setState(() => error = tr(context, 'stickerPackFull'));
      return;
    }
    setState(() {
      extracting = true;
      error = null;
    });
    try {
      final result = await extractStickers(
        bytes,
        split: split,
        removeBackground: cutout,
      );
      if (!mounted) return;
      setState(() {
        extracting = false;
        found = result.length;
        preview = result.take(remaining).toList();
        if (result.isEmpty) error = tr(context, 'stickerExtractEmpty');
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        extracting = false;
        error = tr(context, 'stickerExtractFailed');
      });
    }
  }

  Future<void> _save() async {
    if (preview.isEmpty || saving) return;
    setState(() {
      saving = true;
      error = null;
      progress = '';
    });
    try {
      final client = ref.read(clientProvider);
      final api = StickerApi(client);
      final stamp = DateTime.now().microsecondsSinceEpoch;
      for (var i = 0; i < preview.length; i++) {
        final artwork = preview[i];
        final extension = artwork.animated ? 'gif' : 'png';
        final mediaId = await uploadStickerArtwork(
          client,
          artwork.bytes,
          artwork.mime,
          name: 'sticker-$stamp-$i.$extension',
        );
        await api.addSticker(
          widget.packId,
          mediaId: mediaId,
          animated: artwork.animated,
        );
        if (mounted) setState(() => progress = '${i + 1}/${preview.length}');
      }
      if (!mounted) return;
      showQChatToast(context, tr(context, 'stickerSaved'));
      context.pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        saving = false;
        progress = '';
        error = tr(context, 'networkError');
      });
    }
  }

  bool _isGif(Uint8List bytes) =>
      bytes.length > 6 &&
      bytes[0] == 0x47 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x38;

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'stickerImport'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        if (remaining <= 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              tr(c, 'stickerPackFull'),
              style: const TextStyle(color: QChatColors.danger, fontSize: 13),
            ),
          ),
        _source(c),
        const SizedBox(height: 18),
        _option(
          c,
          title: 'stickerSplit',
          note: 'stickerSplitNote',
          value: split,
          onChanged: saving ? null : (value) => setState(() => split = value),
        ),
        const SizedBox(height: 10),
        _option(
          c,
          title: 'stickerCutout',
          note: 'stickerCutoutNote',
          value: cutout,
          onChanged: saving ? null : (value) => setState(() => cutout = value),
        ),
        if (animated)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              tr(c, 'stickerAnimatedNote'),
              style: TextStyle(fontSize: 12, color: qchatMuted(c)),
            ),
          ),
        const SizedBox(height: 18),
        QChatButton(
          tr(c, 'stickerExtract'),
          loading: extracting,
          onTap: source == null || saving || remaining <= 0 ? null : _extract,
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              error!,
              style: const TextStyle(color: QChatColors.danger, fontSize: 13),
            ),
          ),
        if (preview.isNotEmpty) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              Text(
                '${tr(c, 'stickerPreview')} · ${preview.length}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: ink(c),
                ),
              ),
              const Spacer(),
              if (found > preview.length)
                Text(
                  tr(c, 'stickerLimitNote'),
                  style: TextStyle(fontSize: 11, color: qchatMuted(c)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final artwork in preview)
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: surface(c),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Image.memory(
                    artwork.bytes,
                    width: 66,
                    height: 66,
                    fit: BoxFit.contain,
                    gaplessPlayback: true,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          QChatButton(
            progress.isEmpty
                ? tr(c, 'stickerSave')
                : '${tr(c, 'stickerSave')} $progress',
            loading: saving,
            onTap: _save,
          ),
        ],
      ],
    ),
  );

  Widget _source(BuildContext c) {
    if (source == null) {
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: picking ? null : _pick,
        child: Container(
          height: 150,
          decoration: BoxDecoration(
            border: Border.all(color: qchatLine(c), width: .8),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(
            child: picking
                ? const QChatLoading()
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const QChatIcon('plus', size: 30),
                      const SizedBox(height: 8),
                      Text(
                        tr(c, 'stickerChooseImage'),
                        style: TextStyle(fontSize: 13, color: qchatMuted(c)),
                      ),
                    ],
                  ),
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 190,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: surface(c),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Image.memory(
            source!,
            fit: BoxFit.contain,
            gaplessPlayback: true,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                pickedName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, color: qchatMuted(c)),
              ),
            ),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: picking ? null : _pick,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: 4,
                  horizontal: 4,
                ),
                child: Text(
                  tr(c, 'stickerChooseOther'),
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: QChatColors.green,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _option(
    BuildContext c, {
    required String title,
    required String note,
    required bool value,
    required ValueChanged<bool>? onChanged,
  }) => Container(
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
                tr(c, title),
                style: TextStyle(fontSize: 14, color: ink(c)),
              ),
              const SizedBox(height: 3),
              Text(
                tr(c, note),
                style: TextStyle(fontSize: 11.5, height: 1.4, color: qchatMuted(c)),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        QChatSwitch(value: value, onChanged: onChanged),
      ],
    ),
  );
}
