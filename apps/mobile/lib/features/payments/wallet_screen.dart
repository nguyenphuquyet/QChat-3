import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';
import 'payments_screen.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});
  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  bool history = false;
  bool hidden = false;
  late Future<Map> data = load();

  Future<Map> load() async => await ref
      .read(clientProvider)
      .get('/wallet', cached: false) as Map;

  String dateText(dynamic raw) {
    final value = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (value == null) return '';
    final minute = value.minute.toString().padLeft(2, '0');
    return '${value.day}/${value.month} ${value.hour}:$minute';
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: 'Ví tiền',
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'refreshCw',
      label: 'Làm mới',
      onTap: () => setState(() => data = load()),
    ),
    child: FutureBuilder<Map>(
      future: data,
      builder: (c, s) {
        if (s.hasError) {
          return Center(
            child: QChatButton(
              tr(c, 'retry'),
              onTap: () => setState(() => data = load()),
            ),
          );
        }
        if (!s.hasData) return const QChatLoading();
        final wallet = s.data!;
        final balance = (wallet['balance'] as num?)?.toInt() ?? 0;
        final transactions = (wallet['transactions'] as List? ?? [])
            .cast<Map>();
        return Column(
          children: [
            _TabBar(
              history: history,
              onChanged: (value) => setState(() => history = value),
            ),
            Expanded(
              child: history
                  ? _history(c, transactions)
                  : _wallet(c, balance),
            ),
          ],
        );
      },
    ),
  );

  Widget _wallet(BuildContext c, int balance) => ListView(
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 28),
    children: [
      _BalanceCard(
        balance: balance,
        hidden: hidden,
        onToggle: () => setState(() => hidden = !hidden),
      ),
      const SizedBox(height: 12),
      _quickActions(c),
      const SizedBox(height: 12),
      Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            _WalletRow(
              icon: 'creditCard',
              color: paymentBlue,
              title: 'Thẻ ngân hàng',
              subtitle: 'Chưa liên kết thẻ',
              onTap: () => openFeature(c, 'bankCards'),
            ),
            _WalletRow(
              icon: 'gear',
              color: paymentBlue,
              title: 'Cài đặt thanh toán',
              subtitle: 'Bảo mật và phương thức mặc định',
              onTap: () => openFeature(c, 'paymentSettings'),
            ),
            _WalletRow(
              icon: 'userRound',
              color: paymentBlue,
              title: 'Thông tin ID',
              subtitle: 'Hồ sơ và mã định danh QChat',
              onTap: () => c.push('/profile'),
            ),
            _WalletRow(
              icon: 'headset',
              color: QChatColors.green,
              title: 'Trung tâm dịch vụ khách hàng',
              subtitle: 'Hỗ trợ giao dịch và tài khoản',
              last: true,
              onTap: () => openFeature(c, 'customerService'),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _quickActions(BuildContext c) => Container(
    padding: const EdgeInsets.symmetric(vertical: 16),
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      children: [
        _QuickAction(
          icon: 'arrowLeftRight',
          color: paymentBlue,
          label: 'Chuyển tiền',
          onTap: () => c.push(
            '/payments/transfer?to=${Uri.encodeQueryComponent('')}',
          ),
        ),
        _QuickAction(
          icon: 'qrCode',
          color: paymentGreen,
          label: 'Nhận tiền',
          onTap: () => c.push('/payments/money'),
        ),
        _QuickAction(
          icon: 'gift',
          color: paymentOrange,
          label: 'Hồng bao',
          onTap: () => openFeature(c, 'redPacket'),
        ),
      ],
    ),
  );

  Widget _history(BuildContext c, List<Map> items) {
    if (items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 28),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: surface(c),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const QChatEmptyState(
              'Chưa có giao dịch',
              icon: 'receipt',
            ),
          ),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 28),
      children: [
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: surface(c),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++)
                _transaction(c, items[i], last: i == items.length - 1),
            ],
          ),
        ),
      ],
    );
  }

  Widget _transaction(BuildContext c, Map item, {required bool last}) {
    final amount = (item['amount'] as num?)?.toInt() ?? 0;
    final incoming = amount >= 0;
    final note = (item['note'] ?? '').toString();
    final peer = (item['peerName'] ?? '').toString();
    final title = note.isNotEmpty
        ? note
        : peer.isNotEmpty
        ? (incoming ? '$peer chuyển tiền' : 'Chuyển cho $peer')
        : (incoming ? 'Nhận tiền' : 'Chuyển tiền');
    final color = incoming ? QChatColors.green : QChatColors.danger;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                  color: ink(c).withValues(alpha: .06),
                  width: .5,
                ),
              ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .11),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: QChatIcon(
                incoming ? 'banknoteDown' : 'arrowLeftRight',
                size: 19,
                color: color,
              ),
            ),
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
                const SizedBox(height: 3),
                Text(
                  '${dateText(item['createdAt'])}${peer.isNotEmpty && note.isNotEmpty ? ' · $peer' : ''}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: QChatColors.muted,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${incoming ? '+' : ''}${moneyText(amount)}',
            style: TextStyle(fontSize: 15, color: color),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.history, required this.onChanged});
  final bool history;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
    child: Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ink(c).withValues(alpha: .06),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          for (final tab in [false, true])
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(tab),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: history == tab ? surface(c) : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                    boxShadow: history == tab
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: .06),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    tab ? 'Giao dịch' : 'Ví',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: history == tab
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: history == tab ? ink(c) : QChatColors.muted,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.balance,
    required this.hidden,
    required this.onToggle,
  });
  final int balance;
  final bool hidden;
  final VoidCallback onToggle;
  @override
  Widget build(BuildContext c) => Container(
    padding: const EdgeInsets.fromLTRB(18, 15, 14, 15),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xff3ac065), Color(0xff1b9a47)],
      ),
      borderRadius: BorderRadius.circular(18),
      boxShadow: [
        BoxShadow(
          color: paymentGreen.withValues(alpha: .22),
          blurRadius: 18,
          offset: const Offset(0, 8),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Số dư khả dụng',
              style: TextStyle(
                fontSize: 13,
                color: Colors.white.withValues(alpha: .85),
                decoration: TextDecoration.none,
              ),
            ),
            const Spacer(),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: QChatIcon(
                  hidden ? 'eyeOff' : 'eye',
                  size: 19,
                  color: Colors.white.withValues(alpha: .85),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              hidden ? '••••••' : moneyText(balance, withUnit: false),
              style: const TextStyle(
                fontSize: 32,
                height: 1.15,
                fontWeight: FontWeight.w600,
                letterSpacing: -.5,
                color: Colors.white,
                decoration: TextDecoration.none,
              ),
            ),
            if (!hidden)
              Text(
                ' đ',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                  color: Colors.white.withValues(alpha: .85),
                  decoration: TextDecoration.none,
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            QChatIcon(
              'shieldCheck',
              size: 13,
              color: Colors.white.withValues(alpha: .7),
            ),
            const SizedBox(width: 5),
            Text(
              'Ví QChat · Số dư nội bộ',
              style: TextStyle(
                fontSize: 12,
                color: Colors.white.withValues(alpha: .7),
                decoration: TextDecoration.none,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });
  final String icon, label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => Expanded(
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .11),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(child: QChatIcon(icon, color: color, size: 22)),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(fontSize: 13, color: ink(c)),
          ),
        ],
      ),
    ),
  );
}

class _WalletRow extends StatelessWidget {
  const _WalletRow({
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
    this.last = false,
    required this.onTap,
  });
  final String icon, title;
  final Color color;
  final String? subtitle;
  final bool last;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(
                bottom: BorderSide(
                  color: ink(c).withValues(alpha: .06),
                  width: .5,
                ),
              ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .11),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(child: QChatIcon(icon, color: color, size: 19)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontSize: 15.5, color: ink(c))),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle!,
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
          const QChatIcon(
            'chevronRight',
            size: 18,
            color: QChatColors.muted,
          ),
        ],
      ),
    ),
  );
}
