import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_design.dart';
import 'red_packet_cover_preview_screen.dart';
import 'red_packet_cover_ui.dart';

/// "Vỏ hồng bao của tôi": the covers an account owns, with the two actions of
/// the reference (create a cover, get a cover).
class RedPacketCoversScreen extends ConsumerStatefulWidget {
  const RedPacketCoversScreen({super.key, this.pick = false});

  /// When true the screen is opened from the send sheet and picking a cover
  /// returns its id instead of only switching the active cover.
  final bool pick;

  @override
  ConsumerState<RedPacketCoversScreen> createState() =>
      _RedPacketCoversScreenState();
}

class _RedPacketCoversScreenState
    extends ConsumerState<RedPacketCoversScreen> {
  late Future<dynamic> covers;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    covers = ref.read(clientProvider).get('/wallet/covers', cached: false);
  }

  Future<void> _select(RedPacketCoverData cover) async {
    if (busy) return;
    if (widget.pick) {
      Navigator.of(context).pop(cover);
      return;
    }
    setState(() => busy = true);
    try {
      await ref
          .read(clientProvider)
          .post('/wallet/covers/${cover.id}/select', {});
      ref.read(clientProvider).changes.add(null);
      if (mounted) setState(_reload);
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'myRedPacketCovers'),
    glassHeader: false,
    leading: QChatIconButton(
      'close',
      label: tr(c, 'close'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'search',
      label: tr(c, 'search'),
      onTap: () => c.push('/red-packets/covers/market'),
    ),
    child: FutureBuilder<dynamic>(
      future: covers,
      builder: (c, snapshot) {
        if (snapshot.hasError) {
          return QChatError(
            error: snapshot.error!,
            retry: () => setState(_reload),
          );
        }
        if (!snapshot.hasData) return const QChatLoading();
        final rows = snapshot.data is Map && snapshot.data['items'] is List
            ? [
                for (final item in snapshot.data['items'] as List)
                  if (RedPacketCoverData.fromJson(item) != null)
                    RedPacketCoverData.fromJson(item)!,
              ]
            : <RedPacketCoverData>[];
        RedPacketCoverData? chosen;
        for (final row in rows) {
          if (row.selected) {
            chosen = row;
            break;
          }
        }
        final selected = chosen ?? RedPacketCoverData.defaultCover;
        final items = [
          RedPacketCoverData.defaultCover.copyWith(selected: selected.id == 'default'),
          ...rows.map(
            (item) => item.copyWith(selected: item.id == selected.id),
          ),
        ];
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            CoverSurface(
              padding: const EdgeInsets.symmetric(vertical: 18),
              child: Row(
                children: [
                  Expanded(
                    child: _CoverAction(
                      icon: 'plus',
                      label: tr(c, 'createMyCover'),
                      onTap: () => c.push('/red-packets/designer/cover'),
                    ),
                  ),
                  Expanded(
                    child: _CoverAction(
                      icon: 'gift',
                      label: tr(c, 'claimCover'),
                      onTap: () => c.push('/red-packets/covers/market'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: .50,
              children: [
                for (final cover in items)
                  _CoverCard(
                    cover: cover,
                    pick: widget.pick,
                    busy: busy && cover.selected,
                    onUse: widget.pick || !cover.selected
                        ? () => _select(cover)
                        : null,
                  ),
              ],
            ),
            const SizedBox(height: 22),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => c.push('/red-packets/covers/market'),
              child: Center(
                child: Text(
                  tr(c, 'noMoreCovers'),
                  style: const TextStyle(fontSize: 14, color: Color(0xff576b95)),
                ),
              ),
            ),
            const SizedBox(height: 26),
            // TODO(red-packet-cover): list expired covers once covers can
            // expire. The reference keeps the link at the bottom.
            Center(
              child: Text(
                tr(c, 'expiredCovers'),
                style: const TextStyle(fontSize: 14, color: Color(0xff576b95)),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _CoverAction extends StatelessWidget {
  const _CoverAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final String icon, label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: coverCoral, width: 1.4),
          ),
          child: Center(child: QChatIcon(icon, color: coverCoral, size: 25)),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: const TextStyle(fontSize: 14, color: coverCoral),
        ),
      ],
    ),
  );
}

class _CoverCard extends StatelessWidget {
  const _CoverCard({
    required this.cover,
    required this.onUse,
    this.pick = false,
    this.busy = false,
  });

  final RedPacketCoverData cover;
  final VoidCallback? onUse;
  final bool pick, busy;

  @override
  Widget build(BuildContext context) => CoverSurface(
    padding: const EdgeInsets.all(10),
    child: Column(
      children: [
        Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showRedPacketCoverPreview(context, cover),
            child: Center(child: CoverThumb(design: cover.design)),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          cover.id == 'default'
              ? tr(context, 'defaultCover')
              : cover.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 14, color: ink(context)),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: CoralButton(
            pick || !cover.selected
                ? tr(context, 'useCover')
                : tr(context, 'coverInUse'),
            height: 34,
            loading: busy,
            onTap: onUse,
          ),
        ),
      ],
    ),
  );
}

/// "Chợ vỏ hồng bao": every published cover, with search.
class RedPacketCoverMarketScreen extends ConsumerStatefulWidget {
  const RedPacketCoverMarketScreen({super.key});

  @override
  ConsumerState<RedPacketCoverMarketScreen> createState() =>
      _RedPacketCoverMarketScreenState();
}

class _RedPacketCoverMarketScreenState
    extends ConsumerState<RedPacketCoverMarketScreen> {
  final search = TextEditingController();
  Timer? debounce;
  late Future<dynamic> covers;
  String query = '';

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  void _reload() {
    final suffix = query.isEmpty
        ? ''
        : '?q=${Uri.encodeQueryComponent(query)}';
    covers = ref
        .read(clientProvider)
        .get('/wallet/covers/market$suffix', cached: false);
  }

  void _search(String value) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 280), () {
      if (!mounted) return;
      setState(() {
        query = value.trim();
        _reload();
      });
    });
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'coverMarket'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
          child: QChatSearchBar(
            controller: search,
            onChanged: _search,
          ),
        ),
        Expanded(
          child: FutureBuilder<dynamic>(
            future: covers,
            builder: (c, snapshot) {
              if (snapshot.hasError) {
                return QChatError(
                  error: snapshot.error!,
                  retry: () => setState(_reload),
                );
              }
              if (!snapshot.hasData) return const QChatLoading();
              final items = snapshot.data is Map &&
                      snapshot.data['items'] is List
                  ? [
                      for (final item in snapshot.data['items'] as List)
                        if (RedPacketCoverData.fromJson(item) != null)
                          RedPacketCoverData.fromJson(item)!,
                    ]
                  : <RedPacketCoverData>[];
              if (items.isEmpty) {
                return QChatEmptyState(
                  tr(c, 'noMoreCovers'),
                  icon: 'gift',
                );
              }
              return GridView.count(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 28),
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: .58,
                children: [
                  for (final cover in items)
                    _MarketCard(cover: cover),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}

class _MarketCard extends StatelessWidget {
  const _MarketCard({required this.cover});

  final RedPacketCoverData cover;

  @override
  Widget build(BuildContext context) => CoverSurface(
    padding: const EdgeInsets.all(9),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => showRedPacketCoverPreview(context, cover),
      child: Column(
        children: [
          Expanded(child: Center(child: CoverThumb(design: cover.design))),
          const SizedBox(height: 8),
          DesignerLine(
            name: cover.designerName,
            avatarId: cover.designerAvatar,
            qchatId: cover.designerQchatId,
            onTap: () {
              if ((cover.designerId ?? '').isNotEmpty) {
                context.push('/red-packets/designers/${cover.designerId}');
              }
            },
          ),
        ],
      ),
    ),
  );
}
