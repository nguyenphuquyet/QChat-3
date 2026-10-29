import 'package:flutter/cupertino.dart';

import 'qchat_colors.dart';

/// App-wide light/dark switch. QChat draws every surface itself, so this is a
/// plain inherited value instead of a Material [ThemeData] tree.
class QChatTheme extends StatelessWidget {
  const QChatTheme({super.key, required this.dark, required this.child});

  final bool dark;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ink = dark ? QChatColors.darkInk : QChatColors.ink;
    final background = dark
        ? QChatColors.darkBackground
        : QChatColors.background;
    final surface = dark ? QChatColors.darkSurface : QChatColors.white;
    // Keep whatever family the host resolved (SF, Roboto, Segoe UI) instead of
    // dropping it: QChat ships no fonts, so the family belongs to the platform.
    final text = TextStyle(
      color: ink,
      fontSize: 16,
      height: 1.35,
      fontFamily: DefaultTextStyle.of(context).style.fontFamily,
      decoration: TextDecoration.none,
    );
    return _QChatThemeScope(
      dark: dark,
      child: CupertinoTheme(
        data: CupertinoThemeData(
          brightness: dark ? Brightness.dark : Brightness.light,
          primaryColor: QChatColors.green,
          primaryContrastingColor: QChatColors.white,
          barBackgroundColor: surface,
          scaffoldBackgroundColor: background,
          textTheme: CupertinoTextThemeData(
            textStyle: text,
            navTitleTextStyle: text.copyWith(
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
            navLargeTitleTextStyle: text.copyWith(
              fontSize: 34,
              fontWeight: FontWeight.w700,
            ),
            navActionTextStyle: text.copyWith(fontSize: 17),
          ),
        ),
        child: DefaultTextStyle(style: text, child: child),
      ),
    );
  }
}

class _QChatThemeScope extends InheritedWidget {
  const _QChatThemeScope({required this.dark, required super.child});

  final bool dark;

  @override
  bool updateShouldNotify(_QChatThemeScope oldWidget) =>
      oldWidget.dark != dark;
}

/// Whether the app is currently rendering its dark palette.
bool qchatDark(BuildContext context) {
  final scope = context.dependOnInheritedWidgetOfExactType<_QChatThemeScope>();
  if (scope != null) return scope.dark;
  return MediaQuery.maybeOf(context)?.platformBrightness == Brightness.dark;
}

Color qchatBackground(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkBackground : QChatColors.background;

Color qchatSurface(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkSurface : QChatColors.white;

Color qchatFill(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkFill : const Color(0xfff2f2f2);

Color qchatInk(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkInk : QChatColors.ink;

Color qchatMuted(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkMuted : QChatColors.muted;

Color qchatLine(BuildContext context) =>
    qchatDark(context) ? QChatColors.darkLine : QChatColors.line;

Color qchatNavigationSurface(BuildContext context) =>
    qchatDark(context) ? qchatSurface(context) : const Color(0xfff7f7f7);

/// Picks the readable icon set for a status/navigation bar of [color].
Brightness qchatBrightnessOfColor(Color color) =>
    color.computeLuminance() > .5 ? Brightness.light : Brightness.dark;
