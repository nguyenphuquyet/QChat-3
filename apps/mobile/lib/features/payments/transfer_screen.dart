import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/design_system/dialogs.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/localization/strings.dart';
import '../chats/red_packet_design.dart';
import 'payments_screen.dart';
import 'red_packet_cover_ui.dart';

const _linkBlue = Color(0xff576b95);
const _placeholderGrey = Color(0xffb2b2b2);
const _redPacketButton = Color(0xffff6144);
const _caretGreen = Color(0xff8fd6b4);

class TransferScreen extends ConsumerStatefulWidget {
  const TransferScreen({
    super.key,
    this.to = '',
    this.name = '',
    this.avatarId = '',
    this.conversationId,
    this.redPacket = false,
    this.group = false,
  });
  final String to, name, avatarId;
  final String? conversationId;
  final bool redPacket;

  /// The packet is being sent into a group, so it is divided between every
  /// member and the sender can pick how.
  final bool group;
  @override
  ConsumerState<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends ConsumerState<TransferScreen> {
  late final to = TextEditingController(text: widget.to);
  final note = TextEditingController();
  final recipientFocus = FocusNode();
  final noteFocus = FocusNode();
  String digits = '';
  bool sending = false;
  bool keypadVisible = true;
  String? error;
  RedPacketCoverData? selectedCover;

  /// EQUAL or RANDOM, only meaningful for a red packet in a group.
  String splitMode = 'RANDOM';

  @override
  void initState() {
    super.initState();
    // A text field's system keyboard and the QChat keypad must not fight for
    // the bottom of the screen: focusing a field hides the QChat keypad.
    recipientFocus.addListener(_hideKeypadForTextInput);
    noteFocus.addListener(_hideKeypadForTextInput);
    if (widget.redPacket) _loadActiveCover();
  }

  /// Starts the send sheet on the cover the account marked as "in use", so the
  /// "Sử dụng" action of the cover gallery actually drives the next packet.
  Future<void> _loadActiveCover() async {
    try {
      final result = await ref
          .read(clientProvider)
          .get('/wallet/covers', cached: false);
      if (!mounted || result is! Map || result['items'] is! List) return;
      for (final item in result['items'] as List) {
        final cover = RedPacketCoverData.fromJson(item);
        if (cover != null && cover.selected) {
          setState(() => selectedCover = cover);
          return;
        }
      }
    } catch (_) {
      // A cover is optional: sending must work when the gallery is offline.
    }
  }

  void _hideKeypadForTextInput() {
    if (!mounted) return;
    if ((recipientFocus.hasFocus || noteFocus.hasFocus) && keypadVisible) {
      setState(() => keypadVisible = false);
    }
  }

  void toggleKeypad() {
    if (sending) return;
    FocusScope.of(context).unfocus();
    setState(() => keypadVisible = !keypadVisible);
  }

  int get amount => int.tryParse(digits) ?? 0;

  String get target => widget.to.isNotEmpty ? widget.to : to.text.trim();

  String get recipientName {
    if (widget.name.isNotEmpty) return widget.name;
    return target;
  }

  void pressDigit(String digit) {
    if (sending || digits.length >= 12) return;
    setState(() {
      digits = digits == '0' ? digit : '$digits$digit';
      error = null;
    });
  }

  void backspace() {
    if (sending) return;
    setState(() {
      if (digits.isNotEmpty) {
        digits = digits.substring(0, digits.length - 1);
      }
      error = null;
    });
  }

  Future<void> editNote() async {
    final value = await editText(
      context,
      tr(context, 'transferNote'),
      initial: note.text,
      maxLength: 100,
    );
    if (value != null && mounted) setState(() => note.text = value);
  }

  Future<void> pickCover() async {
    final picked = await context.push<RedPacketCoverData>(
      '/red-packets/covers?pick=1',
    );
    if (picked != null && mounted) setState(() => selectedCover = picked);
  }

  Future<void> submit() async {
    final value = int.tryParse(digits);
    final recipient = target;
    if (recipient.isEmpty || value == null || value < 1000) {
      final message = tr(
        context,
        recipient.isEmpty ? 'enterRecipientAndAmount' : 'enterAmount',
      );
      if (widget.redPacket) {
        showQChatToast(context, message);
      } else {
        setState(() => error = message);
      }
      return;
    }
    setState(() {
      sending = true;
      error = null;
    });
    try {
      final result = await ref.read(clientProvider).post('/wallet/transfer', {
        'to': recipient,
        'amount': value,
        'kind': widget.redPacket ? 'RED_PACKET' : 'TRANSFER',
        'note': note.text.trim(),
        if (widget.conversationId != null)
          'conversationId': widget.conversationId,
        if (widget.redPacket) 'coverId': selectedCover?.id ?? 'default',
        if (widget.redPacket && widget.group) 'splitMode': splitMode,
      });
      if (!mounted) return;
      final balance = (result['balance'] as num?)?.toInt() ?? 0;
      await showQChatDialog<void>(
        context,
        title: tr(context, widget.redPacket ? 'redPacketSent' : 'transferSent'),
        message:
            '${moneyText(value)} → $recipientName.\n'
            '${widget.redPacket && widget.group ? '${tr(context, splitMode == 'EQUAL' ? 'splitEven' : 'splitRandom')}.\n' : ''}'
            '${tr(context, 'balanceLeft')} ${moneyText(balance)}',
        actions: [
          QChatDialogAction(label: tr(context, 'confirm'), primary: true),
        ],
      );
      if (mounted) context.pop();
    } on DioException catch (e) {
      if (!mounted) return;
      fail(switch (e.response?.statusCode) {
        404 => tr(context, 'recipientNotFound'),
        400 => tr(context, 'transferFailed'),
        _ => tr(context, 'networkError'),
      });
    } catch (_) {
      if (!mounted) return;
      fail(tr(context, 'networkError'));
    }
  }

  void fail(String message) {
    if (!mounted) return;
    setState(() {
      sending = false;
      error = message;
    });
    if (widget.redPacket) showQChatToast(context, message);
  }

  @override
  void dispose() {
    to.dispose();
    note.dispose();
    recipientFocus.dispose();
    noteFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) =>
      widget.redPacket ? _redPacket(c) : _transfer(c);

  Widget _transfer(BuildContext c) => QChatPage(
    title: '',
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: SafeArea(
      top: false,
      bottom: !keypadVisible,
      child: Column(
        children: [
          _recipient(c),
          Expanded(child: _transferCard(c)),
          if (keypadVisible)
            ColoredBox(
              color: qchatNavigationSurface(c),
              child: SafeArea(
                top: false,
                child: QChatKeypad(
                  onDigit: pressDigit,
                  onBackspace: sending ? null : backspace,
                  onDecimal: sending ? null : () {},
                  onSubmit: sending ? null : submit,
                  submitLabel: tr(c, 'transferMoney'),
                  submitLoading: sending,
                  backspaceLabel: tr(c, 'backspace'),
                  enabled: !sending,
                ),
              ),
            ),
        ],
      ),
    ),
  );

  Widget _recipient(BuildContext c) {
    final id = target;
    final name = recipientName;
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 10, 32, 30),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  id.isEmpty
                      ? tr(c, 'transferTo')
                      : '${tr(c, 'transferTo')} $name',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 20,
                    height: 1.2,
                    fontWeight: FontWeight.w500,
                    color: ink(c),
                  ),
                ),
                const SizedBox(height: 3),
                if (widget.to.isNotEmpty)
                  Text(
                    '${tr(c, 'qchatId')}: ${widget.to}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      height: 1.2,
                      color: qchatMuted(c),
                    ),
                  )
                else
                  SizedBox(
                    height: 24,
                    child: CupertinoTextField(
                      controller: to,
                      focusNode: recipientFocus,
                      placeholder: tr(c, 'enterRecipientId'),
                      placeholderStyle: const TextStyle(
                        fontSize: 15,
                        color: _placeholderGrey,
                      ),
                      decoration: const BoxDecoration(),
                      padding: EdgeInsets.zero,
                      maxLength: 32,
                      style: TextStyle(fontSize: 15, color: ink(c)),
                      cursorColor: QChatColors.green,
                      onChanged: (_) => setState(() => error = null),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          UserAvatar({'nickname': name, 'avatarId': widget.avatarId}, size: 48),
        ],
      ),
    );
  }

  Widget _transferCard(BuildContext c) => Container(
    width: double.infinity,
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
    ),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(32, 22, 32, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr(c, 'amountTransferred'),
            style: TextStyle(fontSize: 17, height: 1.2, color: ink(c)),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: sending ? null : toggleKeypad,
            child: SizedBox(
              height: 54,
              child: Row(
                children: [
                  Text(
                    '₫',
                    style: TextStyle(
                      fontSize: 40,
                      height: 1,
                      fontWeight: FontWeight.w700,
                      color: ink(c),
                    ),
                  ),
                  const SizedBox(width: 10),
                  if (digits.isNotEmpty)
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          moneyText(amount, withUnit: false),
                          key: const ValueKey('transfer-amount'),
                          style: TextStyle(
                            fontSize: 40,
                            height: 1,
                            fontWeight: FontWeight.w600,
                            color: ink(c),
                          ),
                        ),
                      ),
                    ),
                  if (keypadVisible) ...[
                    const SizedBox(width: 2),
                    const _BlinkingCaret(),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Container(height: .5, color: qchatLine(c)),
          const SizedBox(height: 18),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: sending ? null : editNote,
            child: Text(
              note.text.trim().isEmpty
                  ? tr(c, 'addTransferNote')
                  : note.text.trim(),
              style: TextStyle(
                fontSize: 17,
                height: 1.3,
                color: note.text.trim().isEmpty ? _linkBlue : ink(c),
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Text(
              error!,
              style: const TextStyle(fontSize: 14, color: QChatColors.danger),
            ),
          ],
        ],
      ),
    ),
  );

  Widget _redPacket(BuildContext c) => QChatPage(
    title: tr(c, 'sendRedPacket'),
    glassHeader: false,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    trailing: QChatIconButton(
      'more',
      label: tr(c, 'more'),
      onTap: () => qchatSheet(c, [
        (tr(c, 'receivedRedPackets'), () => c.push('/payments/wallet')),
      ]),
    ),
    child: Column(
      children: [
        Expanded(
          child: SafeArea(
            top: false,
            bottom: !keypadVisible,
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: SizedBox(
                  height: constraints.maxHeight < (widget.group ? 506 : 420)
                      ? (widget.group ? 506 : 420)
                      : constraints.maxHeight,
                  child: Column(
                    children: [
                      const SizedBox(height: 12),
                      _redRow(
                        c,
                        height: 56,
                        onTap: sending ? null : toggleKeypad,
                        child: Row(
                          children: [
                            Text(
                              tr(c, 'amountLabel'),
                              style: TextStyle(fontSize: 17, color: ink(c)),
                            ),
                            const Spacer(),
                            Text(
                              '₫${moneyText(amount, withUnit: false)}',
                              style: TextStyle(
                                fontSize: 17,
                                color: amount == 0 ? _placeholderGrey : ink(c),
                              ),
                            ),
                            if (keypadVisible) ...[
                              const SizedBox(width: 2),
                              const _BlinkingCaret(height: 20),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (widget.group) ...[
                        _redRow(
                          c,
                          height: 54,
                          child: Row(
                            children: [
                              Text(
                                tr(c, 'splitMode'),
                                style: TextStyle(fontSize: 17, color: ink(c)),
                              ),
                              const Spacer(),
                              _splitChoice(c, 'EQUAL', tr(c, 'splitEven')),
                              const SizedBox(width: 8),
                              _splitChoice(c, 'RANDOM', tr(c, 'splitRandom')),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(22, 6, 22, 0),
                          child: Text(
                            '${tr(c, splitMode == 'EQUAL' ? 'splitEvenHint' : 'splitRandomHint')}'
                            ' · ${tr(c, 'refundNotice')}',
                            style: TextStyle(
                              fontSize: 12,
                              height: 1.35,
                              color: qchatMuted(c),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      _redRow(
                        c,
                        height: 64,
                        child: Row(
                          children: [
                            Expanded(
                              child: CupertinoTextField(
                                controller: note,
                                focusNode: noteFocus,
                                placeholder: tr(c, 'bestWishes'),
                                placeholderStyle: const TextStyle(
                                  fontSize: 17,
                                  color: _placeholderGrey,
                                ),
                                decoration: const BoxDecoration(),
                                padding: EdgeInsets.zero,
                                maxLength: 100,
                                style: TextStyle(fontSize: 17, color: ink(c)),
                                cursorColor: QChatColors.green,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: addWishEmoji,
                              child: _emojiPlus(c),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        key: const ValueKey('red-packet-cover-row'),
                        behavior: HitTestBehavior.opaque,
                        onTap: sending ? null : pickCover,
                        child: _redRow(
                          c,
                          height: 64,
                          child: Row(
                            children: [
                              Text(
                                tr(c, 'redPacketCover'),
                                style: TextStyle(fontSize: 17, color: ink(c)),
                              ),
                              const Spacer(),
                              if (selectedCover != null) ...[
                                SizedBox(
                                  width: 26,
                                  height: 26 * 4 / 3,
                                  child: CoverThumb(
                                    design: selectedCover!.design,
                                    radius: 4,
                                    showOpen: false,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 110,
                                  ),
                                  child: Text(
                                    selectedCover!.id == 'default'
                                        ? tr(c, 'defaultCover')
                                        : selectedCover!.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: QChatColors.muted,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                              ],
                              const QChatIcon(
                                'chevron',
                                size: 18,
                                color: QChatColors.muted,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: sending ? null : toggleKeypad,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '₫',
                              style: TextStyle(
                                fontSize: 40,
                                height: 1,
                                fontWeight: FontWeight.w600,
                                color: ink(c),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              moneyText(amount, withUnit: false),
                              style: TextStyle(
                                fontSize: 48,
                                height: 1,
                                fontWeight: FontWeight.w600,
                                color: ink(c),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 30),
                      _sendButton(c),
                      const Spacer(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (keypadVisible)
          ColoredBox(
            color: qchatNavigationSurface(c),
            child: SafeArea(
              top: false,
              child: QChatKeypad(
                onDigit: pressDigit,
                onBackspace: sending ? null : backspace,
                onDecimal: sending ? null : () {},
                onSubmit: sending ? null : submit,
                submitLabel: tr(c, 'ok'),
                submitColor: _redPacketButton,
                submitLoading: sending,
                backspaceLabel: tr(c, 'backspace'),
                enabled: !sending,
              ),
            ),
          ),
      ],
    ),
  );

  /// One of the two group split options. Drawn as a pill so the active choice
  /// reads at a glance without a Material segmented control.
  Widget _splitChoice(BuildContext c, String value, String label) {
    final selected = splitMode == value;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: sending ? null : () => setState(() => splitMode = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: selected
                ? _redPacketButton.withValues(alpha: .12)
                : qchatFill(c),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? _redPacketButton : QChatColors.transparent,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              color: selected ? _redPacketButton : qchatMuted(c),
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }

  Widget _redRow(
    BuildContext c, {
    required Widget child,
    double height = 64,
    VoidCallback? onTap,
  }) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: BorderRadius.circular(10),
        ),
        child: child,
      ),
    ),
  );

  Widget _emojiPlus(BuildContext c) => SizedBox(
    width: 26,
    height: 26,
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        const QChatIcon('emoji', size: 24, color: QChatColors.muted),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 12,
            height: 12,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: surface(c),
              shape: BoxShape.circle,
            ),
            child: const Text(
              '+',
              style: TextStyle(
                fontSize: 12,
                height: 1,
                color: QChatColors.muted,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  void addWishEmoji() {
    if (sending) return;
    const emoji = '🧧';
    final text = note.text;
    final selection = note.selection;
    final at = selection.isValid ? selection.end : text.length;
    note.value = TextEditingValue(
      text: text.replaceRange(at, at, emoji),
      selection: TextSelection.collapsed(offset: at + emoji.length),
    );
    setState(() {});
  }

  Widget _sendButton(BuildContext c) => Semantics(
    button: true,
    enabled: !sending,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: sending ? null : submit,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 120),
        opacity: sending ? .6 : 1,
        child: Container(
          width: 184,
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _redPacketButton,
            borderRadius: BorderRadius.circular(10),
          ),
          child: sending
              ? const CupertinoActivityIndicator(
                  radius: 9,
                  color: QChatColors.white,
                )
              : Text(
                  tr(c, 'send'),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                    color: QChatColors.white,
                  ),
                ),
        ),
      ),
    ),
  );
}

class _BlinkingCaret extends StatefulWidget {
  const _BlinkingCaret({this.height = 44});

  final double height;

  @override
  State<_BlinkingCaret> createState() => _BlinkingCaretState();
}

class _BlinkingCaretState extends State<_BlinkingCaret>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 560),
  )..repeat(reverse: true);

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => FadeTransition(
    opacity: Tween<double>(
      begin: 1,
      end: 0,
    ).animate(CurvedAnimation(parent: controller, curve: Curves.easeInOut)),
    child: Container(width: 2, height: widget.height, color: _caretGreen),
  );
}
