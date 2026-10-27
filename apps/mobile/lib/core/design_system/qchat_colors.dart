import 'package:flutter/widgets.dart';

abstract final class QChatColors {
  static const green = Color(0xff07c160),
      primary = Color(0xff07c160),
      bubble = Color(0xff95ec69),
      background = Color(0xffededed),
      ink = Color(0xff191919),
      muted = Color(0xff929292),
      line = Color(0xffe8e8e8),
      danger = Color(0xffef5350);

  // Neutral tokens used by the QChat surfaces. They are the app's own palette,
  // not Material's; both light and dark screens resolve through qchat* helpers.
  static const white = Color(0xffffffff),
      black = Color(0xff000000),
      transparent = Color(0x00000000),
      white70 = Color(0xb3ffffff),
      white38 = Color(0x61ffffff),
      black87 = Color(0xde000000),
      black38 = Color(0x61000000),
      black12 = Color(0x1f000000);

  static const darkBackground = Color(0xff111111),
      darkSurface = Color(0xff202020),
      darkFill = Color(0xff2c2c2c),
      darkInk = Color(0xffeeeeee),
      darkMuted = Color(0xff929895),
      darkLine = Color(0xff333333);
}
