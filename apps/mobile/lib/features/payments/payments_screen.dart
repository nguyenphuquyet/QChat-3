import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/localization/strings.dart';

const paymentGreen = Color(0xff2fac4d);
const paymentBlue = Color(0xff168fe5);

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
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 28),
      children: [
        Container(
          height: 168,
          padding: const EdgeInsets.symmetric(vertical: 20),
          decoration: BoxDecoration(
            color: paymentGreen,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(
                child: _HeroAction(
                  icon: 'scan',
                  label: 'Tiền',
                  onTap: () => c.push('/payments/money'),
                ),
              ),
              Expanded(
                child: _HeroAction(
                  icon: 'payments',
                  label: 'Ví tiền',
                  onTap: () => c.push('/payments/wallet'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _ServiceSection(
          title: 'Dịch vụ tài chính',
          items: const [
            ('Trả thẻ', 'file', paymentBlue, 'cardRepay'),
            ('Tài sản', 'payments', paymentBlue, 'wealth'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
        const SizedBox(height: 10),
        _ServiceSection(
          title: 'Dịch vụ hàng ngày',
          items: const [
            ('Nạp điện thoại', 'mobile', paymentBlue, 'mobileTopUp'),
            ('Hóa đơn', 'settings', paymentGreen, 'utilities'),
            ('QChat Xu', 'chats', paymentBlue, 'coins'),
            ('Dịch vụ công', 'payments', paymentGreen, 'publicServices'),
            ('Quyên góp', 'heart', Color(0xffef5350), 'charity'),
            ('Sức khỏe', 'plus', Color(0xfff0a12c), 'health'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
        const SizedBox(height: 10),
        _ServiceSection(
          title: 'Du lịch & Di chuyển',
          items: const [
            ('Du lịch', 'nearby', paymentBlue, 'travel'),
            ('Tàu & Phà', 'location', paymentGreen, 'rail'),
            ('Đặt xe', 'discover', Color(0xfff0a12c), 'ride'),
            ('Khách sạn', 'chats', paymentGreen, 'hotels'),
          ],
          onTap: (key) => openFeature(c, key),
        ),
      ],
    ),
  );
}

class _HeroAction extends StatelessWidget {
  const _HeroAction({
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
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        QChatIcon(icon, color: Colors.white, size: 34),
        const SizedBox(height: 14),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
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
      borderRadius: BorderRadius.circular(10),
    ),
    padding: const EdgeInsets.fromLTRB(14, 16, 14, 6),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 15, color: Color(0xff888888)),
        ),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 4,
          childAspectRatio: 1.06,
          children: [
            for (final item in items)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(item.$4),
                child: Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: QChatIcon(item.$2, color: item.$3, size: 30),
                      ),
                    ),
                    Text(
                      item.$1,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.25,
                        color: QChatColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    ),
  );
}
