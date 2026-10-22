/// Calendar-day comparisons keep midnight and daylight-saving boundaries stable.
String conversationTime(
  DateTime? date,
  DateTime now,
  String Function(String) tr,
) {
  if (date == null) return '';
  final local = date.toLocal();
  final today = now.toLocal();
  final days = DateTime.utc(
    today.year,
    today.month,
    today.day,
  ).difference(DateTime.utc(local.year, local.month, local.day)).inDays;
  final clock =
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  if (days == 0) return clock;
  if (days == 1) return '${tr('yesterday')} $clock';
  if (days >= 2 && days <= 6) return tr('weekday${local.weekday}');
  final calendar =
      '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}';
  return local.year == today.year ? calendar : '$calendar/${local.year}';
}
