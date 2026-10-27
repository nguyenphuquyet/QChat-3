import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../localization/strings.dart';
import 'qchat_colors.dart';
import 'qchat_glass.dart';
import 'qchat_icons.dart';
import 'qchat_shadows.dart';
import 'qchat_theme.dart';
import 'qchat_typography.dart';
import 'overlays.dart';

export 'overlays.dart';
export 'qchat_colors.dart';
export 'qchat_icons.dart';
export 'qchat_theme.dart';

Color surface(BuildContext context) => qchatSurface(context);
Color ink(BuildContext context) => qchatInk(context);

Color navigationSurface(BuildContext context) =>
    qchatNavigationSurface(context);

class QChatPage extends StatelessWidget {
  const QChatPage({
    super.key,
    required this.child,
    this.title,
    this.leading,
    this.trailing,
    this.bottom,
    this.background,
    this.backgroundImage,
    this.statusBackground,
    this.navigationBackground,
    this.edgeToEdge = false,
    this.glassHeader = true,
    this.titleColor,
  });
  final Widget child;
  final String? title;
  final Color? titleColor;
  final Widget? leading, trailing, bottom;
  final Color? background, statusBackground, navigationBackground;
  final ImageProvider? backgroundImage;
  final bool edgeToEdge;
  final bool glassHeader;
  @override
  Widget build(BuildContext c) {
    final media = MediaQuery.of(c);
    final pageColor = background ?? qchatBackground(c);
    final topColor = statusBackground ?? pageColor;
    final bottomColor = navigationBackground ?? pageColor;
    final topBrightness = qchatBrightnessOfColor(topColor);
    final bottomBrightness = qchatBrightnessOfColor(bottomColor);
    final appBar = title == null
        ? null
        : QChatAppBar(
            title: title!,
            leading: leading,
            trailing: trailing,
            color: titleColor,
          );
    final glassBar = appBar != null && glassHeader;
    final barHeight = media.padding.top + 54;
    final base = media.removePadding(
      removeLeft: true,
      removeRight: true,
      removeTop: glassBar || title != null || !edgeToEdge,
      removeBottom: bottom != null,
    );
    // A floating bar must not push the page down: its height becomes a
    // MediaQuery inset, so lists start below it but still scroll underneath.
    final content = MediaQuery(
      data: glassBar
          ? base.copyWith(
              padding: base.padding.copyWith(top: barHeight),
              viewPadding: base.viewPadding.copyWith(top: barHeight),
            )
          : base,
      child: child,
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: QChatColors.transparent,
        systemNavigationBarColor: QChatColors.transparent,
        systemNavigationBarDividerColor: QChatColors.transparent,
        systemStatusBarContrastEnforced: false,
        systemNavigationBarContrastEnforced: false,
        statusBarBrightness: topBrightness,
        statusBarIconBrightness: topBrightness == Brightness.dark
            ? Brightness.light
            : Brightness.dark,
        systemNavigationBarIconBrightness: bottomBrightness == Brightness.dark
            ? Brightness.light
            : Brightness.dark,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: pageColor,
          image: backgroundImage != null
              ? DecorationImage(image: backgroundImage!, fit: BoxFit.cover)
              : null,
        ),
        child: Column(
          children: [
            if (appBar != null && !glassHeader)
              ColoredBox(
                color: topColor,
                child: SafeArea(bottom: false, child: appBar),
              )
            else if (appBar == null && !edgeToEdge)
              ColoredBox(
                color: topColor,
                child: SizedBox(
                  width: double.infinity,
                  height: media.padding.top,
                ),
              ),
            Expanded(
              child: glassBar
                  ? Stack(
                      children: [
                        Positioned.fill(child: content),
                        Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          child: QChatGlass(
                            color: topColor,
                            opacity: .88,
                            border: false,
                            child: SafeArea(bottom: false, child: appBar),
                          ),
                        ),
                      ],
                    )
                  : content,
            ),
            if (bottom != null)
              ColoredBox(
                color: bottomColor,
                child: SafeArea(top: false, child: bottom!),
              ),
          ],
        ),
      ),
    );
  }
}

class QChatAppBar extends StatelessWidget {
  const QChatAppBar({
    super.key,
    required this.title,
    this.leading,
    this.trailing,
    this.color,
  });
  final String title;
  final Widget? leading, trailing;
  final Color? color;
  @override
  Widget build(BuildContext c) => SizedBox(
    height: 54,
    child: Row(
      children: [
        SizedBox(width: 64, child: leading),
        Expanded(
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: QChatTypography.title.copyWith(color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(width: 64, child: trailing),
      ],
    ),
  );
}

class QChatIconButton extends StatelessWidget {
  const QChatIconButton(
    this.icon, {
    super.key,
    required this.label,
    required this.onTap,
    this.color,
    this.size = 24,
  });
  final String icon, label;
  final VoidCallback? onTap;
  final Color? color;
  final double size;
  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: QChatIcon(icon, color: color ?? ink(c), size: size),
        ),
      ),
    ),
  );
}

class QChatButton extends StatelessWidget {
  const QChatButton(
    this.text, {
    super.key,
    this.onTap,
    this.secondary = false,
    this.loading = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
  });
  final String text;
  final VoidCallback? onTap;
  final bool secondary, loading;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext c) {
    final enabled = onTap != null && !loading;
    final background = secondary ? surface(c) : QChatColors.green;
    final foreground = secondary ? QChatColors.green : QChatColors.white;
    return Semantics(
      button: true,
      enabled: enabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 120),
          opacity: enabled || loading ? 1 : .45,
          child: Container(
            constraints: const BoxConstraints(minWidth: 90, minHeight: 44),
            padding: padding,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(5),
            ),
            child: loading
                ? SizedBox(
                    height: 18,
                    width: 18,
                    child: _QChatSpinner(
                      size: 18,
                      color: secondary ? QChatColors.green : foreground,
                    ),
                  )
                : Text(
                    text,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: foreground,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class QChatTextInput extends StatelessWidget {
  const QChatTextInput({
    super.key,
    required this.controller,
    required this.hint,
    this.secret = false,
    this.lines = 1,
    this.minLines,
    this.maxLines,
    this.maxLength,
    this.autofocus = false,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
    this.keyboardType,
    this.textInputAction,
  });
  final TextEditingController controller;
  final String hint;
  final bool secret, autofocus, enabled;
  final int lines;
  final int? minLines, maxLines, maxLength;
  final ValueChanged<String>? onChanged, onSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext c) => CupertinoTextField(
    controller: controller,
    placeholder: hint,
    placeholderStyle: TextStyle(color: QChatColors.muted, fontSize: 16),
    obscureText: secret,
    maxLines: maxLines ?? lines,
    minLines: minLines ?? (lines == 1 ? 1 : 1),
    maxLength: maxLength,
    autofocus: autofocus,
    enabled: enabled,
    onChanged: onChanged,
    onSubmitted: onSubmitted,
    keyboardType: keyboardType,
    textInputAction: textInputAction,
    cursorColor: QChatColors.green,
    style: TextStyle(color: ink(c), fontSize: 16),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: surface(c),
      border: Border.all(color: qchatLine(c), width: .5),
      borderRadius: BorderRadius.circular(5),
    ),
  );
}

class QChatSearchBar extends StatefulWidget {
  const QChatSearchBar({super.key, required this.controller, this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  @override
  State<QChatSearchBar> createState() => _QChatSearchBarState();
}

class _QChatSearchBarState extends State<QChatSearchBar> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
  }

  @override
  void didUpdateWidget(covariant QChatSearchBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
    child: Stack(
      alignment: Alignment.center,
      children: [
        CupertinoTextField(
          controller: widget.controller,
          onChanged: widget.onChanged,
          padding: const EdgeInsets.fromLTRB(34, 8, 32, 8),
          placeholder: '',
          cursorColor: QChatColors.green,
          style: TextStyle(color: ink(c), fontSize: 17),
          decoration: BoxDecoration(
            color: surface(c),
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        if (widget.controller.text.isEmpty)
          Positioned(
            left: 12,
            child: IgnorePointer(
              child: QChatIcon(
                'search',
                size: 18,
                color: QChatColors.muted,
              ),
            ),
          )
        else
          Positioned(
            right: 8,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.controller.clear,
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: QChatIcon(
                  'close',
                  size: 16,
                  color: QChatColors.muted,
                ),
              ),
            ),
          ),
        if (widget.controller.text.isEmpty)
          Positioned(
            left: 34,
            child: IgnorePointer(
              child: Text(
                tr(c, 'search'),
                style: const TextStyle(fontSize: 17, color: Color(0xffb2b2b2)),
              ),
            ),
          ),
      ],
    ),
  );
}

/// Search input used on detail screens. Keeps its own controller when the
/// caller does not need to own one.
class QChatSearchField extends StatefulWidget {
  const QChatSearchField({
    super.key,
    this.initialValue = '',
    this.controller,
    required this.hintText,
    this.autofocus = false,
    this.onChanged,
    this.onSubmitted,
  });
  final String initialValue, hintText;
  final TextEditingController? controller;
  final bool autofocus;
  final ValueChanged<String>? onChanged, onSubmitted;
  @override
  State<QChatSearchField> createState() => _QChatSearchFieldState();
}

class _QChatSearchFieldState extends State<QChatSearchField> {
  late final controller =
      widget.controller ?? TextEditingController(text: widget.initialValue);

  @override
  void dispose() {
    if (widget.controller == null) controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
    child: Stack(
      alignment: Alignment.center,
      children: [
        CupertinoTextField(
          controller: controller,
          autofocus: widget.autofocus,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          padding: const EdgeInsets.fromLTRB(34, 8, 32, 8),
          placeholder: widget.hintText,
          placeholderStyle: const TextStyle(
            fontSize: 15,
            color: QChatColors.muted,
          ),
          cursorColor: QChatColors.green,
          style: TextStyle(color: ink(c), fontSize: 15),
          decoration: BoxDecoration(
            color: surface(c),
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        const Positioned(
          left: 12,
          child: IgnorePointer(
            child: QChatIcon('search', size: 18, color: QChatColors.muted),
          ),
        ),
        if (controller.text.isNotEmpty)
          Positioned(
            right: 8,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                controller.clear();
                widget.onChanged?.call('');
              },
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: QChatIcon(
                  'close',
                  size: 16,
                  color: QChatColors.muted,
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class QChatAvatar extends StatelessWidget {
  const QChatAvatar(this.name, {super.key, this.size = 48, this.url});
  final String name;
  final double size;
  final String? url;

  Widget _letter() => Text(
    name.isEmpty ? 'Q' : name.characters.first.toUpperCase(),
    style: TextStyle(
      fontSize: size * .42,
      fontWeight: FontWeight.w500,
      color: const Color(0xff326b4c),
    ),
  );

  @override
  Widget build(BuildContext c) => SizedBox.square(
    dimension: size,
    child: ClipRRect(
      borderRadius: BorderRadius.circular(5),
      child: Container(
        color: const Color(0xffd7eade),
        alignment: Alignment.center,
        child: url == null || url!.isEmpty
            ? _letter()
            : Image.network(
                url!,
                fit: BoxFit.cover,
                width: size,
                height: size,
                errorBuilder: (_, _, _) => Center(child: _letter()),
              ),
      ),
    ),
  );
}

class QChatUnreadBadge extends StatelessWidget {
  const QChatUnreadBadge(this.count, {super.key});
  final int count;
  @override
  Widget build(BuildContext c) {
    if (count < 1) return const SizedBox.shrink();
    final label = count > 99 ? '99+' : '$count';
    // A single digit is a true circle; wider counts grow into a pill.
    final wide = label.length > 1;
    return Container(
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      padding: EdgeInsets.symmetric(horizontal: wide ? 5 : 0, vertical: 2),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: QChatColors.danger,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: QChatColors.white,
          fontSize: 11,
          height: 1.2,
        ),
      ),
    );
  }
}

class QChatListTile extends StatelessWidget {
  const QChatListTile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.titleLines = 1,
  });
  final String title;
  final String? subtitle;
  final Widget? leading, trailing;
  final VoidCallback? onTap;
  final int titleLines;
  @override
  Widget build(BuildContext c) => Semantics(
    button: onTap != null,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        color: surface(c),
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          children: [
            if (leading != null) ...[leading!, const SizedBox(width: 18)],
            Expanded(
              child: Container(
                padding: const EdgeInsets.fromLTRB(0, 17, 16, 17),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: ink(c).withValues(alpha: .07),
                      width: .5,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(fontSize: 17),
                            maxLines: titleLines,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 5),
                            Text(
                              subtitle!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: QChatColors.muted,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (trailing != null)
                      trailing!
                    else if (onTap != null)
                      const QChatIcon(
                        'chevron',
                        size: 18,
                        color: Color(0xffb8b8b8),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Plain settings row used across detail pages.
class QChatCell extends StatelessWidget {
  const QChatCell({
    super.key,
    this.title,
    this.subtitle,
    this.note,
    this.image,
    this.trailing,
    this.arrow = false,
    this.onTap,
  });
  final Widget? title, subtitle, note, image, trailing;
  final bool arrow;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext c) => Semantics(
    button: onTap != null,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        color: surface(c),
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          children: [
            if (image != null) ...[
              SizedBox.square(dimension: 42, child: image),
              const SizedBox(width: 14),
            ],
            Expanded(
              child: Container(
                constraints: const BoxConstraints(minHeight: 52),
                padding: const EdgeInsets.fromLTRB(0, 12, 16, 12),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: ink(c).withValues(alpha: .07),
                      width: .5,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (title != null)
                            DefaultTextStyle(
                              style: TextStyle(
                                fontSize: 16,
                                color: ink(c),
                              ),
                              child: title!,
                            ),
                          if (subtitle != null) ...[
                            const SizedBox(height: 3),
                            DefaultTextStyle(
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: QChatColors.muted,
                              ),
                              child: subtitle!,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (note != null) ...[
                      const SizedBox(width: 8),
                      DefaultTextStyle(
                        style: const TextStyle(
                          fontSize: 14,
                          color: QChatColors.muted,
                        ),
                        child: note!,
                      ),
                    ],
                    if (trailing != null) ...[
                      const SizedBox(width: 8),
                      trailing!,
                    ] else if (arrow) ...[
                      const SizedBox(width: 8),
                      const QChatIcon(
                        'chevron',
                        size: 18,
                        color: Color(0xffb8b8b8),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class QChatConversationTile extends StatelessWidget {
  const QChatConversationTile({
    super.key,
    required this.name,
    required this.preview,
    required this.onTap,
    this.unread = 0,
    this.time = '',
    this.avatar,
  });
  final String name, preview;
  final String time;
  final Widget? avatar;
  final int unread;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => Semantics(
    button: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        color: surface(c),
        padding: const EdgeInsets.only(left: 16),
        child: Row(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                avatar ?? QChatAvatar(name),
                if (unread > 0)
                  Positioned(
                    right: -5,
                    top: -5,
                    child: QChatUnreadBadge(unread),
                  ),
              ],
            ),
            const SizedBox(width: 18),
            Expanded(
              child: Container(
                padding: const EdgeInsets.fromLTRB(0, 17, 16, 17),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: ink(c).withValues(alpha: .07),
                      width: .5,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 17),
                          ),
                        ),
                        if (time.isNotEmpty) ...[
                          const SizedBox(width: 12),
                          Text(
                            time,
                            style: TextStyle(
                              fontSize: 12,
                              color: qchatDark(c)
                                  ? const Color(0xff929895)
                                  : const Color(0xffb2b2b2),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (preview.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        preview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          color: QChatColors.muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class QChatBottomNavigation extends StatelessWidget {
  const QChatBottomNavigation({
    super.key,
    required this.index,
    required this.onChanged,
  });
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext c) => Row(
    children: [
      for (int i = 0; i < 4; i++)
        Expanded(
          child: Semantics(
            selected: index == i,
            button: true,
            label: tr(c, ['chats', 'contacts', 'discover', 'me'][i]),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onChanged(i),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      (index == i
                          ? const [
                              CupertinoIcons.chat_bubble_fill,
                              CupertinoIcons.person_2_fill,
                              CupertinoIcons.compass_fill,
                              CupertinoIcons.person_fill,
                            ]
                          : const [
                              CupertinoIcons.chat_bubble,
                              CupertinoIcons.person_2,
                              CupertinoIcons.compass,
                              CupertinoIcons.person,
                            ])[i],
                      size: 26,
                      color: index == i ? QChatColors.green : ink(c),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      tr(c, ['chats', 'contacts', 'discover', 'me'][i]),
                      style: TextStyle(
                        fontSize: 11.5,
                        color: index == i ? QChatColors.green : ink(c),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

class QChatEmptyState extends StatelessWidget {
  const QChatEmptyState(this.text, {super.key, this.icon = 'chats'});
  final String text, icon;
  @override
  Widget build(BuildContext c) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          QChatIcon(icon, size: 48, color: QChatColors.muted),
          const SizedBox(height: 20),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: QChatColors.muted, height: 1.5),
          ),
        ],
      ),
    ),
  );
}

class QChatLoading extends StatelessWidget {
  const QChatLoading({
    super.key,
    this.label,
    this.size = 20,
    this.color = QChatColors.muted,
  });
  final String? label;
  final double size;
  final Color color;
  @override
  Widget build(BuildContext c) => Center(
    child: label == null
        ? _QChatSpinner(size: size, color: color)
        : Container(
            width: 164,
            height: 160,
            decoration: BoxDecoration(
              color: const Color(0xff3c3a3b),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const _QChatSpinner(size: 36, color: QChatColors.white),
                const SizedBox(height: 14),
                Text(
                  label!,
                  style: const TextStyle(
                    color: QChatColors.white,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
  );
}

class _QChatSpinner extends StatefulWidget {
  const _QChatSpinner({required this.size, required this.color});
  final double size;
  final Color color;
  @override
  State<_QChatSpinner> createState() => _QChatSpinnerState();
}

class _QChatSpinnerState extends State<_QChatSpinner>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: widget.size,
    child: RotationTransition(
      turns: _controller,
      child: CustomPaint(painter: _SpinnerPainter(widget.color)),
    ),
  );
}

class _SpinnerPainter extends CustomPainter {
  const _SpinnerPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = math.max(1.6, size.shortestSide * .11);
    final rect = Offset.zero & size;
    canvas.drawArc(
      rect.deflate(stroke / 2),
      -math.pi / 2,
      math.pi * 1.35,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) => old.color != color;
}

/// Three bouncing dots used for inline loading states.
class QChatDots extends StatefulWidget {
  const QChatDots({super.key, this.size = 22});
  final double size;
  @override
  State<QChatDots> createState() => _QChatDotsState();
}

class _QChatDotsState extends State<QChatDots>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) {
    final dot = widget.size * .19;
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (_, _) {
          final t = _controller.value * math.pi * 2;
          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) SizedBox(width: dot * .7),
                Transform.translate(
                  offset: Offset(
                    0,
                    -math.sin(t - i * .8).clamp(0.0, 1.0) * dot * .75,
                  ),
                  child: Container(
                    width: dot,
                    height: dot,
                    decoration: const BoxDecoration(
                      color: QChatColors.green,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Pull-to-refresh drawn with the app's own visuals: a round surface holding
/// the QChat dot loader slides out from under the header as the list is
/// pulled down, so no platform spinner ever appears.
///
/// The child must be a top-anchored scrollable; a short list should still use
/// `AlwaysScrollableScrollPhysics` so the pull is reported.
class QChatRefresh extends StatefulWidget {
  const QChatRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
    this.threshold = 58,
    this.maxDrag = 120,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  /// Pull distance that arms the refresh.
  final double threshold;

  /// Ceiling for the pull distance.
  final double maxDrag;

  @override
  State<QChatRefresh> createState() => _QChatRefreshState();
}

class _QChatRefreshState extends State<QChatRefresh>
    with SingleTickerProviderStateMixin {
  static const _pill = 38.0;
  static const _resistance = .65;

  /// Visual pull progress, 0 (hidden) to 1 (fully out and refreshing).
  late final AnimationController _position = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );

  double _drag = 0;
  bool _armed = false;
  bool _refreshing = false;

  @override
  void dispose() {
    _position.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification notification) {
    if (_refreshing) return false;
    if (notification is ScrollStartNotification) {
      if (notification.dragDetails != null && _drag != 0) {
        _drag = 0;
        _position.value = 0;
      }
      // Only a user drag that begins at the top can pull the indicator.
      _armed =
          notification.dragDetails != null &&
          notification.metrics.extentBefore <= 0;
      return false;
    }
    if (notification is OverscrollNotification) {
      // Clamping platforms report the pull as overscroll.
      if (!_armed) return false;
      if (notification.metrics.extentBefore > 0) return _cancel();
      _pull(-notification.overscroll);
      return false;
    }
    if (notification is ScrollUpdateNotification) {
      final metrics = notification.metrics;
      if (metrics.extentBefore > 0 ||
          metrics.pixels > metrics.minScrollExtent) {
        return _armed ? _cancel() : false;
      }
      if (notification.dragDetails == null) {
        // Bouncing platforms report the spring-back without drag details.
        return _armed && _drag >= widget.threshold ? _start() : _cancel();
      }
      _pull(-(notification.scrollDelta ?? 0));
      return false;
    }
    if (notification is ScrollEndNotification && _armed) {
      return _drag >= widget.threshold ? _start() : _cancel();
    }
    return false;
  }

  void _pull(double delta) {
    if (delta <= 0) return;
    final next = (_drag + delta * _resistance).clamp(0.0, widget.maxDrag);
    if (next == _drag) return;
    _drag = next;
    _position.value = (_drag / widget.threshold).clamp(0.0, 1.0);
  }

  bool _cancel() {
    _armed = false;
    _drag = 0;
    if (_position.value > 0) {
      _position.animateBack(
        0,
        duration: Duration(milliseconds: (60 + 140 * _position.value).round()),
      );
    }
    return false;
  }

  bool _start() {
    _armed = false;
    _refreshing = true;
    _position.animateTo(1, duration: const Duration(milliseconds: 120));
    _finish();
    return false;
  }

  Future<void> _finish() async {
    try {
      await widget.onRefresh();
    } catch (_) {
      // The screen keeps its own error state.
    }
    if (!mounted) return;
    _refreshing = false;
    _drag = 0;
    await _position.animateBack(
      0,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  Widget build(BuildContext context) => NotificationListener<ScrollNotification>(
    onNotification: _onScroll,
    child: Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        widget.child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: AnimatedBuilder(
              animation: _position,
              child: _indicator(context),
              builder: (context, child) {
                final t = _position.value;
                if (t <= .002) return const SizedBox.shrink();
                return Transform.translate(
                  offset: Offset(0, -_pill - 10 + t * (_pill + 18)),
                  child: Opacity(
                    opacity: t,
                    child: Center(
                      child: Transform.scale(
                        scale: .8 + .2 * t,
                        child: child,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    ),
  );

  Widget _indicator(BuildContext c) => Container(
    width: _pill,
    height: _pill,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: surface(c),
      shape: BoxShape.circle,
      border: Border.all(color: ink(c).withValues(alpha: .07), width: .5),
      boxShadow: QChatShadows.overlay,
    ),
    child: const QChatDots(size: 22),
  );
}

class QChatQuote extends StatelessWidget {
  const QChatQuote({
    super.key,
    required this.name,
    required this.text,
    this.onTap,
    this.onCancel,
    this.cancelLabel = 'Hủy trích dẫn',
    this.maxLines = 2,
  });
  final String name, text, cancelLabel;
  final int maxLines;
  final VoidCallback? onTap, onCancel;
  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    final compact = onCancel != null;
    final content = Text.rich(
      TextSpan(
        children: [
          if (name.isNotEmpty)
            TextSpan(
              text: '$name: ',
              style: TextStyle(
                color: ink(c).withValues(alpha: .5),
                fontWeight: FontWeight.w500,
              ),
            ),
          TextSpan(
            text: text,
            style: const TextStyle(color: QChatColors.muted),
          ),
        ],
      ),
      maxLines: compact ? 1 : maxLines,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        fontSize: compact ? 13.5 : 13,
        height: compact ? 1.3 : 1.4,
      ),
    );
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.fromLTRB(
          10,
          compact ? 5 : 8,
          compact ? 5 : 10,
          compact ? 5 : 8,
        ),
        decoration: BoxDecoration(
          color: dark
              ? QChatColors.white.withValues(alpha: .09)
              : const Color(0xffe9e9e9),
          borderRadius: BorderRadius.circular(compact ? 8 : 6),
        ),
        child: Row(
          mainAxisSize: compact ? MainAxisSize.max : MainAxisSize.min,
          children: [
            // Khung trong bong bóng co theo nội dung; khung trong ô nhập luôn
            // rộng hết chỗ để nút hủy nằm sát lề phải.
            if (compact)
              Expanded(child: content)
            else
              Flexible(child: content),
            if (onCancel != null) ...[
              const SizedBox(width: 6),
              Semantics(
                button: true,
                label: cancelLabel,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onCancel,
                  child: Container(
                    width: 18,
                    height: 18,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: dark
                          ? QChatColors.white.withValues(alpha: .35)
                          : const Color(0xffb3b3b3),
                      shape: BoxShape.circle,
                    ),
                    child: const QChatIcon(
                      'close',
                      size: 11,
                      color: QChatColors.white,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class QChatChatBubble extends StatelessWidget {
  const QChatChatBubble({
    super.key,
    required this.mine,
    required this.name,
    required this.child,
    this.onLongPress,
    this.avatar,
    this.bubbleWrapper,
    this.bareMedia = false,
  });
  final bool mine;
  final bool bareMedia;
  final String name;
  final Widget child;
  final Widget? avatar;
  final Widget Function(Widget)? bubbleWrapper;
  final VoidCallback? onLongPress;
  @override
  Widget build(BuildContext c) {
    final avatar = this.avatar ?? QChatAvatar(name, size: 42);
    final body = GestureDetector(
      onLongPress: onLongPress,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            padding: bareMedia
                ? EdgeInsets.zero
                : const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
            constraints: BoxConstraints(
              minHeight: bareMedia ? 0 : 42,
              maxWidth: MediaQuery.sizeOf(c).width * .68,
            ),
            decoration: BoxDecoration(
              color: bareMedia
                  ? QChatColors.transparent
                  : mine
                  ? QChatColors.bubble
                  : surface(c),
              borderRadius: BorderRadius.circular(5),
            ),
            child: DefaultTextStyle(
              style: TextStyle(
                color: mine && !bareMedia ? QChatColors.ink : ink(c),
                fontSize: 16,
                height: 1.375,
              ),
              child: child,
            ),
          ),
          if (!bareMedia)
            Positioned(
              top: 14,
              right: mine ? 6 : null,
              left: mine ? null : 6,
              child: Transform.rotate(
                angle: .785398,
                child: Container(
                  width: 12,
                  height: 12,
                  color: mine ? QChatColors.bubble : surface(c),
                ),
              ),
            ),
        ],
      ),
    );
    final bubble = Flexible(child: bubbleWrapper?.call(body) ?? body);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        mainAxisAlignment: mine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: mine ? [bubble, avatar] : [avatar, bubble],
      ),
    );
  }
}

Future<void> qchatSheet(
  BuildContext context,
  List<(String, VoidCallback)> actions,
) => showQChatSheet<void>(
  context,
  (c) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (final action in actions)
        QChatOverlayAction(
          label: action.$1,
          onTap: () {
            Navigator.pop(c);
            action.$2();
          },
        ),
    ],
  ),
);

class QChatError extends StatelessWidget {
  const QChatError({super.key, required this.error, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext c) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(tr(c, 'networkError')),
        const SizedBox(height: 16),
        QChatButton(tr(c, 'retry'), onTap: retry),
      ],
    ),
  );
}

/// A two-state switch drawn by QChat (no Material thumb or splash).
class QChatSwitch extends StatelessWidget {
  const QChatSwitch({
    super.key,
    required this.value,
    this.onChanged,
    this.activeColor = QChatColors.green,
  });
  final bool value;
  final ValueChanged<bool>? onChanged;
  final Color activeColor;

  @override
  Widget build(BuildContext c) => Semantics(
    toggled: value,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onChanged == null ? null : () => onChanged!(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        width: 46,
        height: 28,
        padding: const EdgeInsets.all(2),
        alignment: value ? Alignment.centerRight : Alignment.centerLeft,
        decoration: BoxDecoration(
          color: value ? activeColor : qchatFill(c),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: QChatColors.white,
            shape: BoxShape.circle,
            boxShadow: QChatShadows.overlay,
          ),
        ),
      ),
    ),
  );
}

/// Track/thumb slider with the app's own visuals.
class QChatSlider extends StatelessWidget {
  const QChatSlider({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 1,
    this.activeColor = QChatColors.green,
    this.trackColor,
    this.thumbColor = QChatColors.white,
    this.onChangeStart,
    this.onChangeEnd,
  });
  final double value, min, max;
  final ValueChanged<double>? onChanged;
  final ValueChanged<double>? onChangeStart, onChangeEnd;
  final Color activeColor, thumbColor;
  final Color? trackColor;

  double get _span => max - min == 0 ? 1 : max - min;

  @override
  Widget build(BuildContext c) => LayoutBuilder(
    builder: (context, constraints) {
      final width = constraints.hasBoundedWidth
          ? constraints.maxWidth
          : 160.0;
      final thumb = 14.0;
      double fraction() => ((value - min) / _span).clamp(0.0, 1.0);

      void update(Offset position) {
        if (onChanged == null) return;
        final usable = math.max(1.0, width - thumb);
        onChanged!(
          min + (position.dx - thumb / 2) / usable * _span,
        );
      }

      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: onChanged == null ? null : (d) => update(d.localPosition),
        onHorizontalDragStart: (d) {
          onChangeStart?.call(value);
          update(d.localPosition);
        },
        onHorizontalDragUpdate: (d) => update(d.localPosition),
        onHorizontalDragEnd: (_) => onChangeEnd?.call(value),
        child: SizedBox(
          width: width,
          height: 32,
          child: CustomPaint(
            painter: _SliderPainter(
              fraction: fraction(),
              activeColor: activeColor,
              trackColor: trackColor ?? qchatFill(context),
              thumbColor: thumbColor,
              thumb: thumb,
            ),
          ),
        ),
      );
    },
  );
}

class _SliderPainter extends CustomPainter {
  const _SliderPainter({
    required this.fraction,
    required this.activeColor,
    required this.trackColor,
    required this.thumbColor,
    required this.thumb,
  });
  final double fraction, thumb;
  final Color activeColor, trackColor, thumbColor;

  @override
  void paint(Canvas canvas, Size size) {
    final cy = size.height / 2;
    final left = thumb / 2;
    final right = math.max(left, size.width - thumb / 2);
    final x = left + (right - left) * fraction;
    final track = Paint()
      ..color = trackColor
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 4;
    canvas.drawLine(Offset(left, cy), Offset(right, cy), track);
    canvas.drawLine(
      Offset(left, cy),
      Offset(x, cy),
      track..color = activeColor,
    );
    canvas.drawCircle(
      Offset(x, cy),
      thumb / 2,
      Paint()..color = thumbColor,
    );
  }

  @override
  bool shouldRepaint(_SliderPainter old) =>
      old.fraction != fraction ||
      old.activeColor != activeColor ||
      old.trackColor != trackColor ||
      old.thumbColor != thumbColor;
}

class QChatTabBar extends StatelessWidget {
  const QChatTabBar({
    super.key,
    required this.labels,
    required this.index,
    required this.onChanged,
  });
  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext c) => Row(
    children: [
      for (var i = 0; i < labels.length; i++)
        Expanded(
          child: Semantics(
            selected: i == index,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onChanged(i),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      labels[i],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        color: i == index
                            ? QChatColors.primary
                            : QChatColors.muted,
                        fontWeight: i == index
                            ? FontWeight.w500
                            : FontWeight.w400,
                      ),
                    ),
                  ),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    height: 2.5,
                    width: 34,
                    color: i == index
                        ? QChatColors.primary
                        : QChatColors.transparent,
                  ),
                ],
              ),
            ),
          ),
        ),
    ],
  );
}

class QChatSwipeAction {
  const QChatSwipeAction({
    required this.label,
    required this.backgroundColor,
    required this.onPressed,
  });
  final String label;
  final Color backgroundColor;
  final VoidCallback onPressed;
}

/// Reveals trailing actions on a horizontal drag, using plain transforms so
/// there is no Material swipe cell or ripple.
class QChatSwipeCell extends StatefulWidget {
  const QChatSwipeCell({
    super.key,
    required this.child,
    required this.actions,
    this.actionWidth = 72,
  });
  final Widget child;
  final List<QChatSwipeAction> actions;
  final double actionWidth;

  @override
  State<QChatSwipeCell> createState() => _QChatSwipeCellState();
}

class _QChatSwipeCellState extends State<QChatSwipeCell> {
  double _offset = 0;
  bool _dragging = false;

  double get _maxDrag => -widget.actionWidth * widget.actions.length;

  void _close() {
    if (_offset != 0) setState(() => _offset = 0);
  }

  @override
  Widget build(BuildContext context) => ClipRect(
    child: Stack(
      children: [
        Positioned.fill(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              for (final action in widget.actions)
                SizedBox(
                  width: widget.actionWidth,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      _close();
                      action.onPressed();
                    },
                    child: ColoredBox(
                      color: action.backgroundColor,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text(
                            action.label,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: QChatColors.white,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        GestureDetector(
          onHorizontalDragStart: (_) =>
              setState(() => _dragging = true),
          onHorizontalDragUpdate: (details) => setState(() {
            _offset = (_offset + details.delta.dx)
                .clamp(_maxDrag, 0.0)
                .toDouble();
          }),
          onHorizontalDragEnd: (_) => setState(() {
            _dragging = false;
            _offset = _offset < _maxDrag / 2 ? _maxDrag : 0;
          }),
          child: AnimatedContainer(
            duration: _dragging
                ? Duration.zero
                : const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            transform: Matrix4.translationValues(_offset, 0, 0),
            child: widget.child,
          ),
        ),
      ],
    ),
  );
}
