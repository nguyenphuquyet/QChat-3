import 'dart:async';
import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/design_system/dialogs.dart';
import 'moment_composer.dart';

class MomentsScreen extends ConsumerStatefulWidget {
  const MomentsScreen({super.key, this.authorId});
  final String? authorId;
  @override
  ConsumerState<MomentsScreen> createState() => _MomentsScreenState();
}

class _MomentsScreenState extends ConsumerState<MomentsScreen> {
  late Future<dynamic> feed;
  StreamSubscription<void>? updates;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
    updates = ref.read(clientProvider).changes.stream.listen((_) {
      if (mounted) setState(load);
    });
  }

  void load() {
    feed = ref
        .read(clientProvider)
        .get(
          widget.authorId == null
              ? '/moments'
              : '/moments?authorId=${Uri.encodeQueryComponent(widget.authorId!)}',
          cached: false,
        );
  }

  @override
  void dispose() {
    updates?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'moments'),
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => context.pop(),
    ),
    trailing:
        widget.authorId != null &&
            widget.authorId != ref.read(clientProvider).userId
        ? null
        : QChatIconButton(
            'plus',
            label: tr(c, 'post'),
            onTap: () async {
              final posted = await Navigator.of(c).push<bool>(
                CupertinoPageRoute(builder: (_) => const MomentComposer()),
              );
              if (posted == true && mounted) setState(load);
            },
          ),
    child: Column(
      children: [
        if (error != null)
          Text(error!, style: const TextStyle(color: QChatColors.danger)),
        Expanded(
          child: FutureBuilder<dynamic>(
            future: feed,
            builder: (c, s) {
              if (s.hasError && !ref.read(clientProvider).offline.value) {
                return QChatError(error: s.error!, retry: () => setState(load));
              }
              final posts = s.data as List? ?? [];
              if (!s.hasData && !s.hasError) return const QChatLoading();
              return ListView(
                children: [
                  if (posts.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 40),
                      child: QChatEmptyState(tr(c, 'emptyMoments')),
                    ),
                  for (final p in posts)
                    _MomentCard(
                      post: p,
                      myId: ref.read(clientProvider).userId,
                      onReload: () => setState(load),
                      onError: (msg) => setState(() => error = msg),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}

// ─── Card từng bài viết ──────────────────────────────────────────────────────

class _MomentCard extends ConsumerStatefulWidget {
  const _MomentCard({
    required this.post,
    required this.myId,
    required this.onReload,
    required this.onError,
  });
  final Map post;
  final String? myId;
  final VoidCallback onReload;
  final void Function(String) onError;

  @override
  ConsumerState<_MomentCard> createState() => _MomentCardState();
}

class _MomentCardState extends ConsumerState<_MomentCard> {
  Future<void> _toggleLike() async {
    final liked = (widget.post['likes'] as List).any(
      (l) => l['userId'] == widget.myId,
    );
    try {
      if (liked) {
        await ref
            .read(clientProvider)
            .dio
            .delete('/moments/${widget.post['id']}/likes');
      } else {
        await ref
            .read(clientProvider)
            .post('/moments/${widget.post['id']}/likes', {});
      }
      widget.onReload();
    } catch (_) {
      if (mounted) widget.onError(tr(context, 'networkError'));
    }
  }

  Future<void> _delete() async {
    if (!await confirmAction(
          context,
          tr(context, 'delete'),
          tr(context, 'deleteMoment'),
        ) ||
        !mounted) {
      return;
    }
    try {
      await ref
          .read(clientProvider)
          .dio
          .delete('/moments/${widget.post['id']}');
      widget.onReload();
    } catch (_) {
      if (mounted) widget.onError(tr(context, 'networkError'));
    }
  }

  @override
  Widget build(BuildContext c) {
    final p = widget.post;
    final liked = (p['likes'] as List).any((l) => l['userId'] == widget.myId);
    return Container(
      color: surface(c),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(p['author'], size: 40, openProfile: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Tên tác giả
                Text(
                  p['author']['nickname'],
                  style: const TextStyle(
                    color: Color(0xff546d91),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                // Nội dung
                Text(p['text']),
                const SizedBox(height: 10),
                // Media
                if ((p['media'] as List).isNotEmpty)
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final media in p['media'])
                        GestureDetector(
                          onTap: () => context.push(
                            '/media/${media['mediaId']}',
                            extra: "moment-${p['id']}-${media['mediaId']}",
                          ),
                          child: Hero(
                            tag: "moment-${p['id']}-${media['mediaId']}",
                            child: SizedBox(
                              width: 120,
                              height: 120,
                              child:
                                  (media['media']?['mime'] as String? ?? '')
                                      .startsWith('video/')
                                  ? ColoredBox(
                                      color: const Color(0xff252525),
                                      child: Center(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const QChatIcon(
                                              'videoCall',
                                              color: QChatColors.white,
                                              size: 36,
                                            ),
                                            Text(
                                              tr(c, 'play'),
                                              style: const TextStyle(
                                                color: QChatColors.white,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    )
                                  : MediaImage(id: media['mediaId']),
                            ),
                          ),
                        ),
                    ],
                  ),
                const SizedBox(height: 10),
                // Hàng ngày + thao tác
                Row(
                  children: [
                    Text(
                      p['createdAt'].toString().substring(0, 10),
                      style: const TextStyle(
                        fontSize: 11,
                        color: QChatColors.muted,
                      ),
                    ),
                    const Spacer(),
                    // Nút like
                    GestureDetector(
                      onTap: _toggleLike,
                      child: Row(
                        children: [
                          QChatIcon(
                            'heart',
                            size: 18,
                            filled: liked,
                            color: liked
                                ? QChatColors.danger
                                : QChatColors.muted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${(p['likes'] as List).length}',
                            style: TextStyle(
                              fontSize: 13,
                              color: liked
                                  ? QChatColors.danger
                                  : QChatColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    // Nút xóa (chỉ chủ bài)
                    if (p['authorId'] == widget.myId) ...[
                      const SizedBox(width: 16),
                      GestureDetector(
                        onTap: _delete,
                        child: const QChatIcon(
                          'close',
                          size: 18,
                          color: QChatColors.muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
