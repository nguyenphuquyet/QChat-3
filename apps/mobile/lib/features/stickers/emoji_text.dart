import 'package:flutter/widgets.dart';

import 'wechat_emoji.dart';

/// Message text with WeChat emoji drawn inline.
///
/// A message carries the bracketed code (`[微笑]`), never the artwork. The
/// pictures are bundled with the app, so every client renders the same emoji
/// without an upload, even while the rest of the conversation is offline.
class QChatEmojiText extends StatelessWidget {
  const QChatEmojiText(
    this.text, {
    super.key,
    this.size = 20,
    this.style,
    this.maxLines,
    this.overflow,
  });

  final String text;

  /// Drawn height of an emoji; the line grows to fit it.
  final double size;
  final TextStyle? style;
  final int? maxLines;
  final TextOverflow? overflow;

  @override
  Widget build(BuildContext context) => Text.rich(
    TextSpan(children: emojiSpans(text, size: size)),
    style: style,
    maxLines: maxLines,
    overflow: overflow,
  );
}

/// Splits [text] into plain runs and emoji pictures. Unknown bracketed codes
/// stay as text, so a link or a tag is never swallowed by the pattern.
List<InlineSpan> emojiSpans(String text, {double size = 20}) {
  final spans = <InlineSpan>[];
  var cursor = 0;
  for (final match in weChatEmojiToken.allMatches(text)) {
    final emoji = wechatEmojiByCode[match.group(1)];
    if (emoji == null) continue;
    if (match.start > cursor) {
      spans.add(TextSpan(text: text.substring(cursor, match.start)));
    }
    spans.add(
      WidgetSpan(
        alignment: PlaceholderAlignment.middle,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1),
          child: Image.asset(
            emoji.asset,
            width: size,
            height: size,
            filterQuality: FilterQuality.medium,
            excludeFromSemantics: true,
          ),
        ),
      ),
    );
    cursor = match.end;
  }
  if (spans.isEmpty) return [TextSpan(text: text)];
  if (cursor < text.length) {
    spans.add(TextSpan(text: text.substring(cursor)));
  }
  return spans;
}

/// A one-line hint for a message preview: emoji codes become their picture name
/// instead of showing raw brackets.
String emojiPlainText(String text) => text.replaceAllMapped(
  weChatEmojiToken,
  (match) => wechatEmojiByCode[match.group(1)] == null ? match[0]! : match[1]!,
);
