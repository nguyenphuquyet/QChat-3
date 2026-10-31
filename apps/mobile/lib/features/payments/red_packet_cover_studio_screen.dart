import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../../core/media/media_video.dart';
import '../../core/network/media_upload.dart';
import '../chats/money_message.dart';
import '../chats/red_packet_cover.dart';
import '../chats/red_packet_design.dart';
import 'red_packet_cover_ui.dart';

/// Colours a designer can pick without a colour wheel. They cover the red
/// family of the default cover plus warm golds and a few cool accents.
const _coverColors = [
  Color(0xffd93b30),
  Color(0xffc0342a),
  Color(0xffe0453a),
  Color(0xffb3261e),
  Color(0xff8c1d18),
  Color(0xff6e1410),
  Color(0xfff6e3b0),
  Color(0xfff3d19c),
  Color(0xffe8b323),
  Color(0xffc9a063),
  Color(0xfffff4e6),
  Color(0xffffd9c9),
  Color(0xff2f6f62),
  Color(0xff1f4e79),
  Color(0xff5b3a8e),
  Color(0xff2a2a35),
  Color(0xffffffff),
];

const _overlayColors = [
  Color(0x80000000),
  Color(0x99000000),
  Color(0x66000000),
  Color(0x80d93b30),
  Color(0x80c0342a),
  Color(0x80331a12),
  Color(0x801a1a2e),
  Color(0x80f3d19c),
];

const _openColors = [
  Color(0xfff6e3b0),
  Color(0xfff3d19c),
  Color(0xffe8b323),
  Color(0xfffff4e6),
  Color(0xffffffff),
  Color(0xff2a2a35),
];

/// Warm golds a designer can use for the two ends of the message bubble. They
/// stay in the red-packet family instead of opening the cover's red palette.
const _messageColors = [
  redPacketGold,
  Color(0xfff7b13f),
  Color(0xffefb84e),
  Color(0xfff7c65a),
  Color(0xfff6d488),
  Color(0xffffe1a8),
  Color(0xffe89a2e),
  Color(0xffd98c2b),
];

const _emojis = [
  '🧧',
  '🌸',
  '🍑',
  '🍊',
  '🏮',
  '✨',
  '🎉',
  '🎁',
  '🐉',
  '🐇',
  '💰',
  '🍀',
  '❤️',
  '🌟',
  '🦋',
  '🌙',
  '🍃',
  '🎊',
];

/// Studio where a designer builds a cover: background, arch height, opened
/// header height, overlay tint, decorations with motion, and effects.
///
/// The whole screen edits one [CoverDesign], and the previews on top of the
/// form are the same renderer the chat uses, so what a designer sees is what a
/// packet will look like.
class RedPacketCoverStudioScreen extends ConsumerStatefulWidget {
  const RedPacketCoverStudioScreen({super.key, this.cover});

  /// Existing cover when editing, `null` when creating a new one.
  final RedPacketCoverData? cover;

  @override
  ConsumerState<RedPacketCoverStudioScreen> createState() =>
      _RedPacketCoverStudioScreenState();
}

class _RedPacketCoverStudioScreenState
    extends ConsumerState<RedPacketCoverStudioScreen> {
  late CoverDesign design = widget.cover?.design ?? CoverDesign.defaultDesign;
  late final name = TextEditingController(text: widget.cover?.name ?? '');
  late final description = TextEditingController(
    text: widget.cover?.description ?? '',
  );
  late final openLabel = TextEditingController(text: design.openLabel);
  final decorationText = TextEditingController();
  final designerName = TextEditingController();
  late Future<dynamic> designer;
  bool busy = false;
  bool uploading = false;
  int? selected;
  String? error;

  @override
  void initState() {
    super.initState();
    _loadDesigner();
  }

  @override
  void dispose() {
    name.dispose();
    description.dispose();
    openLabel.dispose();
    decorationText.dispose();
    designerName.dispose();
    super.dispose();
  }

  void _loadDesigner() {
    designer = ref.read(clientProvider).get('/wallet/designer', cached: false);
  }

  void _apply(CoverDesign next) => setState(() => design = next);

  void _addDecoration(String value, {String kind = 'emoji'}) {
    final id = 'd${DateTime.now().microsecondsSinceEpoch}';
    final items = [
      ...design.decorations,
      CoverDecoration(
        id: id,
        kind: kind,
        value: value,
        x: .5,
        y: kind == 'image' ? .24 : .3,
        size: kind == 'image' ? .28 : .18,
        animation: 'float',
        area: 'top',
      ),
    ];
    setState(() {
      design = design.copyWith(decorations: items);
      selected = items.length - 1;
    });
  }

  void _updateDecoration(
    int index,
    CoverDecoration Function(CoverDecoration) change,
  ) {
    final items = [...design.decorations];
    items[index] = change(items[index]);
    setState(() => design = design.copyWith(decorations: items));
  }

  void _removeDecoration(int index) {
    final items = [...design.decorations]..removeAt(index);
    setState(() {
      design = design.copyWith(decorations: items);
      selected = null;
    });
  }

  Future<void> _pickPhoto({
    bool decoration = false,
    bool video = false,
    bool message = false,
  }) async {
    if (uploading) return;
    setState(() => uploading = true);
    try {
      final PlatformFile? file;
      if (video) {
        final files = await pickMediaWithSource(context, maxAssets: 1);
        file = files.isEmpty ? null : files.first;
      } else {
        file = await pickImageWithSource(context);
      }
      if (file == null || !mounted) return;
      final extension = _extension(file);
      if (video && extension != 'webm' && extension != 'mp4') {
        showQChatToast(context, tr(context, 'coverVideoOnly'));
        return;
      }
      final id = await uploadMedia(ref.read(clientProvider), file);
      if (!mounted) return;
      if (message) {
        _apply(design.copyWith(message: design.message.withImage(id)));
      } else if (decoration) {
        _addDecoration(id, kind: 'image');
      } else {
        _apply(
          design.copyWith(
            background: design.background.copyWith(
              // WeChat-style covers ship H.264; WebM is kept for lighter files.
              type: video ? extension : 'image',
              mediaId: id,
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  void _clearMessageImage() =>
      _apply(design.copyWith(message: design.message.withImage(null)));

  String _extension(PlatformFile file) {
    final dot = file.name.lastIndexOf('.');
    return dot < 0 ? '' : file.name.substring(dot + 1).toLowerCase();
  }

  /// Switches the flap background. A video cover only accepts a clip and a
  /// photo only accepts an image, so moving between those forms drops a file the
  /// designer picked earlier instead of saving a clip as a still or the reverse.
  /// Both video containers share the pill, so switching WebM ↔ MP4 keeps the
  /// clip.
  void _setBackgroundType(String type) {
    final background = design.background;
    if (type == background.type) return;
    final compatible = type == 'image'
        ? background.type == 'image' || background.type == 'gif'
        : type == 'mp4'
        ? background.isVideo
        : true;
    final next = compatible
        ? background.copyWith(type: type)
        : CoverBackground(
            type: type,
            color: background.color,
            colors: background.colors,
          );
    _apply(design.copyWith(background: next));
  }

  Future<void> _createDesigner() async {
    final display = designerName.text.trim();
    if (display.isEmpty || busy) {
      showQChatToast(context, tr(context, 'designerDisplayName'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await ref.read(clientProvider).post('/wallet/designer', {
        'displayName': display,
        'bio': '',
      });
      ref.read(clientProvider).changes.add(null);
      if (!mounted) return;
      setState(() {
        designer = Future.value(result);
        busy = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          busy = false;
          error = tr(context, 'networkError');
        });
      }
    }
  }

  Future<void> _save({required bool publish}) async {
    if (busy) return;
    final title = name.text.trim();
    if (title.isEmpty) {
      showQChatToast(context, tr(context, 'coverName'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final client = ref.read(clientProvider);
      final payload = {
        'name': title,
        'description': description.text.trim(),
        'design': design.toJson(),
        'publish': publish,
      };
      if (widget.cover == null) {
        await client.post('/wallet/covers', payload);
      } else {
        await client.dio.patch(
          '/wallet/covers/${widget.cover!.id}',
          data: payload,
        );
      }
      client.changes.add(null);
      if (!mounted) return;
      showQChatToast(
        context,
        tr(context, publish ? 'coverPublished' : 'coverSaved'),
      );
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          busy = false;
          error = tr(context, 'networkError');
        });
      }
    }
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, widget.cover == null ? 'designerNewCover' : 'coverStudio'),
    glassHeader: false,
    leading: QChatIconButton(
      'close',
      label: tr(c, 'close'),
      onTap: () => c.pop(),
    ),
    child: FutureBuilder<dynamic>(
      future: designer,
      builder: (c, snapshot) {
        if (snapshot.hasError) {
          return QChatError(
            error: snapshot.error!,
            retry: () => setState(_loadDesigner),
          );
        }
        if (!snapshot.hasData) return const QChatLoading();
        final hasDesigner =
            snapshot.data is Map && snapshot.data['designer'] is Map;
        if (!hasDesigner) return _gate(c);
        return _studio(c);
      },
    ),
  );

  /// A cover can only be published from a designer identity, so the studio
  /// asks for one inline instead of dropping the design on the floor.
  Widget _gate(BuildContext c) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 30, 20, 40),
    children: [
      const Center(child: QChatIcon('palette', size: 56, color: coverCoral)),
      const SizedBox(height: 18),
      Text(
        tr(c, 'designerCreate'),
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: ink(c),
        ),
      ),
      const SizedBox(height: 10),
      Text(
        tr(c, 'designerCreateNote'),
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 13.5, height: 1.5, color: qchatMuted(c)),
      ),
      const SizedBox(height: 24),
      QChatTextInput(
        controller: designerName,
        hint: tr(c, 'designerDisplayName'),
        maxLength: 40,
      ),
      const SizedBox(height: 12),
      if (error != null)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            error!,
            style: const TextStyle(color: QChatColors.danger, fontSize: 13),
          ),
        ),
      CoralButton(
        tr(c, 'coverDesignerCreateContinue'),
        height: 46,
        loading: busy,
        onTap: _createDesigner,
      ),
    ],
  );

  Widget _studio(BuildContext c) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
    children: [
      _previews(c),
      const SizedBox(height: 18),
      _section(c, tr(c, 'coverName'), [
        QChatTextInput(
          controller: name,
          hint: tr(c, 'coverNameHint'),
          maxLength: 40,
        ),
        const SizedBox(height: 10),
        QChatTextInput(
          controller: description,
          hint: tr(c, 'coverDescriptionHint'),
          lines: 2,
          maxLength: 200,
        ),
      ]),
      const SizedBox(height: 12),
      _background(c),
      const SizedBox(height: 12),
      _message(c),
      const SizedBox(height: 12),
      _section(c, tr(c, 'coverArchHeight'), [
        _sliderRow(
          c,
          design.topHeight,
          .45,
          .92,
          (value) => _apply(design.copyWith(topHeight: value)),
        ),
        const SizedBox(height: 4),
        Text(
          tr(c, 'coverArchHeightNote'),
          style: TextStyle(fontSize: 12, color: qchatMuted(c)),
        ),
        const SizedBox(height: 10),
        _toggle(
          c,
          tr(c, 'coverArchLine'),
          design.archLine,
          (value) => _apply(design.copyWith(archLine: value)),
        ),
        Text(
          tr(c, 'coverArchLineNote'),
          style: TextStyle(fontSize: 12, color: qchatMuted(c)),
        ),
        const SizedBox(height: 14),
        Text(
          tr(c, 'coverReceiptHeight'),
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w500,
            color: ink(c),
          ),
        ),
        const SizedBox(height: 6),
        _sliderRow(
          c,
          design.receiptHeight,
          .12,
          .70,
          (value) => _apply(design.copyWith(receiptHeight: value)),
        ),
        const SizedBox(height: 4),
        Text(
          tr(c, 'coverReceiptHeightNote'),
          style: TextStyle(fontSize: 12, color: qchatMuted(c)),
        ),
      ]),
      const SizedBox(height: 12),
      _section(c, tr(c, 'coverOverlay'), [
        Text(
          tr(c, 'coverOverlayNote'),
          style: TextStyle(fontSize: 12, color: qchatMuted(c)),
        ),
        const SizedBox(height: 10),
        _swatches(
          c,
          _overlayColors,
          design.overlayColor,
          (color) => _apply(design.copyWith(overlayColor: color)),
          checker: true,
        ),
      ]),
      const SizedBox(height: 12),
      _section(c, tr(c, 'coverOpenButton'), [
        _swatches(
          c,
          _openColors,
          design.openColor,
          (color) => _apply(design.copyWith(openColor: color)),
        ),
        const SizedBox(height: 12),
        QChatTextInput(
          controller: openLabel,
          hint: tr(c, 'coverOpenLabel'),
          maxLength: 8,
          onChanged: (value) {
            if (value.trim().isEmpty) return;
            _apply(design.copyWith(openLabel: value.trim()));
          },
        ),
      ]),
      const SizedBox(height: 12),
      _decorations(c),
      const SizedBox(height: 12),
      _section(c, tr(c, 'coverEffects'), [
        _toggle(
          c,
          tr(c, 'coverSparkles'),
          design.effects.sparkles,
          (value) => _apply(
            design.copyWith(effects: design.effects.copyWith(sparkles: value)),
          ),
        ),
        _toggle(
          c,
          tr(c, 'coverFloat'),
          design.effects.float,
          (value) => _apply(
            design.copyWith(effects: design.effects.copyWith(float: value)),
          ),
        ),
        _toggle(
          c,
          tr(c, 'coverPulse'),
          design.effects.pulse,
          (value) => _apply(
            design.copyWith(effects: design.effects.copyWith(pulse: value)),
          ),
        ),
      ]),
      if (error != null)
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text(
            error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: QChatColors.danger, fontSize: 13),
          ),
        ),
      const SizedBox(height: 22),
      CoralButton(
        tr(c, 'coverSaveAndPublish'),
        height: 48,
        loading: busy,
        onTap: () => _save(publish: true),
      ),
      const SizedBox(height: 10),
      CoralButton(
        tr(c, 'coverSaveDraft'),
        height: 46,
        secondary: true,
        onTap: () => _save(publish: false),
      ),
    ],
  );

  Widget _previews(BuildContext c) => CoverSurface(
    padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
    child: LayoutBuilder(
      builder: (context, box) {
        final coverWidth = (box.maxWidth * .38).clamp(96.0, 132.0);
        // Room around the card so decorations dragged past its edges stay
        // visible in the studio, exactly as they will hang in the chat.
        final spill = coverWidth * .22;
        final coverHeight = coverWidth * 4 / 3;
        final openedWidth = (box.maxWidth - coverWidth - spill * 2 - 14).clamp(
          84.0,
          132.0,
        );
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                SizedBox(
                  width: coverWidth + spill * 2,
                  height: coverHeight + spill * 2,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Positioned(
                        left: spill,
                        top: spill,
                        width: coverWidth,
                        height: coverHeight,
                        child: IgnorePointer(
                          child: CoverThumb(design: design, radius: 8),
                        ),
                      ),
                      for (
                        var index = 0;
                        index < design.decorations.length;
                        index++
                      )
                        _handle(index, coverWidth, coverHeight, spill),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  tr(c, 'coverPreview'),
                  style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                ),
              ],
            ),
            const SizedBox(width: 14),
            // The left column reserves `spill` around the cover for artwork
            // that hangs outside it. Offset the opened preview by the same
            // amount so both previews and their captions line up.
            Padding(
              padding: EdgeInsets.only(top: spill, bottom: spill),
              child: Column(
                children: [
                  SizedBox(
                    width: openedWidth,
                    height: coverHeight,
                    child: _OpenedPreview(design: design),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr(c, 'coverOpenedPreview'),
                    style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    ),
  );

  /// Draggable hit box over a decoration, so a designer can place artwork
  /// anywhere on or around the cover by dragging it in the preview.
  Widget _handle(int index, double width, double height, double spill) {
    final item = design.decorations[index];
    final size = item.size * width;
    return Positioned(
      left: spill + item.x * width - size / 2,
      top: spill + item.y * height - size / 2,
      width: size,
      height: size,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => setState(() => selected = index),
        onPanUpdate: (details) {
          _updateDecoration(
            index,
            (current) => current.copyWith(
              x: (current.x + details.delta.dx / width).clamp(-.2, 1.2),
              y: (current.y + details.delta.dy / height).clamp(-.2, 1.2),
            ),
          );
        },
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(
              color: selected == index ? coverCoral : const Color(0x33ffffff),
              width: selected == index ? 1.6 : .8,
            ),
          ),
        ),
      ),
    );
  }

  Widget _background(BuildContext c) {
    final background = design.background;
    final colors = background.colors.length >= 2
        ? background.colors
        : const [Color(0xffd93b30), Color(0xfff3d19c)];
    return _section(c, tr(c, 'coverBackground'), [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final type in const ['solid', 'gradient', 'image', 'video'])
            _Pill(
              label: tr(
                c,
                type == 'solid'
                    ? 'coverSolid'
                    : type == 'gradient'
                    ? 'coverGradient'
                    : type == 'image'
                    ? 'coverImage'
                    : 'coverVideo',
              ),
              selected: type == 'video'
                  ? background.isVideo
                  : background.type == type,
              onTap: () {
                if (type == 'gradient') {
                  _apply(
                    design.copyWith(
                      background: background.copyWith(
                        type: type,
                        colors: colors,
                      ),
                    ),
                  );
                } else {
                  _setBackgroundType(type == 'video' ? 'mp4' : type);
                }
              },
            ),
        ],
      ),
      const SizedBox(height: 14),
      if (background.type == 'solid')
        _swatches(
          c,
          _coverColors,
          background.color,
          (color) => _apply(
            design.copyWith(background: background.copyWith(color: color)),
          ),
        )
      else if (background.type == 'gradient') ...[
        Text(
          tr(c, 'coverGradientStart'),
          style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
        ),
        const SizedBox(height: 8),
        _swatches(
          c,
          _coverColors,
          colors.first,
          (color) => _apply(
            design.copyWith(
              background: background.copyWith(colors: [color, colors[1]]),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          tr(c, 'coverGradientEnd'),
          style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
        ),
        const SizedBox(height: 8),
        _swatches(
          c,
          _coverColors,
          colors[1],
          (color) => _apply(
            design.copyWith(
              background: background.copyWith(colors: [colors.first, color]),
            ),
          ),
        ),
      ] else ...[
        Row(
          children: [
            Container(
              width: 64,
              height: 64,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: qchatFill(c),
                borderRadius: BorderRadius.circular(8),
              ),
              child: background.hasMedia
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        if (background.isVideo) ...[
                          MediaVideo(
                            id: background.mediaId!,
                            fit: BoxFit.cover,
                            placeholder: background.color,
                            extension: background.videoExtension,
                          ),
                          IgnorePointer(
                            child: Center(
                              child: QChatIcon(
                                'play',
                                size: 20,
                                color: const Color(0xccffffff),
                              ),
                            ),
                          ),
                        ] else
                          MediaImage(
                            id: background.mediaId!,
                            fit: BoxFit.cover,
                          ),
                      ],
                    )
                  : Center(
                      child: QChatIcon(
                        'image',
                        size: 24,
                        color: QChatColors.muted,
                      ),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: CoralButton(
                tr(c, background.isVideo ? 'coverPickVideo' : 'coverPickImage'),
                height: 40,
                secondary: true,
                loading: uploading,
                onTap: () => _pickPhoto(video: background.isVideo),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          tr(c, 'coverMediaFillNote'),
          style: TextStyle(fontSize: 12, height: 1.4, color: qchatMuted(c)),
        ),
      ],
    ]);
  }

  /// The chat bubble is edited on its own: its own picture, and the two golds
  /// that fade the picture in. The preview is the real chat card, so a designer
  /// sees exactly what a message will look like.
  Widget _message(BuildContext c) {
    final message = design.message;
    return _section(c, tr(c, 'coverMessage'), [
      Text(
        tr(c, 'coverMessageNote'),
        style: TextStyle(fontSize: 12, height: 1.4, color: qchatMuted(c)),
      ),
      const SizedBox(height: 14),
      Center(
        child: MoneyMessageCard(
          key: const ValueKey('cover-message-preview'),
          message: {
            'kind': 'RED_PACKET',
            'text': jsonEncode({
              'amount': 0,
              'note': tr(c, 'coverMessageGreeting'),
              'cover': design.toJson(),
            }),
          },
          mine: false,
          onTap: () {},
        ),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          Container(
            width: 52,
            height: 46,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: qchatFill(c),
              borderRadius: BorderRadius.circular(6),
            ),
            child: message.hasImage
                ? MediaImage(id: message.imageId!, fit: BoxFit.cover)
                : const Center(
                    child: QChatIcon(
                      'image',
                      size: 22,
                      color: QChatColors.muted,
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: CoralButton(
              tr(
                c,
                message.hasImage
                    ? 'coverMessageReplaceImage'
                    : 'coverMessagePickImage',
              ),
              height: 40,
              secondary: true,
              loading: uploading,
              onTap: () => _pickPhoto(message: true),
            ),
          ),
        ],
      ),
      if (message.hasImage) ...[
        const SizedBox(height: 8),
        CoralButton(
          tr(c, 'coverMessageRemoveImage'),
          height: 36,
          secondary: true,
          onTap: _clearMessageImage,
        ),
      ],
      const SizedBox(height: 16),
      Text(
        tr(c, 'coverGradientStart'),
        style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
      ),
      const SizedBox(height: 8),
      _swatches(
        c,
        _messageColors,
        message.startColor,
        (color) => _apply(
          design.copyWith(message: message.copyWith(startColor: color)),
        ),
      ),
      const SizedBox(height: 12),
      Text(
        tr(c, 'coverGradientEnd'),
        style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
      ),
      const SizedBox(height: 8),
      _swatches(
        c,
        _messageColors,
        message.endColor,
        (color) =>
            _apply(design.copyWith(message: message.copyWith(endColor: color))),
      ),
    ]);
  }

  Widget _decorations(BuildContext c) {
    return _section(c, tr(c, 'coverDecorations'), [
      Text(
        tr(c, 'coverAddDecoration'),
        style: TextStyle(fontSize: 12, color: qchatMuted(c)),
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final emoji in _emojis)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _addDecoration(emoji),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: qchatFill(c),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 21)),
              ),
            ),
        ],
      ),
      const SizedBox(height: 8),
      Text(
        tr(c, 'coverAreaAllNote'),
        style: TextStyle(fontSize: 12, height: 1.4, color: qchatMuted(c)),
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Expanded(
            child: QChatTextInput(
              controller: decorationText,
              hint: tr(c, 'coverTextHint'),
              maxLength: 24,
            ),
          ),
          const SizedBox(width: 8),
          CoralButton(
            tr(c, 'coverAddText'),
            height: 40,
            secondary: true,
            onTap: () {
              final value = decorationText.text.trim();
              if (value.isEmpty) return;
              _addDecoration(value, kind: 'text');
              decorationText.clear();
            },
          ),
        ],
      ),
      const SizedBox(height: 8),
      CoralButton(
        tr(c, 'coverAddImage'),
        height: 40,
        secondary: true,
        loading: uploading,
        onTap: () => _pickPhoto(decoration: true),
      ),
      if (design.decorations.isNotEmpty) ...[
        const SizedBox(height: 14),
        for (var index = 0; index < design.decorations.length; index++)
          _decorationRow(c, index),
      ],
    ]);
  }

  Widget _decorationRow(BuildContext c, int index) {
    final item = design.decorations[index];
    final open = selected == index;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: qchatFill(c),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: open ? coverCoral : QChatColors.transparent,
            width: 1.2,
          ),
        ),
        child: Column(
          children: [
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => selected = open ? null : index),
              child: Row(
                children: [
                  SizedBox(
                    width: 30,
                    height: 30,
                    child: item.kind == 'image'
                        ? MediaImage(id: item.value, fit: BoxFit.contain)
                        : Center(
                            child: Text(
                              item.value,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: item.kind == 'text' ? 14 : 20,
                                color: ink(c),
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tr(
                        c,
                        item.area == 'bottom'
                            ? 'coverAreaBottom'
                            : item.area == 'all'
                            ? 'coverAreaAll'
                            : 'coverAreaTop',
                      ),
                      style: TextStyle(fontSize: 13, color: ink(c)),
                    ),
                  ),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _removeDecoration(index),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: QChatIcon(
                        'delete',
                        size: 18,
                        color: QChatColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (open) ...[
              const SizedBox(height: 8),
              _sliderRow(
                c,
                item.size,
                .04,
                .9,
                (value) => _updateDecoration(
                  index,
                  (current) => current.copyWith(size: value),
                ),
              ),
              _sliderRow(
                c,
                item.rotation,
                -3.14,
                3.14,
                (value) => _updateDecoration(
                  index,
                  (current) => current.copyWith(rotation: value),
                ),
                display: '${(item.rotation * 180 / 3.14159265).round()}°',
              ),
              const SizedBox(height: 4),
              _choiceRow(
                c,
                label: tr(c, 'coverDecorationArea'),
                values: const ['top', 'bottom', 'all'],
                current: item.area,
                text: (value) => tr(
                  c,
                  value == 'top'
                      ? 'coverAreaTop'
                      : value == 'bottom'
                      ? 'coverAreaBottom'
                      : 'coverAreaAll',
                ),
                onPick: (value) => _updateDecoration(
                  index,
                  (current) => current.copyWith(area: value),
                ),
              ),
              const SizedBox(height: 8),
              _choiceRow(
                c,
                label: tr(c, 'coverAnimation'),
                values: const ['none', 'float', 'pulse', 'sparkle'],
                current: item.animation,
                text: (value) => tr(
                  c,
                  value == 'none'
                      ? 'coverAnimationNone'
                      : value == 'float'
                      ? 'coverAnimationFloat'
                      : value == 'pulse'
                      ? 'coverAnimationPulse'
                      : 'coverAnimationSparkle',
                ),
                onPick: (value) => _updateDecoration(
                  index,
                  (current) => current.copyWith(animation: value),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _section(BuildContext c, String title, List<Widget> children) =>
      CoverSurface(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: ink(c),
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      );

  Widget _sliderRow(
    BuildContext c,
    double value,
    double min,
    double max,
    ValueChanged<double> onChanged, {
    String? display,
  }) => Row(
    children: [
      Expanded(
        child: QChatSlider(
          value: value,
          min: min,
          max: max,
          activeColor: coverCoral,
          onChanged: onChanged,
        ),
      ),
      SizedBox(
        width: 42,
        child: Text(
          display ?? '${(value * 100).round()}%',
          textAlign: TextAlign.right,
          style: TextStyle(fontSize: 12.5, color: qchatMuted(c)),
        ),
      ),
    ],
  );

  Widget _swatches(
    BuildContext c,
    List<Color> colors,
    Color current,
    ValueChanged<Color> onPick, {
    bool checker = false,
  }) => Wrap(
    spacing: 9,
    runSpacing: 9,
    children: [
      for (final color in colors)
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onPick(color),
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: checker ? null : color,
              gradient: checker
                  ? LinearGradient(
                      colors: [color.withValues(alpha: .15), color],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : null,
              shape: BoxShape.circle,
              border: Border.all(
                color: current == color ? coverCoral : qchatLine(c),
                width: current == color ? 2.4 : 1,
              ),
            ),
            child: current == color
                ? const Center(
                    child: QChatIcon(
                      'check',
                      size: 15,
                      color: QChatColors.white,
                    ),
                  )
                : null,
          ),
        ),
    ],
  );

  Widget _toggle(
    BuildContext c,
    String label,
    bool value,
    ValueChanged<bool> onChanged,
  ) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: TextStyle(fontSize: 14, color: ink(c))),
        ),
        QChatSwitch(
          value: value,
          activeColor: coverCoral,
          onChanged: onChanged,
        ),
      ],
    ),
  );

  Widget _choiceRow(
    BuildContext c, {
    required String label,
    required List<String> values,
    required String current,
    required String Function(String) text,
    required ValueChanged<String> onPick,
  }) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      SizedBox(
        width: 58,
        child: Text(
          label,
          style: TextStyle(fontSize: 12, color: qchatMuted(c)),
        ),
      ),
      Expanded(
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final value in values)
              _Pill(
                label: text(value),
                selected: current == value,
                onTap: () => onPick(value),
              ),
          ],
        ),
      ),
    ],
  );
}

/// Small pill used by the studio's segmented choices.
class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 130),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: selected ? coverCoral : qchatFill(context),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
          color: selected ? QChatColors.white : ink(context),
        ),
      ),
    ),
  );
}

/// Mock of the opened receipt: the decorated header at the design's height and
/// a few grey lines standing in for the amount and the footer.
class _OpenedPreview extends StatelessWidget {
  const _OpenedPreview({required this.design});

  final CoverDesign design;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(8),
    child: ColoredBox(
      color: const Color(0xffffffff),
      child: LayoutBuilder(
        builder: (context, box) {
          final header = (box.maxHeight * design.receiptHeight).clamp(
            34.0,
            box.maxHeight * .7,
          );
          return Column(
            children: [
              SizedBox(
                height: header,
                width: double.infinity,
                child: RedPacketOpenedTop(design: design),
              ),
              const SizedBox(height: 10),
              Container(
                width: box.maxWidth * .34,
                height: 7,
                decoration: BoxDecoration(
                  color: const Color(0xffd8d8d8),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: box.maxWidth * .55,
                height: 13,
                decoration: BoxDecoration(
                  color: const Color(0xffc9a063),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                width: box.maxWidth * .4,
                height: 5,
                decoration: BoxDecoration(
                  color: const Color(0xffe4e4e4),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}
