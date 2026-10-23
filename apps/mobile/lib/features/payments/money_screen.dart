import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
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
              const QChatIcon('payments', color: paymentGreen, size: 26),
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
                'chevron',
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
    title: 'Tiền',
    titleColor: Colors.white,
    background: paymentGreen,
    statusBackground: paymentGreen,
    navigationBackground: paymentGreen,
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      color: Colors.white,
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'more',
      label: 'Thêm',
      color: Colors.white,
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
          return const Center(
            child: CircularProgressIndicator(color: Colors.white),
          );
        }
        final user = s.data!.$1, wallet = s.data!.$2;
        final balance = (wallet['balance'] as num?)?.toInt() ?? 0;
        return ListView(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 28),
          children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 14),
              child: Column(
                children: [
                  Center(
                    child: QrImageView(
                      data: 'qchat://pay/${user['qchatId']}',
                      size: 214,
                      backgroundColor: Colors.white,
                      errorCorrectionLevel: QrErrorCorrectLevel.H,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(height: .5, color: const Color(0xffededed)),
                  const SizedBox(height: 12),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => methodSheet(c, balance),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Phương thức thanh toán mặc định',
                            style: TextStyle(
                              fontSize: 15,
                              color: Color(0xff888888),
                            ),
                          ),
                        ),
                        Text(
                          'Ví QChat',
                          style: TextStyle(fontSize: 15, color: ink(c)),
                        ),
                        const SizedBox(width: 4),
                        const QChatIcon(
                          'chevron',
                          size: 17,
                          color: QChatColors.muted,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xfffff6e5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: Color(0xfff5a623),
                            shape: BoxShape.circle,
                          ),
                          child: const Text(
                            '!',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              height: 1,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Ví QChat dùng số dư nội bộ. Chưa kết nối ngân hàng hoặc ví điện tử bên ngoài.',
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.35,
                              color: QChatColors.ink,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Column(
              children: [
                _MoneyAction(
                  icon: 'download',
                  label: 'Nhận tiền',
                  onTap: () => receive(c, user, wallet),
                ),
                _MoneyAction(
                  icon: 'gift',
                  label: 'Hồng bao gần đây',
                  onTap: () => openFeature(c, 'redPacket'),
                ),
                _MoneyAction(
                  icon: 'payments',
                  label: 'Chuyển đến thẻ/ngân hàng',
                  onTap: () => openFeature(c, 'bankTransfer'),
                ),
                _MoneyAction(
                  icon: 'heart',
                  label: 'Mã thưởng',
                  onTap: () => openFeature(c, 'rewardCode'),
                ),
                _MoneyAction(
                  icon: 'file',
                  label: 'Chia hóa đơn',
                  onTap: () => openFeature(c, 'splitBill'),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _BottomLink(
                  'Quản lý trang tiền',
                  () => openFeature(c, 'moneyPage'),
                ),
                const SizedBox(width: 26),
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

class _MoneyAction extends StatelessWidget {
  const _MoneyAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final String icon, label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0x33ffffff), width: .5),
        ),
      ),
      child: Row(
        children: [
          QChatIcon(icon, color: Colors.white, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 17,
                color: Colors.white,
                decoration: TextDecoration.none,
              ),
            ),
          ),
          const QChatIcon('chevron', color: Colors.white70, size: 18),
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
          style: const TextStyle(
            fontSize: 15,
            color: Colors.white,
            decoration: TextDecoration.none,
          ),
        ),
        const QChatIcon('chevron', color: Colors.white70, size: 16),
      ],
    ),
  );
}
