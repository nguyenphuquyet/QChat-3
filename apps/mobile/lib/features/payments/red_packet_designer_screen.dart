import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_design.dart';
import '../stickers/sticker_models.dart';
import '../stickers/sticker_workshop.dart';
import 'red_packet_cover_preview_screen.dart';
import 'red_packet_cover_ui.dart';

/// "Xưởng thiết kế": the private studio hub of a cover designer.
///
/// A designer identity is separate from the QChat account — its own display
/// name and bio — but it is linked to it through `userId`, and the hub shows
/// that link so the owner always knows which QChat account is publishing.
class RedPacketDesignerScreen extends ConsumerStatefulWidget {
  const RedPacketDesignerScreen({super.key});

  @override
  ConsumerState<RedPacketDesignerScreen> createState() =>
      _RedPacketDesignerScreenState();
}

class _RedPacketDesignerScreenState
    extends ConsumerState<RedPacketDesignerScreen> {
  late Future<dynamic> data;
  final displayName = TextEditingController();
  final bio = TextEditingController();
  final scroll = ScrollController();
  bool editing = false;
  bool busy = false;
  int tab = 0;
  String? error;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    displayName.dispose();
    bio.dispose();
    scroll.dispose();
    super.dispose();
  }

  /// Switching category starts at the top of the new list, so a long cover
  /// gallery never leaves the sticker tab half-scrolled.
  void _selectTab(int next) {
    if (next == tab) return;
    if (scroll.hasClients) scroll.jumpTo(0);
    setState(() => tab = next);
  }

  void _reload() {
    data = ref.read(clientProvider).get('/wallet/designer', cached: false);
  }

  void _startEditing(Map designer) {
    displayName.text = designer['displayName']?.toString() ?? '';
    bio.text = designer['bio']?.toString() ?? '';
    setState(() => editing = true);
  }

  Future<void> _save({bool existing = false}) async {
    if (busy) return;
    final name = displayName.text.trim();
    if (name.isEmpty) {
      showQChatToast(context, tr(context, 'designerDisplayName'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final client = ref.read(clientProvider);
      if (existing) {
        await client.dio.patch(
          '/wallet/designer',
          data: {'displayName': name, 'bio': bio.text.trim()},
        );
      } else {
        await client.post('/wallet/designer', {
          'displayName': name,
          'bio': bio.text.trim(),
        });
      }
      client.changes.add(null);
      if (!mounted) return;
      setState(() {
        editing = false;
        busy = false;
        _reload();
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

  Future<void> _togglePublish(RedPacketCoverData cover) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final client = ref.read(clientProvider);
      await client.dio.patch(
        '/wallet/covers/${cover.id}',
        data: {'publish': !cover.published},
      );
      client.changes.add(null);
      if (!mounted) return;
      setState(() {
        busy = false;
        _reload();
      });
    } catch (_) {
      if (mounted) {
        setState(() => busy = false);
        showQChatToast(context, tr(context, 'networkError'));
      }
    }
  }

  Future<void> _delete(RedPacketCoverData cover) async {
    final ok = await confirmAction(
      context,
      tr(context, 'coverRemove'),
      tr(context, 'coverDeleteConfirm'),
    );
    if (!ok || !mounted) return;
    setState(() => busy = true);
    try {
      final client = ref.read(clientProvider);
      await client.dio.delete('/wallet/covers/${cover.id}');
      client.changes.add(null);
      if (!mounted) return;
      showQChatToast(context, tr(context, 'coverDeleted'));
      setState(() {
        busy = false;
        _reload();
      });
    } catch (_) {
      if (mounted) {
        setState(() => busy = false);
        showQChatToast(context, tr(context, 'networkError'));
      }
    }
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'designerHub'),
    glassHeader: false,
    leading: QChatIconButton(
      'close',
      label: tr(c, 'close'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'palette',
      label: tr(c, 'coverStudio'),
      onTap: () async {
        final saved = await c.push<bool>('/red-packets/designer/cover');
        if (saved == true) setState(_reload);
      },
    ),
    child: FutureBuilder<dynamic>(
      future: data,
      builder: (c, snapshot) {
        if (snapshot.hasError) {
          return QChatError(
            error: snapshot.error!,
            retry: () => setState(_reload),
          );
        }
        if (!snapshot.hasData) return const QChatLoading();
        final designer =
            snapshot.data is Map && snapshot.data['designer'] is Map
            ? Map<String, dynamic>.from(snapshot.data['designer'] as Map)
            : null;
        if (designer == null || editing) {
          return _form(c, designer);
        }
        return _hub(c, designer);
      },
    ),
  );

  Widget _form(BuildContext c, Map<String, dynamic>? designer) {
    final user = designer?['user'] is Map
        ? Map<String, dynamic>.from(designer!['user'] as Map)
        : const <String, dynamic>{};
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      children: [
        const Center(child: QChatIcon('palette', size: 52, color: coverCoral)),
        const SizedBox(height: 16),
        Text(
          tr(c, designer == null ? 'designerCreate' : 'coverDesigner'),
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
        const SizedBox(height: 22),
        if (user.isNotEmpty) ...[
          CoverSurface(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                UserAvatar(user, size: 34),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user['nickname']?.toString() ?? '',
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
                        tr(c, 'designerLinkedTo'),
                        style: TextStyle(fontSize: 12, color: qchatMuted(c)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        QChatTextInput(
          controller: displayName,
          hint: tr(c, 'designerDisplayName'),
          maxLength: 40,
        ),
        const SizedBox(height: 10),
        QChatTextInput(
          controller: bio,
          hint: tr(c, 'designerBio'),
          lines: 3,
          maxLength: 200,
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: QChatColors.danger, fontSize: 13),
            ),
          ),
        const SizedBox(height: 18),
        CoralButton(
          tr(c, designer == null ? 'designerCreate' : 'save'),
          height: 46,
          loading: busy,
          onTap: () => _save(existing: designer != null),
        ),
        if (designer != null) ...[
          const SizedBox(height: 10),
          CoralButton(
            tr(c, 'cancel'),
            height: 44,
            secondary: true,
            onTap: () => setState(() => editing = false),
          ),
        ],
        const SizedBox(height: 24),
        const StickerWorkshop(accent: coverCoral),
      ],
    );
  }

  Widget _hub(BuildContext c, Map<String, dynamic> designer) {
    final user = designer['user'] is Map
        ? Map<String, dynamic>.from(designer['user'] as Map)
        : const <String, dynamic>{};
    final covers = [
      for (final item
          in (designer['covers'] is List
              ? designer['covers'] as List
              : const []))
        if (RedPacketCoverData.fromJson(item) != null)
          RedPacketCoverData.fromJson(item)!,
    ];
    final claims = covers.fold<int>(0, (sum, cover) => sum + cover.claimCount);
    final published = covers.where((cover) => cover.published).length;
    final name = designer['displayName']?.toString() ?? '';
    final linkedName = user['nickname']?.toString() ?? '';
    final designerId = designer['userId']?.toString() ?? '';
    return CustomScrollView(
      controller: scroll,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          sliver: SliverToBoxAdapter(
            child: Column(
              children: [
                CoverSurface(
                  padding: const EdgeInsets.fromLTRB(16, 16, 12, 14),
                  child: Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(9),
                              border: Border.all(color: coverCoral, width: 1.5),
                            ),
                            child: UserAvatar({
                              'nickname': name,
                              if ((user['avatarId'] ?? '')
                                  .toString()
                                  .isNotEmpty)
                                'avatarId': user['avatarId'],
                            }, size: 54),
                          ),
                          const SizedBox(width: 13),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 19,
                                    fontWeight: FontWeight.w600,
                                    color: ink(c),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  designer['bio']?.toString().isNotEmpty == true
                                      ? designer['bio'].toString()
                                      : tr(c, 'coverDesigner'),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    height: 1.45,
                                    color: qchatMuted(c),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 4),
                          _iconChip(
                            c,
                            'pencil',
                            tr(c, 'edit'),
                            () => _startEditing(designer),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: _statCell(
                              c,
                              '${covers.length}',
                              tr(c, 'designerCovers'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _statCell(
                              c,
                              '$claims',
                              tr(c, 'designerClaims'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _statCell(
                              c,
                              '$published',
                              tr(c, 'coverStatusLive'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: designerId.isEmpty
                            ? null
                            : () =>
                                  c.push('/red-packets/designers/$designerId'),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
                          decoration: BoxDecoration(
                            color: qchatFill(c),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              UserAvatar(user, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  linkedName.isEmpty
                                      ? tr(c, 'designerLinkedTo')
                                      : '${tr(c, 'designerLinkedTo')} · $linkedName',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: qchatMuted(c),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              const QChatIcon(
                                'chevron',
                                size: 14,
                                color: QChatColors.muted,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                CoralButton(
                  tr(c, 'designerNewCover'),
                  height: 48,
                  icon: 'plus',
                  onTap: () async {
                    final saved = await c.push<bool>(
                      '/red-packets/designer/cover',
                    );
                    if (saved == true) setState(_reload);
                  },
                ),
                const SizedBox(height: 8),
                CoralButton(
                  tr(c, 'designerOpenMarket'),
                  height: 44,
                  secondary: true,
                  icon: 'grid',
                  onTap: () => c.push('/red-packets/covers/market'),
                ),
              ],
            ),
          ),
        ),
        // The category switch stays pinned under the app bar while a long
        // cover gallery scrolls, so the sticker shelf is always one tap away.
        SliverPersistentHeader(
          pinned: true,
          delegate: _DesignerTabsDelegate(
            labels: [
              '${tr(c, 'designerCovers')} (${covers.length})',
              tr(c, 'designerStickerPacks'),
            ],
            index: tab,
            onChanged: _selectTab,
          ),
        ),
        if (tab == 0) ...[
          if (covers.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              sliver: SliverToBoxAdapter(
                child: CoverSurface(
                  padding: const EdgeInsets.symmetric(vertical: 30),
                  child: Column(
                    children: [
                      const QChatIcon(
                        'palette',
                        size: 34,
                        color: QChatColors.muted,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        tr(c, 'designerNoCovers'),
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: qchatMuted(c)),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: .62,
                ),
                delegate: SliverChildBuilderDelegate(
                  (c, i) => _coverCard(c, covers[i]),
                  childCount: covers.length,
                ),
              ),
            ),
        ] else
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 0),
            sliver: SliverToBoxAdapter(
              child: StickerWorkshop(accent: coverCoral),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 40)),
      ],
    );
  }

  Widget _statCell(BuildContext c, String value, String label) => Container(
    padding: const EdgeInsets.symmetric(vertical: 8),
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: qchatFill(c),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          maxLines: 1,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: ink(c),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 11, color: qchatMuted(c)),
        ),
      ],
    ),
  );

  Widget _iconChip(
    BuildContext c,
    String icon,
    String label,
    VoidCallback onTap,
  ) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: qchatFill(c), shape: BoxShape.circle),
        child: QChatIcon(icon, size: 16, color: qchatMuted(c)),
      ),
    ),
  );

  /// One cover in the two-column gallery. The artwork opens the preview; the
  /// pill in the corner opens publish / edit / delete, so the card itself stays
  /// clean instead of stacking a row of text links under every cover.
  Widget _coverCard(BuildContext c, RedPacketCoverData cover) => CoverSurface(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Stack(
            fit: StackFit.expand,
            children: [
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => showRedPacketCoverPreview(c, cover),
                child: CoverThumb(
                  design: cover.design,
                  showOpen: false,
                  radius: 0,
                ),
              ),
              Positioned(
                left: 8,
                bottom: 8,
                child: IgnorePointer(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2.5,
                    ),
                    decoration: BoxDecoration(
                      color: cover.published
                          ? coverCoral
                          : const Color(0x99000000),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      tr(
                        c,
                        cover.published
                            ? 'coverStatusLive'
                            : 'coverStatusDraft',
                      ),
                      style: const TextStyle(
                        fontSize: 10,
                        color: QChatColors.white,
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(top: 5, right: 5, child: _coverMenuButton(c, cover)),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 7, 10, 9),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                cover.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                  color: ink(c),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${cover.claimCount} ${tr(c, 'designerClaims')}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: qchatMuted(c)),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _coverMenuButton(BuildContext c, RedPacketCoverData cover) =>
      GestureDetector(
        key: ValueKey('designer-cover-menu-${cover.id}'),
        behavior: HitTestBehavior.opaque,
        onTap: () => qchatSheet(c, [
          (
            tr(c, cover.published ? 'coverUnpublish' : 'coverPublishShort'),
            () => _togglePublish(cover),
          ),
          (
            tr(c, 'edit'),
            () async {
              final saved = await c.push<bool>(
                '/red-packets/designer/cover',
                extra: cover,
              );
              if (saved == true && mounted) setState(_reload);
            },
          ),
          (tr(c, 'coverRemove'), () => _delete(cover)),
        ]),
        child: Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Color(0xcc000000),
            shape: BoxShape.circle,
          ),
          child: const QChatIcon('more', size: 14, color: QChatColors.white),
        ),
      );
}

/// The category switch shared by the studio and a designer's public page.
/// It is pinned while the list scrolls so a long cover gallery never hides the
/// sticker shelf.
class _DesignerTabsDelegate extends SliverPersistentHeaderDelegate {
  _DesignerTabsDelegate({
    required this.labels,
    required this.index,
    required this.onChanged,
  });

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  double get minExtent => 54;

  @override
  double get maxExtent => 54;

  @override
  Widget build(BuildContext c, double shrinkOffset, bool overlapsContent) =>
      SizedBox.expand(
        child: ColoredBox(
          color: qchatBackground(c),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: QChatTabBar(
              labels: labels,
              index: index,
              onChanged: onChanged,
              accent: coverCoral,
            ),
          ),
        ),
      );

  @override
  bool shouldRebuild(covariant _DesignerTabsDelegate old) =>
      old.index != index ||
      old.onChanged != onChanged ||
      old.labels.join('|') != labels.join('|');
}

/// Public page of a designer, opened from a cover card. It shows only the
/// public identity, the published covers and the published sticker packs.
class RedPacketDesignerProfileScreen extends ConsumerStatefulWidget {
  const RedPacketDesignerProfileScreen({super.key, required this.designerId});

  final String designerId;

  @override
  ConsumerState<RedPacketDesignerProfileScreen> createState() =>
      _RedPacketDesignerProfileScreenState();
}

class _RedPacketDesignerProfileScreenState
    extends ConsumerState<RedPacketDesignerProfileScreen> {
  late Future<dynamic> data;
  final scroll = ScrollController();
  int tab = 0;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  void _selectTab(int next) {
    if (next == tab) return;
    if (scroll.hasClients) scroll.jumpTo(0);
    setState(() => tab = next);
  }

  void _reload() {
    data = ref
        .read(clientProvider)
        .get('/wallet/designers/${widget.designerId}', cached: false);
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'coverDesigner'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: FutureBuilder<dynamic>(
      future: data,
      builder: (c, snapshot) {
        if (snapshot.hasError) {
          return QChatError(
            error: snapshot.error!,
            retry: () => setState(_reload),
          );
        }
        if (!snapshot.hasData) return const QChatLoading();
        final designer =
            snapshot.data is Map && snapshot.data['designer'] is Map
            ? Map<String, dynamic>.from(snapshot.data['designer'] as Map)
            : null;
        if (designer == null) {
          return QChatEmptyState(tr(c, 'coverNotFound'), icon: 'palette');
        }
        final user = designer['user'] is Map
            ? Map<String, dynamic>.from(designer['user'] as Map)
            : const <String, dynamic>{};
        final covers = [
          for (final item
              in (designer['covers'] is List
                  ? designer['covers'] as List
                  : const []))
            if (RedPacketCoverData.fromJson(item) != null)
              RedPacketCoverData.fromJson(item)!,
        ];
        final packs = [
          for (final item
              in (designer['stickerPacks'] is List
                  ? designer['stickerPacks'] as List
                  : const []))
            if (StickerPack.fromJson(item).id.isNotEmpty)
              StickerPack.fromJson(item),
        ];
        return CustomScrollView(
          controller: scroll,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  children: [
                    UserAvatar({
                      'nickname': designer['displayName'],
                      if ((user['avatarId'] ?? '').toString().isNotEmpty)
                        'avatarId': user['avatarId'],
                    }, size: 58),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            designer['displayName']?.toString() ?? '',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w600,
                              color: ink(c),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            designer['bio']?.toString().isNotEmpty == true
                                ? designer['bio'].toString()
                                : tr(c, 'coverDesigner'),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              height: 1.4,
                              color: qchatMuted(c),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _DesignerTabsDelegate(
                labels: [
                  '${tr(c, 'designerCovers')} (${covers.length})',
                  '${tr(c, 'designerStickerPacks')} (${packs.length})',
                ],
                index: tab,
                onChanged: _selectTab,
              ),
            ),
            if (tab == 0) ...[
              if (covers.isEmpty)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  sliver: SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 26),
                      child: QChatEmptyState(
                        tr(c, 'designerNoCovers'),
                        icon: 'palette',
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: .56,
                        ),
                    delegate: SliverChildBuilderDelegate(
                      (c, i) => CoverSurface(
                        padding: const EdgeInsets.all(9),
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => showRedPacketCoverPreview(c, covers[i]),
                          child: Column(
                            children: [
                              Expanded(
                                child: Center(
                                  child: CoverThumb(
                                    design: covers[i].design,
                                    showOpen: false,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                covers[i].name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 13, color: ink(c)),
                              ),
                            ],
                          ),
                        ),
                      ),
                      childCount: covers.length,
                    ),
                  ),
                ),
            ] else if (packs.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 26),
                    child: QChatEmptyState(
                      tr(c, 'designerNoStickerPacks'),
                      icon: 'stickerV',
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final pack in packs) ...[
                          StickerPackTile(
                            key: ValueKey('designer-pack-${pack.id}'),
                            pack: pack,
                            onTap: () => c.push('/stickers/${pack.id}'),
                          ),
                          const SizedBox(width: 10),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        );
      },
    ),
  );
}
