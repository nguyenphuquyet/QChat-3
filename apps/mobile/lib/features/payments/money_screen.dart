import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';
import 'payments_screen.dart';

class MoneyScreen extends ConsumerStatefulWidget {
  const MoneyScreen({super.key});
  @override
  ConsumerState<MoneyScreen> createState() => _MoneyScreenState();
}

class _MoneyScreenState extends ConsumerState<MoneyScreen> {
  late Future<(Map, Map)> data = load();

  Future<(Map, Map)> load() async {
    final client = ref.read(clientProvider);
    final values = await Future.wait<dynamic>([
      client.get('/users/me'),
      client.get('/wallet', cached: false),
    ]);
    return (values[0] as Map, values[1] as Map);
  }

  void receive(BuildContext c, Map user, Map wallet) {
    showQChatSheet<void>(
      c,
      (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Nhận tiền',
              style: TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w600,
                color: ink(sheet),
              ),
            ),
            const SizedBox(height: 18),
            QrImageView(
              data: 'qchat://pay/${user['qchatId']}',
              size: 230,
              backgroundColor: Colors.white,
              errorCorrectionLevel: QrErrorCorrectLevel.H,
            ),
            const SizedBox(height: 14),
            Text(
              '${user['nickname']} · ${user['qchatId']}',
              style: const TextStyle(fontSize: 16, color: QChatColors.muted),
            ),
            const SizedBox(height: 6),
            const Text(
              'Quét mã để chuyển tiền cho tôi',
              style: TextStyle(fontSize: 15, color: QChatColors.muted),
            ),
          ],
        ),
      ),
    );
  }

  void methodSheet(BuildContext c, int balance) => showQChatSheet<void>(
    c,
    (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const QChatIcon('wallet', color: paymentGreen, size: 26),
              const SizedBox(width: 12),
              Text(
                'Ví QChat',
                style: TextStyle(fontSize: 18, color: ink(sheet)),
              ),
              const Spacer(),
              Text(
                moneyText(balance),
                style: const TextStyle(fontSize: 17, color: QChatColors.muted),
              ),
              const SizedBox(width: 8),
              const QChatIcon(
                'chevronRight',
                size: 18,
                color: QChatColors.muted,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Số dư dùng để chuyển tiền và nhận hồng bao trong QChat.',
            style: TextStyle(fontSize: 14, color: QChatColors.muted),
          ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext c) => QChatPage(
    title: 'Nhận tiền',
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
        ('Làm mới', () => setState(() => data = load())),
        (
          'Chuyển tiền',
          () => c.push(
            '/payments/transfer?to=${Uri.encodeQueryComponent('')}',
          ),
        ),
      ]),
    ),
    child: FutureBuilder<(Map, Map)>(
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
        if (!s.hasData) {
          return const Center(child: QChatLoading());
        }
        final user = s.data!.$1, wallet = s.data!.$2;
        final balance = (wallet['balance'] as num?)?.toInt() ?? 0;
        return ListView(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
          children: [
            _QrCard(user: user),
            const SizedBox(height: 12),
            _MethodCard(
              balance: balance,
              onTap: () => methodSheet(c, balance),
            ),
            const SizedBox(height: 12),
            const _NoticeCard(),
            const SizedBox(height: 12),
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: surface(c),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  _MoneyAction(
                    icon: 'banknoteDown',
                    color: paymentGreen,
                    label: 'Nhận tiền',
                    onTap: () => receive(c, user, wallet),
                  ),
                  _MoneyAction(
                    icon: 'gift',
                    color: paymentOrange,
                    label: 'Hồng bao gần đây',
                    onTap: () => openFeature(c, 'redPacket'),
                  ),
                  _MoneyAction(
                    icon: 'landmark',
                    color: paymentBlue,
                    label: 'Chuyển đến thẻ/ngân hàng',
                    onTap: () => openFeature(c, 'bankTransfer'),
                  ),
                  _MoneyAction(
                    icon: 'ticketPercent',
                    color: const Color(0xff7c70ec),
                    label: 'Mã thưởng',
                    onTap: () => openFeature(c, 'rewardCode'),
                  ),
                  _MoneyAction(
                    icon: 'receipt',
                    color: paymentBlue,
                    label: 'Chia hóa đơn',
                    last: true,
                    onTap: () => openFeature(c, 'splitBill'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _BottomLink(
                  'Quản lý trang tiền',
                  () => openFeature(c, 'moneyPage'),
                ),
                const SizedBox(width: 22),
                _BottomLink(
                  'Thêm vào màn hình chính',
                  () => openFeature(c, 'addToHome'),
                ),
              ],
            ),
          ],
        );
      },
    ),
  );
}

class _QrCard extends StatelessWidget {
  const _QrCard({required this.user});
  final Map user;
  @override
  Widget build(BuildContext c) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 15),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xff3ac065), Color(0xff1b9a47)],
            ),
          ),
          child: Row(
            children: [
              UserAvatar(user, size: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${user['nickname'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        decoration: TextDecoration.none,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'QChat ID: ${user['qchatId'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Colors.white.withValues(alpha: .8),
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .16),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const QChatIcon(
                      'shieldCheck',
                      color: Colors.white,
                      size: 13,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Ví QChat',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: .95),
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: QChatColors.green.withValues(alpha: .16),
                  ),
                ),
                child: QrImageView(
                  data: 'qchat://pay/${user['qchatId']}',
                  size: 190,
                  backgroundColor: Colors.white,
                  errorCorrectionLevel: QrErrorCorrectLevel.H,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Quét mã để chuyển tiền cho tôi',
                style: TextStyle(fontSize: 13.5, color: QChatColors.muted),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({required this.balance, required this.onTap});
  final int balance;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        color: surface(c),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: paymentGreen.withValues(alpha: .11),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: QChatIcon('wallet', color: paymentGreen, size: 19),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Phương thức nhận tiền',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: ink(c),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Ví QChat · ${moneyText(balance)}',
                  style: const TextStyle(
                    fontSize: 13,
                    color: QChatColors.muted,
                  ),
                ),
              ],
            ),
          ),
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

class _NoticeCard extends StatelessWidget {
  const _NoticeCard();
  @override
  Widget build(BuildContext c) {
    final dark = Theme.of(c).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: dark ? const Color(0xff2e2716) : const Color(0xfffff6e5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: QChatIcon('info', color: Color(0xffe8a33d), size: 17),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              'Ví QChat dùng số dư nội bộ. Chưa kết nối ngân hàng hoặc ví điện tử bên ngoài.',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: ink(c).withValues(alpha: .78),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MoneyAction extends StatelessWidget {
  const _MoneyAction({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
    this.last = false,
  });
  final String icon, label;
  final Color color;
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
            child: Text(label, style: TextStyle(fontSize: 15.5, color: ink(c))),
          ),
          const QChatIcon('chevronRight', size: 18, color: QChatColors.muted),
        ],
      ),
    ),
  );
}

class _BottomLink extends StatelessWidget {
  const _BottomLink(this.label, this.onTap);
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 12.5, color: ink(c).withValues(alpha: .55)),
        ),
        const QChatIcon('chevronRight', color: QChatColors.muted, size: 14),
      ],
    ),
  );
}
