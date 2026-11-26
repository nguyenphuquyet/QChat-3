import 'package:flutter/cupertino.dart';

import 'qchat_colors.dart';
import 'qchat_theme.dart';

/// WeChat-style numeric keypad drawn by QChat.
///
/// The last column holds the delete key above a tall submit button that spans
/// the three rows below it. Every key is a plain [GestureDetector] on a
/// [Container], so no Material widget is involved.
class QChatKeypad extends StatelessWidget {
  const QChatKeypad({
    super.key,
    required this.onDigit,
    this.onBackspace,
    this.onDecimal,
    this.onSubmit,
    this.submitLabel = '',
    this.submitColor = QChatColors.green,
    this.submitLoading = false,
    this.backspaceLabel = 'Delete',
    this.enabled = true,
    this.background,
    this.keyColor,
    this.padding = const EdgeInsets.all(8),
  });

  final ValueChanged<String> onDigit;
  final VoidCallback? onBackspace, onDecimal, onSubmit;
  final String submitLabel, backspaceLabel;
  final Color submitColor;
  final bool submitLoading, enabled;
  final Color? background, keyColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    final background =
        this.background ??
        (dark ? QChatColors.darkSurface : const Color(0xfff7f7f7));
    final keyColor =
        this.keyColor ?? (dark ? QChatColors.darkFill : QChatColors.white);
    final pressedColor = dark
        ? const Color(0xff3a3a3a)
        : const Color(0xffe6e6e6);
    final textColor = qchatInk(c);
    const gap = 8.0;
    const keyHeight = 50.0;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: background,
        border: Border(top: BorderSide(color: qchatLine(c), width: .5)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: LayoutBuilder(
            builder: (c, box) {
              final keyWidth =
                  (box.maxWidth - padding.horizontal - gap * 3) / 4;
              final submitHeight = keyHeight * 3 + gap * 2;

              Widget digit(String value) => _Key(
                key: ValueKey('keypad-$value'),
                label: value,
                width: keyWidth,
                textColor: textColor,
                color: keyColor,
                pressedColor: pressedColor,
                onTap: enabled ? () => onDigit(value) : null,
              );

              Widget row(List<Widget> keys) => Row(
                children: [
                  for (var index = 0; index < keys.length; index++) ...[
                    if (index > 0) const SizedBox(width: gap),
                    keys[index],
                  ],
                ],
              );

              return Padding(
                padding: padding,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: keyWidth * 3 + gap * 2,
                      child: Column(
                        children: [
                          row([digit('1'), digit('2'), digit('3')]),
                          const SizedBox(height: gap),
                          row([digit('4'), digit('5'), digit('6')]),
                          const SizedBox(height: gap),
                          row([digit('7'), digit('8'), digit('9')]),
                          const SizedBox(height: gap),
                          Row(
                            children: [
                              _Key(
                                key: const ValueKey('keypad-0'),
                                label: '0',
                                width: keyWidth * 2 + gap,
                                textColor: textColor,
                                color: keyColor,
                                pressedColor: pressedColor,
                                onTap: enabled ? () => onDigit('0') : null,
                              ),
                              const SizedBox(width: gap),
                              _Key(
                                key: const ValueKey('keypad-decimal'),
                                label: '.',
                                width: keyWidth,
                                textColor: onDecimal == null
                                    ? qchatMuted(c)
                                    : textColor,
                                color: keyColor,
                                pressedColor: pressedColor,
                                onTap: enabled ? onDecimal : null,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: gap),
                    SizedBox(
                      width: keyWidth,
                      child: Column(
                        children: [
                          _Key(
                            key: const ValueKey('keypad-backspace'),
                            label: backspaceLabel,
                            width: keyWidth,
                            color: keyColor,
                            pressedColor: pressedColor,
                            onTap: enabled ? onBackspace : null,
                            child: CustomPaint(
                              size: const Size(28, 20),
                              painter: _BackspacePainter(textColor),
                            ),
                          ),
                          const SizedBox(height: gap),
                          _SubmitKey(
                            key: const ValueKey('keypad-submit'),
                            label: submitLabel,
                            width: keyWidth,
                            height: submitHeight,
                            color: submitColor,
                            loading: submitLoading,
                            onTap: enabled ? onSubmit : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Key extends StatefulWidget {
  const _Key({
    super.key,
    required this.label,
    this.onTap,
    this.width,
    this.color,
    this.pressedColor,
    this.textColor,
    this.child,
  });

  final String label;
  final VoidCallback? onTap;
  final double? width;
  final Color? color, pressedColor, textColor;
  final Widget? child;

  @override
  State<_Key> createState() => _KeyState();
}

class _KeyState extends State<_Key> {
  bool pressed = false;

  void setPressed(bool value) {
    if (widget.onTap == null || pressed == value) return;
    setState(() => pressed = value);
  }

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    enabled: widget.onTap != null,
    label: widget.label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null ? null : (_) => setPressed(true),
      onTapUp: widget.onTap == null
          ? null
          : (_) {
              setPressed(false);
              widget.onTap!();
            },
      onTapCancel: widget.onTap == null ? null : () => setPressed(false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        width: widget.width,
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: pressed ? widget.pressedColor : widget.color,
          borderRadius: BorderRadius.circular(6),
          boxShadow: pressed
              ? null
              : const [
                  BoxShadow(
                    color: Color(0x0f000000),
                    blurRadius: 1,
                    offset: Offset(0, 1),
                  ),
                ],
        ),
        child:
            widget.child ??
            Text(
              widget.label,
              style: TextStyle(
                fontSize: 22,
                height: 1,
                fontWeight: FontWeight.w400,
                color: widget.textColor,
              ),
            ),
      ),
    ),
  );
}

class _SubmitKey extends StatefulWidget {
  const _SubmitKey({
    super.key,
    required this.label,
    required this.width,
    required this.height,
    required this.color,
    required this.loading,
    this.onTap,
  });

  final String label;
  final double width, height;
  final Color color;
  final bool loading;
  final VoidCallback? onTap;

  @override
  State<_SubmitKey> createState() => _SubmitKeyState();
}

class _SubmitKeyState extends State<_SubmitKey> {
  bool pressed = false;

  void setPressed(bool value) {
    if (widget.onTap == null || pressed == value) return;
    setState(() => pressed = value);
  }

  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    enabled: widget.onTap != null,
    label: widget.label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null ? null : (_) => setPressed(true),
      onTapUp: widget.onTap == null
          ? null
          : (_) {
              setPressed(false);
              widget.onTap!();
            },
      onTapCancel: widget.onTap == null ? null : () => setPressed(false),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 100),
        opacity: widget.onTap == null && !widget.loading ? .5 : 1,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          width: widget.width,
          height: widget.height,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: pressed
                ? widget.color.withValues(alpha: .82)
                : widget.color,
            borderRadius: BorderRadius.circular(8),
          ),
          child: widget.loading
              ? const CupertinoActivityIndicator(
                  radius: 9,
                  color: QChatColors.white,
                )
              : Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: const TextStyle(
                    color: QChatColors.white,
                    fontSize: 15,
                    height: 1.2,
                    fontWeight: FontWeight.w500,
                  ),
                ),
        ),
      ),
    ),
  );
}

class _BackspacePainter extends CustomPainter {
  _BackspacePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final body = Path()
      ..moveTo(w * .32, h * .18)
      ..lineTo(w * .92, h * .18)
      ..quadraticBezierTo(w, h * .18, w, h * .3)
      ..lineTo(w, h * .7)
      ..quadraticBezierTo(w, h * .82, w * .92, h * .82)
      ..lineTo(w * .32, h * .82)
      ..lineTo(w * .06, h * .56)
      ..quadraticBezierTo(w * .02, h * .5, w * .06, h * .44)
      ..close();
    canvas.drawPath(body, Paint()..color = color);
    final cross = Paint()
      ..color = QChatColors.white
      ..strokeWidth = w * .075
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(w * .45, h * .36),
      Offset(w * .67, h * .64),
      cross,
    );
    canvas.drawLine(
      Offset(w * .67, h * .36),
      Offset(w * .45, h * .64),
      cross,
    );
  }

  @override
  bool shouldRepaint(_BackspacePainter old) => old.color != color;
}
