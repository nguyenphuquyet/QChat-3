import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';

/// The group chats this account is already in. Creating one lives behind the
/// "+" in the header, so the page stays a list of joined groups.
class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});
  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  late Future<dynamic> groups;

  @override
  void initState() {
    super.initState();
    groups = loadGroups();
  }

  Future<dynamic> loadGroups() async {
    // The server only lists conversations this account is a member of, so the
    // groups in it are the joined ones; direct chats are not groups.
    final all = await ref
        .read(clientProvider)
        .get('/conversations', cached: false);
    return (all as List)
        .whereType<Map>()
        .where((c) => c['kind'] == 'GROUP')
        .toList();
  }

  void reload() => setState(() => groups = loadGroups());

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'groups'),
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => context.pop(),
    ),
    trailing: QChatIconButton(
      'plus',
      label: tr(c, 'newGroup'),
      onTap: () async {
        await c.push('/groups/new');
        // A group created from here belongs to the list behind it.
        if (mounted) reload();
      },
    ),
    child: FutureBuilder<dynamic>(
      future: groups,
      builder: (c, s) {
        if (s.hasError) return QChatError(error: s.error!, retry: reload);
        if (!s.hasData) return const QChatLoading();
        final items = s.data as List;
        if (items.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                tr(c, 'noGroups'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: QChatColors.muted, fontSize: 17),
              ),
            ),
          );
        }
        return ListView(
          // The page's own insets: below the glass header, above the home bar.
          padding: MediaQuery.paddingOf(c),
          children: [
            for (final item in items)
              QChatListTile(
                key: ValueKey('joined-group-${item['id']}'),
                title: (item['title'] ?? '').toString().isEmpty
                    ? 'QChat'
                    : item['title'].toString(),
                leading: GroupAvatar(item, size: 48),
                onTap: () async {
                  await c.push('/chat/${item['id']}');
                  if (mounted) reload();
                },
              ),
          ],
        );
      },
    ),
  );
}
