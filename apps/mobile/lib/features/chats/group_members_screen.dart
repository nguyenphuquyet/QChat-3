import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart' show CupertinoTextField;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/widgets.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/detail_page.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';

class GroupMembersScreen extends ConsumerStatefulWidget {
  const GroupMembersScreen({
    super.key,
    required this.conversationId,
    this.initialConversation,
    this.onUpdated,
  });

  final String conversationId;
  final Map<String, dynamic>? initialConversation;
  final VoidCallback? onUpdated;

  @override
  ConsumerState<GroupMembersScreen> createState() => _GroupMembersScreenState();
}

class _GroupMembersScreenState extends ConsumerState<GroupMembersScreen> {
  Map<String, dynamic>? conversation;
  bool loading = true;
  bool managing = false;
  String? error;
  final searchController = TextEditingController();
  String query = '';
  int tab = 0;
  StreamSubscription<void>? updates;

  @override
  void initState() {
    super.initState();
    conversation = widget.initialConversation;
    load();
    updates = ref.read(clientProvider).changes.stream.listen((_) {
      if (mounted) load();
    });
  }

  @override
  void dispose() {
    updates?.cancel();
    searchController.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final client = ref.read(clientProvider);
      final data = await client.get(
        '/conversations/${widget.conversationId}',
        cached: false,
      );
      if (mounted) {
        setState(() {
          conversation = Map<String, dynamic>.from(data);
          loading = false;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          if (conversation == null) {
            error = tr(context, 'networkError');
          }
        });
      }
    }
  }

  Future<void> addMember() async {
    final client = ref.read(clientProvider);
    try {
      final friends = await client.get('/friends', cached: false) as List;
      final members = (conversation?['members'] as List? ?? []);
      final ids = members.map((m) => m['userId']).toSet();
      final available = friends
          .where((f) => !ids.contains(f['friendId']))
          .toList();
      if (!mounted) return;
      final chosen = await showQChatDialog<String>(
        context,
        title: tr(context, 'add'),
        content: Builder(
          builder: (c) => ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320),
            child: available.isEmpty
                ? SizedBox(
                    height: 120,
                    child: Center(child: Text(tr(c, 'emptyContacts'))),
                  )
                : ListView(
                    shrinkWrap: true,
                    children: [
                      for (final f in available)
                        QChatCell(
                          title: Text(f['friend']['nickname']),
                          image: UserAvatar(f['friend'], size: 42),
                          onTap: () =>
                              Navigator.pop(c, f['friendId'] as String),
                        ),
                    ],
                  ),
          ),
        ),
        actions: [QChatDialogAction(label: tr(context, 'cancel'))],
      );
      if (chosen == null) return;
      await client.post('/conversations/${widget.conversationId}/members', {
        'userId': chosen,
      });
      await load();
      widget.onUpdated?.call();
    } catch (_) {
      if (mounted) {
        setState(() => error = tr(context, 'networkError'));
      }
    }
  }

  Future<void> removeMember(Map<String, dynamic> member) async {
    final nickname = member['user']?['nickname'] ?? '';
    final confirmed = await confirmAction(
      context,
      tr(context, 'removeMember'),
      '${tr(context, 'removeMemberNote')} ($nickname)',
    );
    if (!confirmed) return;
    try {
      final client = ref.read(clientProvider);
      await client.dio.delete(
        '/conversations/${widget.conversationId}/members/${member['userId']}',
      );
      await load();
      widget.onUpdated?.call();
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  Future<void> manageMember(Map<String, dynamic> member) async {
    if (managing) return;
    final members = conversation?['members'] as List? ?? [];
    final own = members
        .where((m) => m['userId'] == ref.read(clientProvider).userId)
        .firstOrNull;
    final owner = own?['role'] == 'OWNER';
    final canRemove =
        owner || (own?['role'] == 'ADMIN' && member['role'] == 'MEMBER');
    if (!canRemove || member['role'] == 'OWNER') return;
    final choice = await showQChatSheet<String>(
      context,
      (c) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (owner)
            QChatOverlayAction(
              label: tr(
                c,
                member['role'] == 'ADMIN' ? 'removeAdmin' : 'appointAdmin',
              ),
              onTap: () => Navigator.pop(
                c,
                member['role'] == 'ADMIN' ? 'MEMBER' : 'ADMIN',
              ),
            ),
          QChatOverlayAction(
            label: tr(c, 'removeMember'),
            onTap: () => Navigator.pop(c, 'remove'),
          ),
        ],
      ),
    );
    if (choice == null || !mounted) return;
    if (choice == 'remove') {
      await removeMember(member);
      return;
    }
    if (choice == 'ADMIN' &&
        members.where((m) => m['role'] == 'ADMIN').length >= 3) {
      setState(() => error = tr(context, 'adminLimit'));
      return;
    }
    setState(() {
      managing = true;
      error = null;
    });
    try {
      final client = ref.read(clientProvider);
      await client.dio.patch(
        '/conversations/${widget.conversationId}/members/${member['userId']}',
        data: {'role': choice},
      );
      await load();
      client.changes.add(null);
      widget.onUpdated?.call();
    } on DioException catch (e) {
      if (mounted) {
        setState(
          () => error = tr(
            context,
            e.response?.statusCode == 409 ? 'adminLimit' : 'operationFailed',
          ),
        );
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      if (mounted) setState(() => managing = false);
    }
  }

  @override
  Widget build(BuildContext c) {
    final client = ref.read(clientProvider);
    final members = (conversation?['members'] as List? ?? [])
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
    final own = members.where((m) => m['userId'] == client.userId).firstOrNull;
    final canManage = ['OWNER', 'ADMIN'].contains(own?['role']);

    final filtered = members.where((m) {
      if (query.trim().isEmpty) return true;
      final nick = (m['user']?['nickname'] ?? '').toString().toLowerCase();
      return nick.contains(query.trim().toLowerCase());
    }).toList();

    final admins = filtered
        .where((m) => ['OWNER', 'ADMIN'].contains(m['role']))
        .toList();

    return DetailPage(
      title: tr(c, 'groupMembers'),
      glassHeader: false,
      child: Column(
        children: [
          Container(
            color: surface(c),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Container(
              height: 34,
              decoration: BoxDecoration(
                color: qchatDark(c)
                    ? const Color(0xff2c2c2c)
                    : const Color(0xfff0f0f0),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CupertinoTextField(
                    controller: searchController,
                    onChanged: (v) => setState(() => query = v),
                    padding: const EdgeInsets.fromLTRB(32, 4, 30, 4),
                    placeholder: tr(c, 'searchMembers'),
                    placeholderStyle: const TextStyle(
                      fontSize: 14,
                      color: QChatColors.muted,
                    ),
                    cursorColor: QChatColors.green,
                    style: TextStyle(fontSize: 14, color: ink(c)),
                    decoration: const BoxDecoration(
                      color: QChatColors.transparent,
                    ),
                  ),
                  const Positioned(
                    left: 10,
                    child: IgnorePointer(
                      child: QChatIcon(
                        'search',
                        size: 16,
                        color: QChatColors.muted,
                      ),
                    ),
                  ),
                  if (query.isNotEmpty)
                    Positioned(
                      right: 8,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () {
                          searchController.clear();
                          setState(() => query = '');
                        },
                        child: const Padding(
                          padding: EdgeInsets.all(3),
                          child: QChatIcon(
                            'close',
                            size: 14,
                            color: QChatColors.muted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Container(
            color: surface(c),
            child: QChatTabBar(
              index: tab,
              onChanged: (value) => setState(() => tab = value),
              labels: [
                '${tr(c, 'allMembers')} (${members.length})',
                '${tr(c, 'admins')} (${members.where((m) => ['OWNER', 'ADMIN'].contains(m['role'])).length})',
              ],
            ),
          ),
          Container(height: .5, color: qchatLine(c)),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              '${tr(c, 'adminSlots')}: ${members.where((m) => m['role'] == 'ADMIN').length}/3',
              style: const TextStyle(fontSize: 12, color: QChatColors.muted),
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                error!,
                style: const TextStyle(
                  color: QChatColors.danger,
                  fontSize: 13,
                ),
              ),
            ),
          Expanded(
            child: loading && conversation == null
                ? const QChatLoading()
                : tab == 0
                ? _buildMemberList(
                    c,
                    filtered,
                    canManage: canManage,
                    currentUserId: client.userId,
                    showAddButton: canManage && query.isEmpty,
                  )
                : _buildMemberList(
                    c,
                    admins,
                    canManage: canManage,
                    currentUserId: client.userId,
                    showAddButton: false,
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberList(
    BuildContext c,
    List<Map<String, dynamic>> list, {
    required bool canManage,
    required String? currentUserId,
    required bool showAddButton,
  }) {
    if (list.isEmpty && !showAddButton) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Text(
            tr(c, 'emptyContacts'),
            style: const TextStyle(color: QChatColors.muted),
          ),
        ),
      );
    }

    return ListView(
      children: [
        if (showAddButton)
          Container(
            color: surface(c),
            child: QChatCell(
              image: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: QChatColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Icon(
                    TIcons.add,
                    color: QChatColors.primary,
                    size: 22,
                  ),
                ),
              ),
              title: Text(
                tr(c, 'add'),
                style: const TextStyle(
                  color: QChatColors.primary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              onTap: addMember,
            ),
          ),
        for (final m in list)
          Container(
            color: surface(c),
            child: QChatCell(
              image: UserAvatar(m['user'], size: 42),
              title: Text(
                m['user']?['nickname'] ?? '',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              note: _buildRoleBadge(c, m['role']),
              trailing:
                  canManage &&
                      ((conversation?['members'] as List? ?? []).any(
                            (own) =>
                                own['userId'] == currentUserId &&
                                own['role'] == 'OWNER',
                          ) ||
                          m['role'] == 'MEMBER') &&
                      m['role'] != 'OWNER' &&
                      m['userId'] != currentUserId
                  ? QChatIconButton(
                      'more',
                      label: tr(c, 'manageMember'),
                      color: QChatColors.muted,
                      size: 20,
                      onTap: managing ? null : () => manageMember(m),
                    )
                  : null,
              onTap: () => c.push('/user/${m['userId']}'),
            ),
          ),
      ],
    );
  }

  Widget? _buildRoleBadge(BuildContext c, String? role) {
    if (role == 'OWNER') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xfffff7e6),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: const Color(0xffffd591), width: 0.8),
        ),
        child: Text(
          tr(c, 'groupOwner'),
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xffd46b08),
            fontWeight: FontWeight.w500,
          ),
        ),
      );
    }
    if (role == 'ADMIN') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xffe6f7ff),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: const Color(0xff91d5ff), width: 0.8),
        ),
        child: Text(
          tr(c, 'groupAdmin'),
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xff096dd9),
            fontWeight: FontWeight.w500,
          ),
        ),
      );
    }
    return null;
  }
}
