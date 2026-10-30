import 'conversation_time.dart';
import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/qchat_glass.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/localization/strings.dart';
import 'money_message.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int index = 0;
  final search = TextEditingController();
  late Future<dynamic> data;
  Future<dynamic>? requests;
  StreamSubscription<void>? updates;
  StreamSubscription<String>? recalls;
  final sectionKeys = <String, GlobalKey>{};
  final navKey = GlobalKey();
  final searchKey = GlobalKey();
  double navHeight = 0;
  double searchHeight = 0;
  @override
  void initState() {
    super.initState();
    load();
    updates = ref.read(clientProvider).changes.stream.listen((_) {
      if (mounted) setState(load);
    });
    recalls = ref.read(clientProvider).recalls.stream.listen((_) {
      if (mounted) setState(load);
    });
  }

  void load() {
    final client = ref.read(clientProvider);
    data = client.get(
      index == 0
          ? '/conversations'
          : index == 1
          ? '/friends'
          : '/users/me',
    );
    // Contacts also surface how many people are waiting for a reply.
    if (index == 1) requests = client.get('/friends/requests');
  }

  @override
  void dispose() {
    updates?.cancel();
    recalls?.cancel();
    search.dispose();
    super.dispose();
  }

  String conversationName(Map c) {
    if (c['kind'] == 'GROUP') return c['title'] ?? 'QChat';
    final others = (c['members'] as List).where(
      (m) => m['userId'] != ref.read(clientProvider).userId,
    );
    return others.isEmpty ? 'QChat' : others.first['user']['nickname'];
  }

  void switchTab(int value) => setState(() {
    index = value;
    search.clear();
    load();
  });
  Future<void> invite() async {
    final u = await ref.read(clientProvider).get('/users/me');
    await Clipboard.setData(ClipboardData(text: 'QChat ID: ${u['qchatId']}'));
    if (mounted) qchatSheet(context, [(tr(context, 'copied'), () {})]);
  }

  void menu(BuildContext c) => qchatTopMenu(c, [
    ('chats', 'newChat', () => c.push('/groups/new')),
    ('addFriend', 'addFriend', () => c.push('/friends')),
    ('scan', 'scan', () => c.push('/scan')),
    ('payments', 'payments', () => c.push('/payments')),
  ]);
  @override
  Widget build(BuildContext c) {
    final offline = ref.read(clientProvider).offline;
    return ValueListenableBuilder<bool>(
      valueListenable: offline,
      builder: (c, isOffline, _) => QChatPage(
        statusBackground: index == 3 ? surface(c) : null,
        edgeToEdge: true,
        title: index == 3
            ? null
            : index == 0
            ? (isOffline ? tr(c, 'disconnected') : 'QChat')
            : tr(c, index == 1 ? 'contacts' : 'discover'),
        trailing: index < 2
            ? QChatIconButton(
                index == 0 ? 'plus' : 'addFriend',
                label: tr(c, 'addFriend'),
                onTap: () => index == 0 ? menu(c) : c.push('/friends'),
              )
            : null,
        child: Builder(
          builder: (ctx) {
            final media = MediaQuery.of(ctx);
            measureNav();
            return Stack(
              children: [
                Positioned.fill(
                  child: MediaQuery(
                    data: media.copyWith(
                      padding: media.padding.copyWith(bottom: navHeight),
                      viewPadding: media.viewPadding.copyWith(
                        bottom: navHeight,
                      ),
                    ),
                    child: index == 2
                        ? discover(ctx)
                        : FutureBuilder<dynamic>(
                            key: ValueKey(index),
                            future: data,
                            builder: (c, s) {
                              if (s.hasError &&
                                  !ref.read(clientProvider).offline.value) {
                                return QChatError(
                                  error: s.error!,
                                  retry: () => setState(load),
                                );
                              }
                              if (index == 3) {
                                return me(
                                  c,
                                  s.data as Map? ??
                                      {'nickname': '', 'qchatId': ''},
                                );
                              }
                              var items = (s.data as List? ?? [])
                                  .where(
                                    (item) =>
                                        (index == 0
                                                ? conversationName(item)
                                                : item['friend']['nickname'])
                                            .toString()
                                            .toLowerCase()
                                            .contains(
                                              search.text.toLowerCase(),
                                            ),
                                  )
                                  .toList();
                              if (index == 0) {
                                bool pinned(dynamic chat) =>
                                    (chat['members'] as List).any(
                                      (m) =>
                                          m['userId'] ==
                                              ref.read(clientProvider).userId &&
                                          m['pinned'] == true,
                                    );
                                final ordered = [
                                  ...items.where(pinned),
                                  ...items.where((item) => !pinned(item)),
                                ];
                                items = ordered;
                              }
                              final inset = MediaQuery.paddingOf(c).top;
                              measureSearch();
                              return Stack(
                                children: [
                                  Positioned.fill(
                                    child: MediaQuery(
                                      data: MediaQuery.of(c).copyWith(
                                        padding: MediaQuery.of(c).padding
                                            .copyWith(
                                              top: inset + searchHeight,
                                            ),
                                      ),
                                      child: ColoredBox(
                                        color: surface(c),
                                        child: index == 0
                                            ? chats(c, items)
                                            : contacts(c, items, requests),
                                      ),
                                    ),
                                  ),
                                  // Search bar floats over the list, so rows
                                  // scroll underneath its glass.
                                  Positioned(
                                    top: inset,
                                    left: 0,
                                    right: 0,
                                    child: QChatGlass(
                                      key: searchKey,
                                      border: false,
                                      color: qchatBackground(c),
                                      opacity: .88,
                                      child: QChatSearchBar(
                                        controller: search,
                                        onChanged: (_) => setState(() {}),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                  ),
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: QChatGlass(
                    key: navKey,
                    topBorder: true,
                    color: navigationSurface(ctx),
                    opacity: .88,
                    child: SafeArea(
                      top: false,
                      child: QChatBottomNavigation(
                        index: index,
                        onChanged: switchTab,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  void measureNav() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final size = navKey.currentContext?.size;
      if (size == null || (size.height - navHeight).abs() < .5) return;
      setState(() => navHeight = size.height);
    });
  }

  void measureSearch() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final size = searchKey.currentContext?.size;
      if (size == null || (size.height - searchHeight).abs() < .5) return;
      setState(() => searchHeight = size.height);
    });
  }

  Widget chats(BuildContext c, List items) => ListView(
    children: [
      for (final item in items) conversation(c, item),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 26),
        child: GestureDetector(
          onTap: invite,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                tr(c, 'invite'),
                style: const TextStyle(fontSize: 17, color: QChatColors.green),
              ),
              const SizedBox(width: 12),
              const QChatIcon('chevron', color: QChatColors.green, size: 20),
            ],
          ),
        ),
      ),
    ],
  );
  Widget conversation(BuildContext c, Map item) {
    final rows = item['messages'] as List;
    final members = (item['members'] as List).cast<dynamic>();
    final member = members.firstWhere(
      (m) => m['userId'] == ref.read(clientProvider).userId,
      orElse: () => null,
    );
    final last = rows.isEmpty ? null : rows.first;
    final date = DateTime.tryParse(last?['createdAt'] ?? '')?.toLocal();
    final now = DateTime.now();
    final time = conversationTime(date, now, (key) => tr(c, key));
    return QChatSwipeCell(
      key: ValueKey(item['id']),
      actions: [
        QChatSwipeAction(
          backgroundColor: const Color(0xff168fe5),
          label: tr(
            c,
            member?['markedUnread'] == true ? 'markRead' : 'markUnread',
          ),
          onPressed: () => conversationAction(
            item,
            member?['markedUnread'] == true ? 'read' : 'unread',
          ),
        ),
        QChatSwipeAction(
          backgroundColor: const Color(0xffff9c38),
          label: tr(c, 'hideChat'),
          onPressed: () => conversationAction(item, 'hide'),
        ),
        QChatSwipeAction(
          backgroundColor: const Color(0xfffa5151),
          label: tr(c, 'delete'),
          onPressed: () => conversationAction(item, 'delete'),
        ),
      ],
      child: QChatConversationTile(
        name: conversationName(item),
        avatar: item['kind'] == 'DIRECT'
            ? UserAvatar(
                members.firstWhere(
                  (m) => m['userId'] != ref.read(clientProvider).userId,
                  orElse: () => member,
                )?['user'],
              )
            : GroupAvatar(item, size: 48),
        preview: last == null
            ? ''
            : last['recalledAt'] != null
            ? tr(c, 'recalled')
            : (last['kind'] == 'IMAGE' || last['media']?['mime']?.toString().startsWith('image/') == true)
            ? 'Ảnh'
            : (last['kind'] == 'VIDEO' || last['media']?['mime']?.toString().startsWith('video/') == true)
            ? 'Video'
            : last['kind'] == 'AUDIO'
            ? tr(c, 'voiceMessage')
            : last['kind'] == 'TRANSFER' || last['kind'] == 'RED_PACKET'
            ? moneySummary(last)
            : last['text']?.toString().isNotEmpty == true
            ? last['text']
            : '[${last['kind']}]',
        time: time,
        unread: member?['markedUnread'] == true
            ? 1
            : ((item['sequence'] as int) -
                      ((member?['readSequence'] as int?) ?? 0))
                  .clamp(0, 999),
        onTap: () async {
          await c.push('/chat/${item['id']}');
          // The chat acknowledges reads while it is open; reload so the red
          // badge is gone as soon as the list is visible again.
          if (mounted) setState(load);
        },
      ),
    );
  }

  Future<void> conversationAction(Map item, String action) async {
    if (action == 'delete' &&
        !await confirmAction(
          context,
          tr(context, 'delete'),
          tr(context, 'deleteChatNote'),
        )) {
      return;
    }
    try {
      final client = ref.read(clientProvider);
      final id = item['id'];
      if (action == 'delete') {
        await client.clearHistory(id, hide: true);
      } else if (action == 'read') {
        await client.post('/conversations/$id/read', {
          'sequence': item['sequence'],
        });
        await client.applyConversationRead(
          id,
          item['sequence'] as int? ?? 0,
          clearMarkedUnread: true,
        );
      } else {
        await client.dio.patch(
          '/conversations/$id/state',
          data: action == 'hide' ? {'hidden': true} : {'markedUnread': true},
        );
      }
      await client.local?.removeCache('/conversations');
      if (mounted) {
        setState(() => data = client.get('/conversations', cached: false));
      }
    } catch (_) {
      if (mounted) {
        await showQChatDialog<void>(
          context,
          message: tr(context, 'networkError'),
          actions: [
            QChatDialogAction(label: tr(context, 'confirm'), primary: true),
          ],
        );
      }
    }
  }

  Widget contacts(BuildContext c, List items, Future<dynamic>? requests) {
    items.sort(
      (a, b) => a['friend']['nickname'].toString().compareTo(
        b['friend']['nickname'].toString(),
      ),
    );
    final letters = items
        .map(
          (e) =>
              e['friend']['nickname'].toString().characters.first.toUpperCase(),
        )
        .toSet()
        .toList();
    return Stack(
      children: [
        ListView(
          children: [
            FutureBuilder<dynamic>(
              future: requests,
              builder: (c, s) {
                final pending = s.data is List ? (s.data as List).length : 0;
                return MenuRow(
                  'newFriends',
                  icon: 'addFriend',
                  boxed: true,
                  color: const Color(0xfffa9d3b),
                  badge: pending,
                  onTap: () async {
                    await c.push('/friends/requests');
                    if (mounted) setState(load);
                  },
                );
              },
            ),
            MenuRow(
              'groups',
              icon: 'groups',
              boxed: true,
              color: QChatColors.green,
              onTap: () => c.push('/groups/new'),
            ),
            const MenuRow('tags', icon: 'tag', boxed: true),
            const MenuRow(
              'service',
              icon: 'service',
              boxed: true,
              color: Color(0xff0aaeea),
            ),
            for (final letter in letters) ...[
              Container(
                key: sectionKeys.putIfAbsent(letter, () => GlobalKey()),
                padding: const EdgeInsets.fromLTRB(16, 23, 16, 8),
                child: Text(
                  letter,
                  style: const TextStyle(
                    fontSize: 14,
                    color: QChatColors.muted,
                  ),
                ),
              ),
              for (final item in items.where(
                (e) => e['friend']['nickname']
                    .toString()
                    .toUpperCase()
                    .startsWith(letter),
              ))
                QChatListTile(
                  title: (item['remark'] ?? '').toString().isEmpty
                      ? item['friend']['nickname']
                      : item['remark'],
                  leading: UserAvatar(item['friend'], size: 42),
                  trailing: const SizedBox.shrink(),
                  onTap: () => c.push('/user/${item['friend']['id']}'),
                ),
            ],
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                '${items.length} ${tr(c, 'friendsCount')}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: QChatColors.muted, fontSize: 17),
              ),
            ),
          ],
        ),
        if (letters.isNotEmpty)
          Positioned(
            right: 4,
            top: 255,
            child: Column(
              children: [
                for (final letter in letters)
                  GestureDetector(
                    onTap: () {
                      final target = sectionKeys[letter]?.currentContext;
                      if (target != null) {
                        Scrollable.ensureVisible(
                          target,
                          duration: const Duration(milliseconds: 200),
                        );
                      }
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Text(letter, style: const TextStyle(fontSize: 11)),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget discover(BuildContext c) => ListView(
    children: [
      MenuRow('moments', icon: 'moments', onTap: () => c.push('/moments')),
      sectionGap,
      const MenuRow('channels', icon: 'channels', color: Color(0xfff5a33a)),
      sectionGap,
      MenuRow('scan', icon: 'scan', onTap: () => c.push('/scan')),
      sectionGap,
      const MenuRow('stories', icon: 'stories', color: Color(0xffeeb714)),
      MenuRow(
        'search',
        icon: 'searchStar',
        color: const Color(0xffef6269),
        onTap: () => c.push('/search'),
      ),
      sectionGap,
      const MenuRow('nearby', icon: 'nearby'),
      sectionGap,
      MenuRow(
        'miniApps',
        icon: 'miniApps',
        color: const Color(0xff7c70ec),
        onTap: () => c.push('/miniApps'),
      ),
      sectionGap,
      const MenuRow('out', icon: 'call', color: QChatColors.green),
    ],
  );
  Widget me(BuildContext c, Map u) => ListView(
    padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(c).bottom),
    children: [
      Container(
        color: surface(c),
        padding: EdgeInsets.fromLTRB(
          28,
          60 + MediaQuery.paddingOf(c).top,
          20,
          32,
        ),
        child: GestureDetector(
          onTap: () async {
            await c.push('/profile');
            if (mounted) setState(load);
          },
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              UserAvatar(u, size: 64),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      u['nickname'],
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      'QChat ID: ${u['qchatId']}',
                      style: const TextStyle(
                        fontSize: 16,
                        color: Color(0xff888888),
                      ),
                    ),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () => c.push('/profile'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(color: QChatColors.line),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '+ ${tr(c, 'status')}',
                          style: const TextStyle(
                            fontSize: 14,
                            color: QChatColors.muted,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                children: [
                  QChatIconButton(
                    'qr',
                    label: tr(c, 'qr'),
                    onTap: () => c.push('/qr'),
                    color: const Color(0xff65718e),
                  ),
                  const QChatIcon(
                    'chevron',
                    color: QChatColors.muted,
                    size: 18,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      sectionGap,
      MenuRow(
        'payments',
        icon: 'payments',
        color: QChatColors.green,
        onTap: () => c.push('/payments'),
      ),
      MenuRow(
        'redPacketCovers',
        icon: 'gift',
        color: const Color(0xffe75c4a),
        onTap: () => c.push('/red-packets/covers'),
      ),
      MenuRow(
        'designerHub',
        icon: 'palette',
        color: const Color(0xff7c70ec),
        onTap: () => c.push('/red-packets/designer'),
      ),
      sectionGap,
      MenuRow(
        'favorites',
        icon: 'favorites',
        color: const Color(0xffe8b933),
        onTap: () => c.push('/favorites'),
      ),
      // The Me tab lists only what this account posted, not the shared feed.
      MenuRow(
        'moments',
        icon: 'image',
        onTap: () {
          final id = u['id']?.toString() ?? '';
          c.push(
            id.isEmpty
                ? '/moments'
                : '/moments?authorId=${Uri.encodeQueryComponent(id)}',
          );
        },
      ),
      const MenuRow('stickers', icon: 'emoji', color: Color(0xffeeb714)),
      sectionGap,
      MenuRow('settings', icon: 'settings', onTap: () => c.push('/settings')),
    ],
  );
}
