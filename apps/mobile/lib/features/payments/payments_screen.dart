import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';

const paymentGreen = Color(0xff2fac4d);
const paymentBlue = Color(0xff168fe5);
const paymentOrange = Color(0xfff0a12c);
const paymentRed = Color(0xffef5350);

String moneyText(int value, {bool withUnit = true}) {
  final digits = value.abs().toString();
  final buffer = StringBuffer(value < 0 ? '-' : '');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  if (withUnit) buffer.write(' đ');
  return buffer.toString();
}

class PaymentsScreen extends StatelessWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, 'payments'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
      children: [
        _HeroPanel(
          onReceive: () => c.push('/payments/money'),
          onWallet: () => c.push('/payments/wallet'),
        ),
        const SizedBox(height: 12),
        _ServiceSection(
          title: 'Dịch vụ tài chính',
          items: const [
            ('Trả thẻ', 'creditCard', paymentBlue, 'cardRepay'),
            ('Tài sản', 'piggyBank', paymentBlue, 'wealth'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
        const SizedBox(height: 12),
        _ServiceSection(
          title: 'Dịch vụ hàng ngày',
          items: const [
            ('Nạp điện thoại', 'smartphone', paymentBlue, 'mobileTopUp'),
            ('Hóa đơn', 'receipt', paymentGreen, 'utilities'),
            ('QChat Xu', 'coins', paymentBlue, 'coins'),
            ('Dịch vụ công', 'landmark', paymentGreen, 'publicServices'),
            ('Quyên góp', 'heartHandshake', paymentRed, 'charity'),
            ('Sức khỏe', 'stethoscope', paymentOrange, 'health'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
        const SizedBox(height: 12),
        _ServiceSection(
          title: 'Du lịch & Di chuyển',
          items: const [
            ('Du lịch', 'plane', paymentBlue, 'travel'),
            ('Tàu & Phà', 'trainFront', paymentGreen, 'rail'),
            ('Đặt xe', 'carFront', paymentOrange, 'ride'),
            ('Khách sạn', 'hotel', paymentGreen, 'hotels'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
      ],
    ),
  );
}

class _HeroPanel extends StatelessWidget {
  const _HeroPanel({required this.onReceive, required this.onWallet});
  final VoidCallback onReceive, onWallet;
  @override
  Widget build(BuildContext c) => Container(
    height: 152,
    clipBehavior: Clip.antiAlias,
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
    child: Stack(
      children: [
        const Positioned(right: -34, top: -46, child: _Glow(132)),
        const Positioned(left: -30, bottom: -58, child: _Glow(118)),
        Row(
          children: [
            Expanded(
              child: _HeroAction(
                icon: 'scanQrCode',
                label: 'Nhận tiền',
                caption: 'Mã QR của tôi',
                onTap: onReceive,
              ),
            ),
            Container(
              width: .5,
              height: 74,
              color: Colors.white.withValues(alpha: .22),
            ),
            Expanded(
              child: _HeroAction(
                icon: 'wallet',
                label: 'Ví tiền',
                caption: 'Số dư & giao dịch',
                onTap: onWallet,
              ),
            ),
          ],
        ),
      ],
    ),
  );
}

class _Glow extends StatelessWidget {
  const _Glow(this.size);
  final double size;
  @override
  Widget build(BuildContext c) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .07),
      shape: BoxShape.circle,
    ),
  );
}

class _HeroAction extends StatelessWidget {
  const _HeroAction({
    required this.icon,
    required this.label,
    required this.caption,
    required this.onTap,
  });
  final String icon, label, caption;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTap: onTap,
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .16),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: .16)),
          ),
          child: Center(child: QChatIcon(icon, color: Colors.white, size: 26)),
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w600,
            decoration: TextDecoration.none,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          caption,
          style: TextStyle(
            color: Colors.white.withValues(alpha: .78),
            fontSize: 12,
            decoration: TextDecoration.none,
          ),
        ),
      ],
    ),
  );
}

class _ServiceSection extends StatelessWidget {
  const _ServiceSection({
    required this.title,
    required this.items,
    required this.onTap,
  });
  final String title;
  final List<(String, String, Color, String)> items;
  final ValueChanged<String> onTap;
  @override
  Widget build(BuildContext c) => Container(
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(16),
    ),
    padding: const EdgeInsets.fromLTRB(14, 16, 14, 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 3,
              height: 15,
              decoration: BoxDecoration(
                color: paymentGreen,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: ink(c),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (c, constraints) {
            const spacing = 2.0;
            final itemWidth = (constraints.maxWidth - spacing * 3) / 4;
            return Wrap(
              alignment: WrapAlignment.center,
              spacing: spacing,
              runSpacing: 4,
              children: [
                for (final item in items)
                  SizedBox(
                    width: itemWidth,
                    height: 92,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onTap(item.$4),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: item.$3.withValues(alpha: .11),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Center(
                              child: QChatIcon(
                                item.$2,
                                color: item.$3,
                                size: 24,
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Flexible(
                            child: Text(
                              item.$1,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.25,
                                color: ink(c),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    ),
  );
}
