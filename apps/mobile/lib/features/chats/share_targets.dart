import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';

/// The name a share strip shows for [chat]: the group title, or the other
/// member of a direct conversation. It falls back to "QChat" while the row is
/// still missing its members.
String conversationShareName(Map chat, String selfId) {
  if (chat['kind'] == 'GROUP') return chat['title']?.toString() ?? 'QChat';
  final members = (chat['members'] as List?) ?? const [];
  for (final member in members) {
    final user = member['user'];
    if (member['userId'] != selfId && user is Map) {
      return user['nickname']?.toString() ?? 'QChat';
    }
  }
  final first = members.isEmpty ? null : members.first['user'];
  return (first is Map ? first['nickname']?.toString() : null) ?? 'QChat';
}

/// Avatar and name for [QChatShareSheet] (recent strip) and the full forward
/// picker, so both screens describe a conversation the same way.
QChatShareTarget conversationShareTarget(
  Map chat,
  String selfId, {
  double size = 66,
}) {
  final id = chat['id'] as String;
  final name = conversationShareName(chat, selfId);
  if (chat['kind'] == 'GROUP') {
    return QChatShareTarget(
      id: id,
      name: name,
      avatar: GroupAvatar(chat, size: size),
    );
  }
  final members = (chat['members'] as List?) ?? const [];
  Map? user;
  for (final member in members) {
    if (member['userId'] != selfId && member['user'] is Map) {
      user = member['user'] as Map;
      break;
    }
  }
  final first = members.isEmpty ? null : members.first['user'];
  user ??= first is Map ? first : null;
  return QChatShareTarget(
    id: id,
    name: name,
    avatar: UserAvatar(user ?? const {'nickname': ''}, size: size),
  );
}
