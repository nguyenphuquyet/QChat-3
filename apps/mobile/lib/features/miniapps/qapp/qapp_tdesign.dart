import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';

import '../../../core/design_system/components.dart';

/// The one door through which TDesign enters a Mini App frame.
///
/// `apps/mobile` is a Material-free app: the chat UI is drawn by the QChat
/// design system. A Mini App is different — its UI belongs to the Mini App
/// author, and the runtime renders the contract controls with TDesign
/// (Tencent's design language) while the *motion* of every overlay stays
/// Cupertino. Keeping the import in this file means the exception is exactly
/// one import wide: every other renderer file keeps importing only
/// `flutter/cupertino.dart` and the QChat design system, and no other file can
/// reach a TDesign or Material symbol by accident.
///
/// `package:tdesign_flutter` re-exports Material, so this file also installs
/// the Material localizations for the frame. Without them a TDesign input or
/// selection toolbar has nothing to read its strings from.
class QappTDesignScope extends StatelessWidget {
  const QappTDesignScope({super.key, required this.child});

  final Widget child;

  /// One immutable theme for every frame. `TThemeData.defaultData()` is the
  /// stock TDesign palette (brand `#0052D9`), which is what "TDesign UI" means;
  /// a Mini App still overrides individual colours through `style.*`.
  static final ThemeData _theme = TThemeBuilder.light(TThemeData.defaultData());

  @override
  Widget build(BuildContext context) {
    return Localizations(
      locale: Localizations.maybeLocaleOf(context) ?? const Locale('vi'),
      delegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      child: Theme(
        data: _theme,
        // The TDesign slider and input still delegate their gestures to the
        // framework's Material implementations, so the frame needs an ink
        // surface under them. It is transparent and never reaches the chat UI:
        // it exists only inside a Mini App frame.
        child: Material(type: MaterialType.transparency, child: child),
      ),
    );
  }
}

/// The colour a TDesign button draws its label and icon in.
Color qappTButtonForeground(BuildContext context, String variant) =>
    switch (variant) {
      'secondary' => QChatColors.ink,
      'outline' || 'text' => Theme.of(context).colorScheme.primary,
      _ => QChatColors.white,
    };

/// `Button`: TDesign's filled / outline / text button. The contract owns the
/// label, the loading state, the disabled state and any colour the app sets
/// through `style.*`; TDesign owns the shape, the palette and the interaction.
class QappTButton extends StatelessWidget {
  const QappTButton({
    super.key,
    required this.label,
    required this.variant,
    required this.size,
    this.icon,
    this.loading = false,
    this.disabled = false,
    this.onPressed,
    this.onLongPress,
    this.foreground,
    this.background,
    this.borderColor,
    this.borderWidth = 0,
    this.radius,
    this.padding,
    this.minHeight,
    this.textStyle,
  });

  final String label;
  final String variant;
  final Object? size;
  final String? icon;
  final bool loading;
  final bool disabled;
  final VoidCallback? onPressed;
  final VoidCallback? onLongPress;
  final Color? foreground;
  final Color? background;
  final Color? borderColor;
  final double borderWidth;
  final BorderRadius? radius;
  final EdgeInsets? padding;
  final double? minHeight;
  final TextStyle? textStyle;

  double get _iconSize => switch (size) {
    'sm' => 14,
    'lg' => 20,
    _ => 17,
  };

  ButtonStyle _style(BuildContext context) {
    final borderRadius = radius ?? BorderRadius.circular(6);
    final side = borderWidth > 0
        ? BorderSide(
            color: borderColor ?? foreground ?? qappTButtonForeground(context, variant),
            width: borderWidth,
          )
        : null;
    return ButtonStyle(
      backgroundColor: background == null
          ? null
          : WidgetStatePropertyAll(background),
      foregroundColor: foreground == null
          ? null
          : WidgetStatePropertyAll(foreground),
      padding: padding == null ? null : WidgetStatePropertyAll(padding),
      minimumSize: minHeight == null
          ? null
          : WidgetStatePropertyAll(Size(64, minHeight!)),
      shape: WidgetStatePropertyAll(
        RoundedRectangleBorder(borderRadius: borderRadius),
      ),
      side: side == null ? null : WidgetStatePropertyAll(side),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tone = foreground ?? qappTButtonForeground(context, variant);
    return TButton(
      variant: qappTButtonVariant(variant),
      colorPreset: qappTButtonColorPreset(variant),
      size: qappTButtonSize(size),
      onPressed: disabled || loading ? null : onPressed,
      onLongPress: disabled || loading ? null : onLongPress,
      style: _style(context),
      icon: icon == null
          ? null
          : QappTIcon(icon!, size: _iconSize, color: tone),
      child: loading
          ? TLoading(size: _iconSize)
          : Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: textStyle,
            ),
    );
  }
}

/// `Tag`: the TDesign tag palette, which happens to match the contract's tones
/// one to one (neutral, primary, success, warning, danger).
class QappTTag extends StatelessWidget {
  const QappTTag({
    super.key,
    required this.text,
    required this.tone,
    required this.size,
  });

  final String text;
  final String tone;
  final Object? size;

  @override
  Widget build(BuildContext context) {
    return TTag(
      text,
      colorPreset: qappTTagColorPreset(tone),
      size: qappTTagSize(size),
      shape: TTagShape.square,
    );
  }
}

/// `Badge`: a count badge (`circle`) or a bare dot over the node's child.
class QappTBadge extends StatelessWidget {
  const QappTBadge({
    super.key,
    required this.label,
    required this.dot,
    this.child,
  });

  final String label;
  final bool dot;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    if (child == null) {
      return dot
          ? const TBadge(variant: TBadgeVariant.dot, label: '')
          : TBadge(label: label);
    }
    return TBadge(
      variant: dot ? TBadgeVariant.dot : TBadgeVariant.circle,
      label: label,
      child: child,
    );
  }
}

/// `Checkbox`: the TDesign box with its own label slot.
class QappTCheckbox extends StatelessWidget {
  const QappTCheckbox({
    super.key,
    required this.value,
    required this.label,
    required this.disabled,
    required this.onChanged,
  });

  final bool value;
  final String label;
  final bool disabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return TCheckbox(
      value: value,
      title: label.isEmpty ? null : label,
      showDivider: false,
      onChanged: disabled ? null : (next) => onChanged(next ?? false),
    );
  }
}

/// `Switch`: the TDesign switch.
class QappTSwitch extends StatelessWidget {
  const QappTSwitch({
    super.key,
    required this.value,
    required this.disabled,
    required this.onChanged,
  });

  final bool value;
  final bool disabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return TSwitch(
      value: value,
      onChanged: disabled ? null : onChanged,
    );
  }
}

/// `Slider`: the TDesign slider. `divisions` is how TDesign expresses a step.
class QappTSlider extends StatelessWidget {
  const QappTSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    this.divisions,
    this.disabled = false,
    this.onChanged,
    this.onChangeEnd,
  });

  final double value;
  final double min;
  final double max;
  final int? divisions;
  final bool disabled;
  final ValueChanged<double>? onChanged;
  final ValueChanged<double>? onChangeEnd;

  @override
  Widget build(BuildContext context) {
    return TSlider(
      value: value,
      min: min,
      max: max > min ? max : min + 1,
      divisions: divisions,
      onChanged: disabled ? null : onChanged,
      onChangeEnd: disabled ? null : onChangeEnd,
    );
  }
}

/// `TextField`: the TDesign input. `borderless` lets an app that painted its
/// own background and border keep that decoration instead of TDesign's.
class QappTInput extends StatelessWidget {
  const QappTInput({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.hintText,
    required this.multiline,
    this.enabled = true,
    this.obscure = false,
    this.autofocus = false,
    this.maxLength,
    this.inputType,
    this.textStyle,
    this.textAlign = TextAlign.start,
    this.borderless = false,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String hintText;
  final bool multiline;
  final bool enabled;
  final bool obscure;
  final bool autofocus;
  final int? maxLength;
  final TextInputType? inputType;
  final TextStyle? textStyle;
  final TextAlign textAlign;
  final bool borderless;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TInput(
      controller: controller,
      focusNode: focusNode,
      hintText: hintText,
      enabled: enabled,
      obscureText: obscure,
      autofocus: autofocus,
      maxLines: multiline ? null : 1,
      minLines: multiline ? 3 : 1,
      maxLength: maxLength,
      inputType: multiline
          ? TextInputType.multiline
          : (inputType ?? TextInputType.text),
      textAlign: textAlign,
      style: textStyle,
      borderless: borderless,
      // The contract lets an app draw its own counter; TDesign's would be a
      // second line inside the field and would push the layout.
      indicator: false,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
    );
  }
}

/// `ActivityIndicator`: TDesign's circular loading indicator. The contract's
/// colour is applied as a tint, because `TLoading` draws its ring from the
/// theme rather than from a colour parameter.
class QappTLoading extends StatelessWidget {
  const QappTLoading({super.key, this.size = 20, this.color});

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final loading = TLoading(size: size.clamp(8, 120));
    final tint = color;
    if (tint == null) return loading;
    return ColorFiltered(
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
      child: loading,
    );
  }
}

/// `Divider`: TDesign's rule, with the contract's colour, thickness and
/// leading inset folded into the divider theme for this one line.
class QappTDivider extends StatelessWidget {
  const QappTDivider({super.key, this.color, this.thickness, this.inset});

  final Color? color;
  final double? thickness;
  final double? inset;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).mergeExtension(
        TDividerThemeData(
          color: color,
          thickness: thickness,
          indent: inset,
          endIndent: 0,
          margin: EdgeInsets.zero,
        ),
      ),
      child: const TDivider(),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Contract enums                                                      */
/* ------------------------------------------------------------------ */

/// `Button` variant → the TDesign variant that draws it.
TButtonVariant qappTButtonVariant(String? variant) => switch (variant) {
  'outline' => TButtonVariant.outline,
  'text' => TButtonVariant.text,
  _ => TButtonVariant.fill,
};

TButtonColorPreset qappTButtonColorPreset(String? variant) => switch (variant) {
  'secondary' => TButtonColorPreset.defaultTheme,
  'danger' => TButtonColorPreset.danger,
  _ => TButtonColorPreset.primary,
};

TButtonSize qappTButtonSize(Object? size) => switch (size) {
  'sm' => TButtonSize.small,
  'lg' => TButtonSize.large,
  _ => TButtonSize.medium,
};

/// `Tag` tone → TDesign colour preset. The contract's tones are the same five
/// states TDesign ships, so a Mini App gets the real tag palette for free.
TTagColorPreset qappTTagColorPreset(String tone) => switch (tone) {
  'success' => TTagColorPreset.success,
  'warning' => TTagColorPreset.warning,
  'danger' => TTagColorPreset.danger,
  'primary' => TTagColorPreset.primary,
  _ => TTagColorPreset.defaultTheme,
};

TTagSize qappTTagSize(Object? size) => switch (size) {
  'sm' => TTagSize.small,
  'lg' => TTagSize.large,
  _ => TTagSize.medium,
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

/// Contract icon name → TDesign glyph.
///
/// The Mini App contract has its own small, stable icon vocabulary. Names that
/// exist in TDesign are drawn from the TDesign icon font; anything else falls
/// back to the QChat glyph set so an app never loses an icon.
IconData? qappTIconData(String name) => switch (name) {
  'check' => TIcons.check,
  'close' => TIcons.close,
  'chevronRight' => TIcons.chevron_right,
  'chevronLeft' => TIcons.chevron_left,
  'plus' => TIcons.add,
  'minus' => TIcons.minus,
  'heart' => TIcons.heart,
  'share' => TIcons.share,
  'delete' => TIcons.delete,
  'refresh' => TIcons.refresh,
  'info' => TIcons.info_circle,
  'clock' => TIcons.time,
  'grid' => TIcons.grid_view,
  'me' => TIcons.user,
  'addFriend' => TIcons.user_add,
  'groups' => TIcons.usergroup,
  'mail' => TIcons.mail,
  'call' => TIcons.call,
  'videoCall' => TIcons.video_camera,
  'camera' => TIcons.camera,
  'image' => TIcons.image,
  'location' => TIcons.location,
  'nearby' => TIcons.location,
  'file' => TIcons.folder_open,
  'folderOpen' => TIcons.folder_open,
  'music' => TIcons.music,
  'lock' => TIcons.lock_on,
  'pencil' => TIcons.edit,
  'official' => TIcons.edit,
  'star' => TIcons.star,
  'search' => TIcons.search,
  'service' => TIcons.shop,
  'wallet' => TIcons.wallet,
  'payments' => TIcons.wallet,
  'eye' => TIcons.browse,
  'tag' => TIcons.discount,
  'undo' => TIcons.rollback,
  'send' => TIcons.send,
  'miniApps' => TIcons.app,
  'discover' => TIcons.app,
  'chats' => TIcons.chat,
  'contacts' => TIcons.user_list,
  _ => null,
};

/// An icon drawn from the TDesign font, with the QChat glyphs as the fallback
/// for names TDesign does not have.
class QappTIcon extends StatelessWidget {
  const QappTIcon(
    this.name, {
    super.key,
    this.size = 22,
    this.color,
    this.semanticLabel,
  });

  final String name;
  final double size;
  final Color? color;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final glyph = qappTIconData(name);
    if (glyph == null) {
      return QChatIcon(
        name,
        size: size,
        color: color ?? QChatColors.ink,
      );
    }
    return TIcon(
      glyph,
      size: size,
      color: color,
      semanticLabel: semanticLabel,
    );
  }
}
