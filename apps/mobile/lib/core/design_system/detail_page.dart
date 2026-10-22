import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'components.dart';
import 'qchat_glass.dart';

/// Shared TDesign navigation, retaining QChat's system-bar handling.
class DetailPage extends StatelessWidget {
  const DetailPage({
    super.key,
    required this.child,
    this.title = '',
    this.whiteHeader = false,
    this.glassHeader = true,
  });
  final Widget child;
  final String title;
  final bool whiteHeader;
  final bool glassHeader;

  Widget _navBar(BuildContext c) => Theme(
    data: Theme.of(c).copyWith(
      extensions: [
        ...Theme.of(c).extensions.values.where((e) => e is! TNavBarThemeData),
        TNavBarThemeData(
          backgroundColor: glassHeader
              ? Colors.transparent
              : whiteHeader
              ? surface(c)
              : Theme.of(c).scaffoldBackgroundColor,
        ),
      ],
    ),
    child: TNavBar(title: Text(title), height: 54, useDefaultBack: true),
  );

  @override
  Widget build(BuildContext c) {
    if (!glassHeader) {
      return QChatPage(
        statusBackground: whiteHeader ? surface(c) : null,
        child: Column(
          children: [
            _navBar(c),
            Expanded(child: child),
          ],
        ),
      );
    }
    final media = MediaQuery.of(c);
    final barColor = whiteHeader
        ? surface(c)
        : Theme.of(c).scaffoldBackgroundColor;
    final inset = media.padding.top + 54;
    return QChatPage(
      edgeToEdge: true,
      child: Stack(
        children: [
          // The list keeps a MediaQuery inset instead of being pushed down,
          // so rows scroll under the floating bar.
          Positioned.fill(
            child: MediaQuery(
              data: media.copyWith(
                padding: media.padding.copyWith(top: inset, left: 0, right: 0),
                viewPadding: media.viewPadding.copyWith(top: inset),
              ),
              child: child,
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: QChatGlass(
              color: barColor,
              opacity: .72,
              child: SafeArea(bottom: false, child: _navBar(c)),
            ),
          ),
        ],
      ),
    );
  }
}
