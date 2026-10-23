import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';
import 'payments_screen.dart';

/// Dedicated balance page: shows the wallet balance, quick money actions, and
/// the transaction history in one place instead of reusing the payment code
/// screen for balance details.
class BalanceScreen extends ConsumerStatefulWidget {
  const BalanceScreen({super.key});
  @override
  ConsumerState<BalanceScreen> createState() => _BalanceScreenState();
}

class _BalanceScreenState extends ConsumerState<BalanceScreen> {
  bool hidden = false;
  late Future<Map> data = load();

  Future<Map> load() async => await ref
      .read(clientProvider)
      .get('/wallet', cached: false) as Map;

  Future<void> refresh() async {
    final next = load();
    setState(() => data = next);
    try {
      await next;
    } catch (_) {}
  }

  String mask(String value) => hidden ? '••••••' : value;

  String dayKey(DateTime value) =>
      '${value.year}-${value.month}-${value.day}';

  String dayLabel(DateTime? value) {
    if (value == null) return 'Khác';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(value.year, value.month, value.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'Hôm nay';
    if (diff == 1) return 'Hôm qua';
    final d = value.day.toString().padLeft(2, '0');
    final m = value.month.toString().padLeft(2, '0');
    return '$d/$m/${value.year}';
  }

  String timeText(DateTime? value) {
    if (value == null) return '';
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  DateTime? createdAt(Map item) =>
      DateTime.tryParse(item['createdAt']?.toString() ?? '')?.toLocal();

  @override
  Widget build(BuildContext c) => QChatPage(
    title: 'Số dư',
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'more',
      label: 'Thêm',
      onTap: () => qchatSheet(c, [
        ('Làm mới', refresh),
        (
          'Chuyển tiền',
          () => c.push('/payments/transfer?to=${Uri.encodeQueryComponent('')}'),
        ),
        ('Nhận tiền', () => c.push('/payments/money')),
        ('Quản lý ví', () => c.push('/payments/wallet')),
      ]),
    ),
    child: FutureBuilder<Map>(
      future: data,
      builder: (c, s) {
        if (s.hasError) {
          return Center(
            child: QChatButton(tr(c, 'retry'), onTap: refresh),
          );
        }
        if (!s.hasData) {
          return const Center(child: QChatLoading());
        }
        final wallet = s.data!;
        final balance = (wallet['balance'] as num?)?.toInt() ?? 0;
        final transactions = (wallet['transactions'] as List? ?? [])
            .cast<Map>();
        return RefreshIndicator(
          color: QChatColors.green,
          onRefresh: refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 28),
            children: [
              _hero(c, balance, transactions),
              _actions(c),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Giao dịch gần đây',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: ink(c),
                        ),
                      ),
                    ),
                    if (transactions.isNotEmpty)
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: refresh,
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            QChatIcon(
                              'refresh',
                              size: 15,
                              color: QChatColors.muted,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'Làm mới',
                              style: TextStyle(
                                fontSize: 13,
                                color: QChatColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              _history(c, transactions),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                child: Text(
                  'Ví QChat dùng số dư nội bộ để chuyển tiền và nhận hồng bao. Chưa kết nối ngân hàng hoặc ví điện tử bên ngoài.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.5,
                    color: QChatColors.muted.withValues(
                      alpha: Theme.of(c).brightness == Brightness.dark
                          ? .8
                          : 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    ),
  );

  Widget _hero(BuildContext c, int balance, List<Map> transactions) {
    var received = 0;
    var spent = 0;
    for (final item in transactions) {
      final amount = (item['amount'] as num?)?.toInt() ?? 0;
      if (amount >= 0) {
        received += amount;
      } else {
        spent -= amount;
      }
    }
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 10, 10, 0),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xff34b95a), Color(0xff1f9243)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Stack(
        children: [
          Positioned(right: -36, top: -48, child: _glow(160)),
          Positioned(right: 58, bottom: -78, child: _glow(140)),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 17, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      TIcons.wallet,
                      size: 17,
                      color: Colors.white.withValues(alpha: .85),
                    ),
                    const SizedBox(width: 7),
                    Text(
                      'Số dư khả dụng',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: .85),
                      ),
                    ),
                    const Spacer(),
                    Semantics(
                      button: true,
                      label: hidden ? 'Hiện số dư' : 'Ẩn số dư',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => hidden = !hidden),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: QChatIcon(
                            hidden ? 'eyeOff' : 'eye',
                            size: 20,
                            color: Colors.white.withValues(alpha: .85),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      mask(moneyText(balance, withUnit: false)),
                      style: const TextStyle(
                        fontSize: 38,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -.5,
                        color: Colors.white,
                      ),
                    ),
                    if (!hidden)
                      Text(
                        ' đ',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withValues(alpha: .85),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 7),
                Row(
                  children: [
                    QChatIcon(
                      'lock',
                      size: 13,
                      color: Colors.white.withValues(alpha: .7),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'Ví QChat · Số dư nội bộ',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Colors.white.withValues(alpha: .7),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      _stat(
                        'Tổng nhận',
                        mask('+${moneyText(received)}'),
                      ),
                      _statDivider(),
                      _stat(
                        'Tổng chi',
                        mask('-${moneyText(spent)}'),
                      ),
                      _statDivider(),
                      _stat(
                        'Giao dịch',
                        hidden ? '••••' : '${transactions.length}',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _glow(double size) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .07),
      shape: BoxShape.circle,
    ),
  );

  Widget _stat(String label, String value) => Expanded(
    child: Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.white.withValues(alpha: .75),
          ),
        ),
        const SizedBox(height: 5),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              maxLines: 1,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _statDivider() => Container(
    width: .5,
    height: 26,
    color: Colors.white.withValues(alpha: .22),
  );

  Widget _actions(BuildContext c) => Container(
    margin: const EdgeInsets.fromLTRB(10, 10, 10, 0),
    padding: const EdgeInsets.symmetric(vertical: 16),
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        _action(
          c,
          'transferMoney',
          paymentBlue,
          'Chuyển tiền',
          () => c.push('/payments/transfer?to=${Uri.encodeQueryComponent('')}'),
        ),
        _action(
          c,
          'qr',
          paymentGreen,
          'Nhận tiền',
          () => c.push('/payments/money'),
        ),
        _action(
          c,
          'gift',
          const Color(0xfff0a12c),
          'Hồng bao',
          () => openFeature(c, 'redPacket'),
        ),
      ],
    ),
  );

  Widget _action(
    BuildContext c,
    String icon,
    Color color,
    String label,
    VoidCallback onTap,
  ) => Expanded(
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              shape: BoxShape.circle,
            ),
            child: Center(child: QChatIcon(icon, color: color, size: 23)),
          ),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(fontSize: 14, color: ink(c))),
        ],
      ),
    ),
  );

  Widget _history(BuildContext c, List<Map> items) {
    if (items.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: BorderRadius.circular(14),
        ),
        padding: const EdgeInsets.symmetric(vertical: 34),
        child: const QChatEmptyState(
          'Chưa có giao dịch',
          icon: 'payments',
        ),
      );
    }
    final rows = <Widget>[];
    String? lastKey;
    for (var i = 0; i < items.length; i++) {
      final item = items[i];
      final created = createdAt(item);
      final key = created == null ? '' : dayKey(created);
      if (key != lastKey) {
        lastKey = key;
        rows.add(_dayHeader(c, created));
      }
      rows.add(_transaction(c, item, last: i == items.length - 1));
    }
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: surface(c),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(children: rows),
    );
  }

  Widget _dayHeader(BuildContext c, DateTime? value) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
    color: Theme.of(c).brightness == Brightness.dark
        ? Colors.white.withValues(alpha: .04)
        : const Color(0xfff7f7f7),
    child: Text(
      dayLabel(value),
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w500,
        color: QChatColors.muted,
      ),
    ),
  );

  Widget _transaction(BuildContext c, Map item, {required bool last}) {
    final amount = (item['amount'] as num?)?.toInt() ?? 0;
    final incoming = amount >= 0;
    final note = (item['note'] ?? '').toString();
    final peer = (item['peerName'] ?? '').toString();
    final kind = (item['kind'] ?? '').toString();
    final redPacket = kind == 'RED_PACKET';
    final title = note.isNotEmpty
        ? note
        : peer.isNotEmpty
        ? (incoming ? '$peer chuyển tiền' : 'Chuyển cho $peer')
        : (incoming ? 'Nhận tiền' : 'Chuyển tiền');
    final created = createdAt(item);
    final meta = [
      if (created != null) timeText(created),
      if (peer.isNotEmpty && note.isNotEmpty) peer,
    ].join(' · ');
    final color = redPacket
        ? const Color(0xfff0a12c)
        : incoming
        ? QChatColors.green
        : QChatColors.danger;
    final icon = redPacket
        ? 'gift'
        : incoming
        ? 'download'
        : 'transferMoney';
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 13, 16, 13),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                  color: ink(c).withValues(alpha: .07),
                  width: .5,
                ),
              ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              shape: BoxShape.circle,
            ),
            child: QChatIcon(icon, size: 20, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15.5, color: ink(c)),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    meta,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: QChatColors.muted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            mask('${incoming ? '+' : ''}${moneyText(amount)}'),
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w500,
              color: incoming ? QChatColors.green : ink(c),
            ),
          ),
        ],
      ),
    );
  }
}
