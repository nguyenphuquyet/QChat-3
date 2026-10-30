import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_design.dart';
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
  bool editing = false;
  bool busy = false;
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
    super.dispose();
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
        await client.dio.patch('/wallet/designer', data: {
          'displayName': name,
          'bio': bio.text.trim(),
        });
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
      tr(context, 'delete'),
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
        const Center(
          child: QChatIcon('palette', size: 52, color: coverCoral),
        ),
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
      ],
    );
  }

  Widget _hub(BuildContext c, Map<String, dynamic> designer) {
    final user = designer['user'] is Map
        ? Map<String, dynamic>.from(designer['user'] as Map)
        : const <String, dynamic>{};
    final covers = [
      for (final item in (designer['covers'] is List
          ? designer['covers'] as List
          : const []))
        if (RedPacketCoverData.fromJson(item) != null)
          RedPacketCoverData.fromJson(item)!,
    ];
    final claims = covers.fold<int>(0, (sum, cover) => sum + cover.claimCount);
    final name = designer['displayName']?.toString() ?? '';
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
      children: [
        CoverSurface(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
          child: Column(
            children: [
              Row(
                children: [
                  UserAvatar(
                    {
                      'nickname': name,
                      if ((user['avatarId'] ?? '').toString().isNotEmpty)
                        'avatarId': user['avatarId'],
                    },
                    size: 52,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 18,
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
                            height: 1.4,
                            color: qchatMuted(c),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _stat(c, '${covers.length}', tr(c, 'designerCovers')),
                  ),
                  Expanded(
                    child: _stat(c, '$claims', tr(c, 'designerClaims')),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  final id = designer['userId']?.toString() ?? '';
                  if (id.isNotEmpty) {
                    c.push('/red-packets/designers/$id');
                  }
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    UserAvatar(user, size: 18),
                    const SizedBox(width: 6),
                    Text(
                      '${tr(c, 'designerLinkedTo')} · ${user['nickname'] ?? ''}',
                      style: TextStyle(fontSize: 12, color: qchatMuted(c)),
                    ),
                    const SizedBox(width: 2),
                    QChatIcon('chevron', size: 13, color: QChatColors.muted),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: CoralButton(
                tr(c, 'designerNewCover'),
                height: 44,
                onTap: () async {
                  final saved = await c.push<bool>('/red-packets/designer/cover');
                  if (saved == true) setState(_reload);
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CoralButton(
                tr(c, 'designerOpenMarket'),
                height: 44,
                secondary: true,
                onTap: () => c.push('/red-packets/covers/market'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Text(
              tr(c, 'designerCovers'),
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: ink(c),
              ),
            ),
            const Spacer(),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _startEditing(designer),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    QChatIcon('pencil', size: 14, color: coverCoral),
                    const SizedBox(width: 4),
                    Text(
                      tr(c, 'edit'),
                      style: const TextStyle(fontSize: 13, color: coverCoral),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (covers.isEmpty)
          CoverSurface(
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
                  style: TextStyle(fontSize: 13, color: qchatMuted(c)),
                ),
              ],
            ),
          )
        else
          for (final cover in covers) _coverRow(c, cover),
      ],
    );
  }

  Widget _stat(BuildContext c, String value, String label) => Column(
    children: [
      Text(
        value,
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: ink(c),
        ),
      ),
      const SizedBox(height: 2),
      Text(label, style: TextStyle(fontSize: 12, color: qchatMuted(c))),
    ],
  );

  Widget _coverRow(BuildContext c, RedPacketCoverData cover) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: CoverSurface(
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => c.push('/red-packets/covers/preview', extra: cover),
            child: SizedBox(
              width: 62,
              height: 62 * 4 / 3,
              child: CoverThumb(design: cover.design, showOpen: false),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cover.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                    color: ink(c),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: cover.published
                            ? const Color(0x1fd93b30)
                            : qchatFill(c),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        tr(
                          c,
                          cover.published ? 'coverStatusLive' : 'coverStatusDraft',
                        ),
                        style: TextStyle(
                          fontSize: 10.5,
                          color: cover.published ? coverCoral : qchatMuted(c),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${cover.claimCount} ${tr(c, 'designerClaims')}',
                      style: TextStyle(fontSize: 11.5, color: qchatMuted(c)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _miniAction(
                      c,
                      cover.published ? 'coverUnpublish' : 'coverPublishShort',
                      () => _togglePublish(cover),
                    ),
                    const SizedBox(width: 14),
                    _miniAction(
                      c,
                      'edit',
                      () async {
                        final saved = await c.push<bool>(
                          '/red-packets/designer/cover',
                          extra: cover,
                        );
                        if (saved == true) setState(_reload);
                      },
                    ),
                    const SizedBox(width: 14),
                    _miniAction(c, 'coverRemove', () => _delete(cover)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _miniAction(BuildContext c, String label, VoidCallback onTap) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: busy ? null : onTap,
        child: Text(
          tr(c, label),
          style: TextStyle(
            fontSize: 12,
            color: label == 'coverRemove' ? QChatColors.danger : coverCoral,
          ),
        ),
      );
}

/// Public page of a designer, opened from a cover card. It shows only the
/// public identity and the published covers.
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

  @override
  void initState() {
    super.initState();
    _reload();
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
          return QChatEmptyState(
            tr(c, 'coverNotFound'),
            icon: 'palette',
          );
        }
        final user = designer['user'] is Map
            ? Map<String, dynamic>.from(designer['user'] as Map)
            : const <String, dynamic>{};
        final covers = [
          for (final item in (designer['covers'] is List
              ? designer['covers'] as List
              : const []))
            if (RedPacketCoverData.fromJson(item) != null)
              RedPacketCoverData.fromJson(item)!,
        ];
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
          children: [
            Row(
              children: [
                UserAvatar(
                  {
                    'nickname': designer['displayName'],
                    if ((user['avatarId'] ?? '').toString().isNotEmpty)
                      'avatarId': user['avatarId'],
                  },
                  size: 58,
                ),
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
            const SizedBox(height: 18),
            if (covers.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 30),
                child: QChatEmptyState(
                  tr(c, 'designerNoCovers'),
                  icon: 'palette',
                ),
              )
            else
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: .56,
                children: [
                  for (final cover in covers)
                    CoverSurface(
                      padding: const EdgeInsets.all(9),
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => c.push(
                          '/red-packets/covers/preview',
                          extra: cover,
                        ),
                        child: Column(
                          children: [
                            Expanded(
                              child: Center(
                                child: CoverThumb(design: cover.design),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              cover.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 13, color: ink(c)),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
          ],
        );
      },
    ),
  );
}
