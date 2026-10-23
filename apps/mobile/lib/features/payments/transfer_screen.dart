import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/localization/strings.dart';
import 'payments_screen.dart';

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({
    super.key,
    this.to = '',
    this.conversationId,
    this.redPacket = false,
  });
  final String to;
  final String? conversationId;
  final bool redPacket;
  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  late final to = TextEditingController(text: widget.to);
  late final amount = TextEditingController();
  late final note = TextEditingController(
    text: widget.redPacket ? 'Hồng bao' : '',
  );
  late Future<Map> wallet = loadWallet();
  bool sending = false;
  String? error;

  Future<Map> loadWallet() async =>
      await ref.read(clientProvider).get('/wallet', cached: false) as Map;

  Future<void> submit() async {
    final value = int.tryParse(amount.text.replaceAll(RegExp(r'[^0-9]'), ''));
    final target = to.text.trim();
    if (target.isEmpty || value == null || value < 1000) {
      setState(() => error = 'Nhập QChat ID và số tiền từ 1.000 đ.');
      return;
    }
    setState(() {
      sending = true;
      error = null;
    });
    try {
      final client = ref.read(clientProvider);
      final result = await client.post('/wallet/transfer', {
        'to': target,
        'amount': value,
        'kind': widget.redPacket ? 'RED_PACKET' : 'TRANSFER',
        'note': note.text.trim(),
        if (widget.conversationId != null)
          'conversationId': widget.conversationId,
      });
      if (!mounted) return;
      final balance = (result['balance'] as num?)?.toInt() ?? 0;
      await showQChatDialog<void>(
        context,
        title: widget.redPacket ? 'Đã gửi hồng bao' : 'Đã chuyển tiền',
        message:
            '${moneyText(value)} tới $target.\nSố dư còn lại: ${moneyText(balance)}',
        actions: [
          QChatDialogAction(label: tr(context, 'confirm'), primary: true),
        ],
      );
      if (mounted) context.pop();
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          sending = false;
          error = switch (e.response?.statusCode) {
            404 => 'Không tìm thấy người nhận.',
            400 => 'Số dư không đủ hoặc người nhận không hợp lệ.',
            _ => tr(context, 'networkError'),
          };
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          sending = false;
          error = tr(context, 'networkError');
        });
      }
    }
  }

  @override
  void dispose() {
    to.dispose();
    amount.dispose();
    note.dispose();
    super.dispose();
  }

  InputDecoration decoration(BuildContext c, String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(fontSize: 16, color: Color(0xffb2b2b2)),
    filled: true,
    fillColor: surface(c),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(6),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
  );

  @override
  Widget build(BuildContext c) => QChatPage(
    title: widget.redPacket ? 'Hồng bao' : 'Chuyển tiền',
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: FutureBuilder<Map>(
      future: wallet,
      builder: (c, s) {
        final balance = (s.data?['balance'] as num?)?.toInt() ?? 0;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
          children: [
            if (widget.redPacket)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xfff5a623),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    QChatIcon('gift', color: Colors.white, size: 34),
                    SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        'Hồng bao sẽ được gửi ngay vào cuộc trò chuyện.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (widget.redPacket) const SizedBox(height: 16),
            TextField(
              controller: to,
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.next,
              style: TextStyle(fontSize: 16, color: ink(c)),
              decoration: decoration(c, 'QChat ID người nhận'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: amount,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: TextStyle(fontSize: 16, color: ink(c)),
              decoration: decoration(c, 'Số tiền (đ)'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: note,
              maxLength: 100,
              style: TextStyle(fontSize: 16, color: ink(c)),
              decoration: decoration(
                c,
                widget.redPacket ? 'Lời chúc' : 'Lời nhắn',
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: GestureDetector(
                onTap: () => setState(() => wallet = loadWallet()),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    s.hasData
                        ? 'Số dư: ${moneyText(balance)}'
                        : 'Đang tải số dư…',
                    style: const TextStyle(
                      fontSize: 14,
                      color: QChatColors.muted,
                    ),
                  ),
                ),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                error!,
                style: const TextStyle(
                  fontSize: 14,
                  color: QChatColors.danger,
                ),
              ),
            ],
            const SizedBox(height: 18),
            QChatButton(
              widget.redPacket ? 'Gửi hồng bao' : 'Chuyển tiền',
              loading: sending,
              onTap: sending ? null : submit,
            ),
            const SizedBox(height: 12),
            const Text(
              'Tiền được chuyển ngay vào ví QChat của người nhận và không hoàn lại.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: QChatColors.muted,
              ),
            ),
          ],
        );
      },
    ),
  );
}
