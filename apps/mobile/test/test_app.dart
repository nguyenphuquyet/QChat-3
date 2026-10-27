import 'package:flutter/cupertino.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:qchat/core/design_system/components.dart';

const testLocales = [Locale('en'), Locale('vi'), Locale('zh')];

const testDelegates = <LocalizationsDelegate<dynamic>>[
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

/// A plain WidgetsApp host for widget tests. It deliberately avoids
/// MaterialApp so tests exercise the same widget tree the app ships.
Widget qchatHarness(
  Widget child, {
  bool dark = false,
  Locale locale = const Locale('en'),
}) => WidgetsApp(
  color: QChatColors.background,
  locale: locale,
  supportedLocales: testLocales,
  localizationsDelegates: testDelegates,
  pageRouteBuilder: <T>(RouteSettings settings, WidgetBuilder builder) =>
      PageRouteBuilder<T>(
        settings: settings,
        pageBuilder: (context, _, _) => builder(context),
      ),
  home: QChatTheme(dark: dark, child: child),
);

Widget qchatRouterHarness({
  required RouterConfig<Object> routerConfig,
  bool dark = false,
  Locale locale = const Locale('en'),
}) => WidgetsApp.router(
  color: QChatColors.background,
  locale: locale,
  supportedLocales: testLocales,
  localizationsDelegates: testDelegates,
  routerConfig: routerConfig,
  builder: (context, child) =>
      QChatTheme(dark: dark, child: child ?? const SizedBox.shrink()),
);
