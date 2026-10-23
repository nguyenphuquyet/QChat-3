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
            Container(
              color: surface(c),
              child: Row(
                children: [
                  for (final tab in [false, true])
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => history = tab),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: history == tab
                                    ? QChatColors.green
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                          ),
                          child: Text(
                            tab ? 'Giao dịch' : 'Ví',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: history == tab
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                              color: history == tab
                                  ? QChatColors.green
                                  : ink(c),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
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
    children: [
      Container(
        color: surface(c),
        child: _WalletRow(
          icon: 'payments',
          color: const Color(0xffe8b323),
          title: 'Số dư',
          subtitle: moneyText(balance),
          onTap: () => c.push('/payments/money'),
        ),
      ),
      Container(
        color: surface(c),
        child: _WalletRow(
          icon: 'file',
          color: paymentBlue,
          title: 'Thẻ ngân hàng',
          subtitle: 'Chưa liên kết thẻ',
          onTap: () => openFeature(c, 'bankCards'),
        ),
      ),
      sectionGap,
      Container(
        color: surface(c),
        child: Column(
          children: [
            _WalletRow(
              icon: 'settings',
              color: paymentBlue,
              title: 'Cài đặt thanh toán',
              onTap: () => openFeature(c, 'paymentSettings'),
            ),
            _WalletRow(
              icon: 'me',
              color: paymentBlue,
              title: 'Thông tin ID',
              onTap: () => c.push('/profile'),
            ),
            _WalletRow(
              icon: 'service',
              color: QChatColors.green,
              title: 'Trung tâm dịch vụ khách hàng',
              onTap: () => openFeature(c, 'customerService'),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _history(BuildContext c, List<Map> items) {
    if (items.isEmpty) {
      return const QChatEmptyState('Chưa có giao dịch');
    }
    return ListView.separated(
      itemCount: items.length,
      separatorBuilder: (_, _) => Divider(
        height: .5,
        thickness: .5,
        color: ink(c).withValues(alpha: .08),
        indent: 16,
      ),
      itemBuilder: (c, i) {
        final item = items[i];
        final amount = (item['amount'] as num?)?.toInt() ?? 0;
        final incoming = amount >= 0;
        final note = (item['note'] ?? '').toString();
        final peer = (item['peerName'] ?? '').toString();
        final title = note.isNotEmpty
            ? note
            : peer.isNotEmpty
            ? (incoming ? '$peer chuyển tiền' : 'Chuyển cho $peer')
            : (incoming ? 'Nhận tiền' : 'Chuyển tiền');
        return Container(
          color: surface(c),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: incoming
                      ? QChatColors.green.withValues(alpha: .12)
                      : QChatColors.danger.withValues(alpha: .1),
                  shape: BoxShape.circle,
                ),
                child: QChatIcon(
                  incoming ? 'download' : 'transfer',
                  size: 21,
                  color: incoming ? QChatColors.green : QChatColors.danger,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 16)),
                    const SizedBox(height: 4),
                    Text(
                      '${dateText(item['createdAt'])}${peer.isNotEmpty && note.isNotEmpty ? ' · $peer' : ''}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: QChatColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${incoming ? '+' : ''}${moneyText(amount)}',
                style: TextStyle(
                  fontSize: 16,
                  color: incoming ? QChatColors.green : QChatColors.danger,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _WalletRow extends StatelessWidget {
  const _WalletRow({
    required this.icon,
    required this.color,
    required this.title,
    this.subtitle,
    required this.onTap,
  });
  final String icon, title;
  final Color color;
  final String? subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: ink(c).withValues(alpha: .06),
            width: .5,
          ),
        ),
      ),
      child: Row(
        children: [
          QChatIcon(icon, color: color, size: 23),
          const SizedBox(width: 16),
          Expanded(
            child: Text(title, style: const TextStyle(fontSize: 17)),
          ),
          if (subtitle != null)
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 15,
                color: QChatColors.muted,
              ),
            ),
          const SizedBox(width: 6),
          const QChatIcon(
            'chevron',
            size: 18,
            color: Color(0xffb8b8b8),
          ),
        ],
      ),
    ),
  );
}
