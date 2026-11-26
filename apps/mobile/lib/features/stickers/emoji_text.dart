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
    addPlatformEmoji(spans, text.substring(start, end), size);
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

/// One platform emoji, drawn as text at the size of a bundled picture.
///
/// It stays a text run instead of a box of its own: every emoji on the line
/// then shares that line's baseline, so a pair such as `😁😂` sits level even
/// when the platform draws each glyph from a different fallback font. A box
/// per emoji would give each glyph its own baseline and they would drift apart.
InlineSpan _emojiRun(String glyph, double size) =>
    TextSpan(text: glyph, style: TextStyle(fontSize: size, height: 1));

/// Splits [run] so every platform emoji in it is drawn at [size] and the rest
/// stays as it was typed.
void addPlatformEmoji(List<InlineSpan> spans, String run, double size) {
  var at = 0;
  for (final match in systemEmoji.allMatches(run)) {
    if (match.start > at) {
      spans.add(TextSpan(text: run.substring(at, match.start)));
    }
    spans.add(_emojiRun(match[0]!, size));
    at = match.end;
  }
  if (at < run.length) spans.add(TextSpan(text: run.substring(at)));
}

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

/// The composer's controller: it paints a finished code such as `[微笑]` as the
/// emoji picture, the way the reference app shows emotion inside the input box.
///
/// The controller's text keeps the code, because that is what a message sends.
/// Only the drawing changes: the picture replaces the code and the rest of it
/// stays as zero-width characters, so every caret offset still lines up with
/// [TextEditingController.text] and sending needs no decoding.
class EmojiTextEditingController extends TextEditingController {
  EmojiTextEditingController({super.text});

  /// Drawn height of an emoji in the field.
  static const double pictureSize = 20;

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    // An input method owns the spans while it composes, so its underline and
    // candidate state stay visible.
    if (value.composing.isValid && !value.composing.isCollapsed) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }
    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final match in weChatEmojiToken.allMatches(text)) {
      final emoji = wechatEmojiByCode[match.group(1)];
      if (emoji == null) continue;
      if (match.start > cursor) {
        addPlatformEmoji(
          spans,
          text.substring(cursor, match.start),
          pictureSize,
        );
      }
      spans.add(
        WidgetSpan(
          alignment: PlaceholderAlignment.middle,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: Image.asset(
              emoji.asset,
              width: pictureSize,
              height: pictureSize,
              filterQuality: FilterQuality.medium,
              excludeFromSemantics: true,
            ),
          ),
        ),
      );
      // A placeholder is one character: the rest of the code is drawn as
      // nothing so the text keeps exactly the length the caret indexes into.
      spans.add(
        TextSpan(
          text: '\u200b' * (match.end - match.start - 1),
          style: const TextStyle(fontSize: 0),
        ),
      );
      cursor = match.end;
    }
    if (cursor < text.length) {
      addPlatformEmoji(spans, text.substring(cursor), pictureSize);
    }
    return TextSpan(style: style, children: spans);
  }
}
