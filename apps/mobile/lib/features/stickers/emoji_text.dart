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
///
/// Emoji typed on the system keyboard are boxes too: they are drawn at [size]
/// like the bundled artwork, so a message looks the same whichever emoji the
/// user picked.
List<InlineSpan> emojiSpans(String text, {double size = 20}) {
  final spans = <InlineSpan>[];
  var cursor = 0;

  void addText(int start, int end) {
    if (end <= start) return;
    final run = text.substring(start, end);
    var at = 0;
    for (final match in systemEmoji.allMatches(run)) {
      if (match.start > at) {
        spans.add(TextSpan(text: run.substring(at, match.start)));
      }
      spans.add(_emojiBox(match[0]!, size));
      at = match.end;
    }
    if (at < run.length) spans.add(TextSpan(text: run.substring(at)));
  }

  for (final match in weChatEmojiToken.allMatches(text)) {
    final emoji = wechatEmojiByCode[match.group(1)];
    if (emoji == null) continue;
    addText(cursor, match.start);
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
  addText(cursor, text.length);
  return spans.isEmpty ? [TextSpan(text: text)] : spans;
}

/// One platform emoji, drawn in the same square as a bundled picture.
///
/// The box is fixed so a system emoji cannot stretch the line: the same 20pt
/// square that holds a WeChat picture holds the font's glyph.
InlineSpan _emojiBox(String glyph, double size) => WidgetSpan(
  alignment: PlaceholderAlignment.middle,
  child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: 1),
    child: SizedBox.square(
      dimension: size,
      child: Center(
        child: Text(
          glyph,
          maxLines: 1,
          softWrap: false,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: size, height: 1),
        ),
      ),
    ),
  ),
);

/// Platform emoji, as one grapheme each: a flag is two regional indicators, a
/// skin tone and a zero-width joiner stay with the emoji they modify.
final RegExp systemEmoji = RegExp(
  r'(?:[\u{1F1E6}-\u{1F1FF}]{2})'
  r'|[0-9#*]\uFE0F?\u20E3'
  r'|[\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}'
  r'\u{1F780}-\u{1F7FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]'
  r'(?:\uFE0F|\u200D[\u{1F300}-\u{1FAFF}]|[\u{1F3FB}-\u{1F3FF}])*',
  unicode: true,
);

/// A one-line hint for a message preview: emoji codes become their picture name
/// instead of showing raw brackets.
String emojiPlainText(String text) => text.replaceAllMapped(
  weChatEmojiToken,
  (match) => wechatEmojiByCode[match.group(1)] == null ? match[0]! : match[1]!,
);
