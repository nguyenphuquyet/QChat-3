import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/detail_page.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';

class UserProfileScreen extends ConsumerStatefulWidget {
  const UserProfileScreen({super.key, this.id, this.qchatId, this.from});
  final String? id, qchatId, from;
  @override
  ConsumerState<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends ConsumerState<UserProfileScreen> {
  Map? user;
  List momentMedia = [];
  bool friend = false, sent = false, busy = false;
  bool expanded = true;
  String? error;
  StreamSubscription<void>? updates;
  int revision = 0;
  @override
  void initState() {
    super.initState();
    load();
    updates = ref.read(clientProvider).changes.stream.listen((_) => load());
  }

  @override
  void dispose() {
    updates?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    final current = ++revision;
    try {
      final client = ref.read(clientProvider);
      Map? found;
      if (widget.id != null) {
        found = await client.get('/users/${widget.id}', cached: false);
      } else {
        final matches =
            await client.get(
                  '/users/search?q=${Uri.encodeQueryComponent(widget.qchatId ?? '')}',
                  cached: false,
                )
                as List;
        found = matches.isEmpty ? null : matches.first as Map;
      }
      final friends = await client.get('/friends', cached: false) as List;
      final isFriend =
          found != null && friends.any((f) => f['friendId'] == found!['id']);
      List previews = [];
      if (isFriend) {
        try {
          final posts =
              await client.get(
                    '/moments?authorId=${Uri.encodeQueryComponent(found['id'].toString())}',
                    cached: false,
                  )
                  as List;
          previews = posts
              .expand((p) => p['media'] as List? ?? [])
              .take(4)
              .toList();
        } catch (_) {
          // A failed preview must not prevent opening the friend's profile.
        }
      }
      if (mounted && current == revision) {
        setState(() {
          user = found;
          momentMedia = previews;
          friend =
              found != null &&
              friends.any((f) => f['friendId'] == found!['id']);
          error = found == null ? tr(context, 'userNotFound') : null;
        });
      }
    } catch (_) {
      if (mounted && current == revision) {
        setState(() => error = tr(context, 'networkError'));
      }
    }
  }

  Future<void> act(String action) async {
    if (busy || user == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final client = ref.read(clientProvider);
      if (action == 'add' || action == 'addFriend') {
        await client.post('/friends/requests', {'recipientId': user!['id']});
        if (mounted) setState(() => sent = true);
      } else {
        final conversation = await client.post('/conversations', {
          'memberIds': [user!['id']],
        });
        if (!mounted) return;
        await context.push(
          action == 'messageUser'
              ? '/chat/${conversation['id']}'
              : '/call/${conversation['id']}?video=${action == 'videoCall'}',
        );
        if (mounted) await load();
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Color body(BuildContext c) => Theme.of(c).brightness == Brightness.dark
      ? const Color(0xffb4b4b4)
      : const Color(0xff4c4c4c);

  Color line(BuildContext c) => Theme.of(c).brightness == Brightness.dark
      ? const Color(0xff2e2e2e)
      : const Color(0xffe8e8e8);

  Widget header(Map u) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 18, 16, 22),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        UserAvatar(u, size: 76),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      u['nickname'] ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 24,
                        height: 1.25,
                        fontWeight: FontWeight.w600,
                        color: ink(context),
                      ),
                    ),
                  ),
                  if (u['gender'] == 'female' || u['gender'] == 'male') ...[
                    const SizedBox(width: 6),
                    QChatIcon(
                      u['gender'] == 'female' ? 'female' : 'male',
                      size: 19,
                      color: u['gender'] == 'female'
                          ? const Color(0xfff2749a)
                          : const Color(0xff5a9be8),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              if (friend) ...[
                Text(
                  'QChat ID: ${u['qchatId'] ?? ''}',
                  style: const TextStyle(
                    fontSize: 16,
                    color: QChatColors.muted,
                  ),
                ),
                const SizedBox(height: 6),
              ],
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${tr(context, 'region')}:',
                    style: const TextStyle(
                      fontSize: 16,
                      height: 1.35,
                      color: QChatColors.muted,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      (u['region'] ?? '').toString().isEmpty
                          ? tr(context, 'notSet')
                          : u['region'].toString(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.35,
                        color: body(context),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget sectionTitle() => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: () => setState(() => expanded = !expanded),
    child: SizedBox(
      height: 56,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Text(
              tr(context, 'profileSection'),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: ink(context),
              ),
            ),
            const Spacer(),
            AnimatedRotation(
              turns: expanded ? .25 : 0,
              duration: const Duration(milliseconds: 160),
              child: const QChatIcon(
                'chevron',
                size: 18,
                color: QChatColors.muted,
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget infoRow(String label, String value) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 104,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 16,
              height: 1.35,
              color: QChatColors.muted,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(fontSize: 16, height: 1.35, color: body(context)),
          ),
        ),
      ],
    ),
  );

  Widget action(String label, {bool disabled = false}) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: busy || disabled ? null : () => act(label),
    child: SizedBox(
      height: 56,
      child: Center(
        child: Text(
          tr(context, label),
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xff576b95),
          ),
        ),
      ),
    ),
  );

  Widget actionsCard(List<String> labels) => Container(
    color: surface(context),
    child: Column(
      children: [
        for (var i = 0; i < labels.length; i++)
          DecoratedBox(
            decoration: BoxDecoration(
              border: i == labels.length - 1
                  ? null
                  : Border(bottom: BorderSide(color: line(context), width: .5)),
            ),
            child: action(
              labels[i],
              disabled: labels[i] == 'friendRequestSent',
            ),
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext c) {
    final u = user;
    final isSelf = u != null && u['id'] == ref.read(clientProvider).userId;
    final bio = (u?['bio'] ?? '').toString();
    return DetailPage(
      whiteHeader: true,
      glassHeader: false,
      child: ListView(
        children: [
          if (u != null) ...[
            Container(
              color: surface(c),
              child: Column(
                children: [
                  header(u),
                  Container(height: .5, color: line(c)),
                  sectionTitle(),
                  if (expanded) ...[
                    infoRow(
                      tr(c, 'profileStatus'),
                      bio.isEmpty ? tr(c, 'notSet') : bio,
                    ),
                    if (widget.from == 'qr')
                      infoRow(tr(c, 'from'), tr(c, 'fromQr')),
                    if (!friend)
                      infoRow('QChat ID', u['qchatId']?.toString() ?? ''),
                    const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
            if (friend) ...[
              const SizedBox(height: 9),
              Material(
                color: surface(c),
                child: InkWell(
                  onTap: () => context.push(
                    '/moments?authorId=${Uri.encodeQueryComponent(u['id'].toString())}',
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 18,
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 94,
                          child: Text(
                            tr(c, 'moments'),
                            style: const TextStyle(fontSize: 17),
                          ),
                        ),
                        Expanded(
                          child: LayoutBuilder(
                            builder: (c, constraints) {
                              final size = ((constraints.maxWidth - 18) / 4)
                                  .clamp(0.0, 52.0);
                              return Row(
                                children: [
                                  for (final media in momentMedia) ...[
                                    SizedBox.square(
                                      dimension: size,
                                      child:
                                          (media['media']?['mime'] ?? '')
                                              .toString()
                                              .startsWith('video/')
                                          ? const ColoredBox(
                                              color: Color(0xff333333),
                                              child: Icon(
                                                Icons.play_arrow,
                                                color: Colors.white,
                                              ),
                                            )
                                          : MediaImage(
                                              id: media['mediaId'].toString(),
                                            ),
                                    ),
                                    const SizedBox(width: 6),
                                  ],
                                ],
                              );
                            },
                          ),
                        ),
                        const QChatIcon(
                          'chevron',
                          size: 18,
                          color: QChatColors.muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            if (!isSelf) ...[
              const SizedBox(height: 9),
              if (friend)
                actionsCard(['messageUser', 'voiceCall', 'videoCall'])
              else
                actionsCard([sent ? 'friendRequestSent' : 'add']),
            ],
          ],
          if (busy)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: QChatDots()),
            ),
          if (error != null)
            TCell(title: Text(error!), arrow: true, onTap: load),
        ],
      ),
    );
  }
}
