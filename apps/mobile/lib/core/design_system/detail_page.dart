import 'package:flutter/widgets.dart';

import '../localization/strings.dart';
import 'components.dart';

/// Shared QChat navigation page with an optional back button.
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

  @override
  Widget build(BuildContext c) => QChatPage(
    title: title,
    glassHeader: glassHeader,
    statusBackground: whiteHeader ? surface(c) : null,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => Navigator.maybePop(c),
    ),
    child: child,
  );
}
