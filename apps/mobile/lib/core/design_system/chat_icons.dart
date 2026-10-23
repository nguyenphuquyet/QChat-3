// GENERATED - Flutter bindings for the ChatIcons icon font.
// pubspec.yaml:
//   flutter:
//     fonts:
//       - family: ChatIcons
//         fonts:
//           - asset: assets/fonts/ChatIcons.ttf

import 'package:flutter/widgets.dart';

class ChatIcons {
  ChatIcons._();
  static const String fontFamily = 'ChatIcons';

  static const IconData tabChat = IconData(0xe001, fontFamily: fontFamily);
  static const IconData tabChatActive = IconData(0xe002, fontFamily: fontFamily);
  static const IconData tabContacts = IconData(0xe003, fontFamily: fontFamily);
  static const IconData tabContactsActive = IconData(
    0xe004,
    fontFamily: fontFamily,
  );
  static const IconData tabDiscover = IconData(0xe005, fontFamily: fontFamily);
  static const IconData tabDiscoverActive = IconData(
    0xe006,
    fontFamily: fontFamily,
  );
  static const IconData tabMe = IconData(0xe007, fontFamily: fontFamily);
  static const IconData tabMeActive = IconData(0xe008, fontFamily: fontFamily);
  static const IconData newFriend = IconData(0xe009, fontFamily: fontFamily);
  static const IconData groupChat = IconData(0xe00a, fontFamily: fontFamily);
  static const IconData tag = IconData(0xe00b, fontFamily: fontFamily);
  static const IconData serviceAccount = IconData(
    0xe00c,
    fontFamily: fontFamily,
  );
  static const IconData fileTransfer = IconData(0xe00d, fontFamily: fontFamily);
  static const IconData chatPair = IconData(0xe00e, fontFamily: fontFamily);
  static const IconData payService = IconData(0xe00f, fontFamily: fontFamily);
  static const IconData favorites = IconData(0xe010, fontFamily: fontFamily);
  static const IconData photo = IconData(0xe011, fontFamily: fontFamily);
  static const IconData sticker = IconData(0xe012, fontFamily: fontFamily);
  static const IconData settings = IconData(0xe013, fontFamily: fontFamily);
  static const IconData moments = IconData(0xe014, fontFamily: fontFamily);
  static const IconData channels = IconData(0xe015, fontFamily: fontFamily);
  static const IconData scan = IconData(0xe016, fontFamily: fontFamily);
  static const IconData topStories = IconData(0xe017, fontFamily: fontFamily);
  static const IconData searchSpark = IconData(0xe018, fontFamily: fontFamily);
  static const IconData nearby = IconData(0xe019, fontFamily: fontFamily);
  static const IconData miniProgram = IconData(0xe01a, fontFamily: fontFamily);
  static const IconData callOut = IconData(0xe01b, fontFamily: fontFamily);
  static const IconData chevronRight = IconData(0xe01c, fontFamily: fontFamily);
  static const IconData search = IconData(0xe01d, fontFamily: fontFamily);
}

/// Suggested colors for each icon (approx. taken from the reference art).
class ChatIconsColors {
  ChatIconsColors._();
  static const Color green = Color(0xFF07C160);
  static const Color orange = Color(0xFFFA9D3B);
  static const Color blue = Color(0xFF1485EE);
  static const Color skyBlue = Color(0xFF10AEFF);
  static const Color yellow = Color(0xFFFFC300);
  static const Color red = Color(0xFFFA5151);
  static const Color purple = Color(0xFF6467F0);
  static const Color tabIdle = Color(0xFF181818);
}

/// Rounded colored square with a white icon (contacts-style list rows).
class ChatIconsTile extends StatelessWidget {
  const ChatIconsTile({
    super.key,
    required this.icon,
    required this.color,
    this.size = 40,
  });
  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(size * 0.14),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: size * 0.62, color: const Color(0xFFFFFFFF)),
    );
  }
}
