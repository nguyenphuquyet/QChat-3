import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:qchat/features/stickers/emoji_text.dart';
import 'package:qchat/features/stickers/sticker_cutout.dart';
import 'package:qchat/features/stickers/wechat_emoji.dart';

/// A white sheet with a red square and a blue square, far enough apart that
/// they are two separate stickers.
img.Image sheet() {
  final image = img.Image(width: 240, height: 120, numChannels: 4);
  img.fill(image, color: img.ColorRgba8(255, 255, 255, 255));
  img.fillRect(
    image,
    x1: 20,
    y1: 30,
    x2: 79,
    y2: 89,
    color: img.ColorRgba8(220, 40, 40, 255),
  );
  img.fillRect(
    image,
    x1: 160,
    y1: 30,
    x2: 219,
    y2: 89,
    color: img.ColorRgba8(40, 80, 220, 255),
  );
  return image;
}

void main() {
  test('splits one sheet into the separate drawings', () async {
    final source = img.encodePng(sheet());
    final stickers = await extractStickers(source);

    expect(stickers, hasLength(2));
    for (final sticker in stickers) {
      expect(sticker.animated, isFalse);
      final artwork = img.decodePng(sticker.bytes);
      expect(artwork, isNotNull);
      // Each crop is the drawing plus a small margin, never the whole sheet.
      expect(artwork!.width, lessThan(100));
      expect(artwork.height, lessThan(100));
    }
    // The opaque sheet stays opaque unless background removal is requested.
    final first = img.decodePng(stickers.first.bytes)!;
    expect(first.getPixel(0, 0).a, 255);
  });

  test('keeps the whole picture when splitting is off', () async {
    final stickers = await extractStickers(
      img.encodePng(sheet()),
      split: false,
    );
    expect(stickers, hasLength(1));
    final artwork = img.decodePng(stickers.single.bytes)!;
    expect(artwork.width, 240);
    expect(artwork.height, 120);
  });

  test('background removal is opt-in and clears only the border', () async {
    final source = img.encodePng(sheet());
    final kept = await extractStickers(
      source,
      split: false,
      removeBackground: false,
    );
    expect(img.decodePng(kept.single.bytes)!.getPixel(0, 0).a, 255);

    final cut = await extractStickers(
      source,
      split: false,
      removeBackground: true,
    );
    final artwork = img.decodePng(cut.single.bytes)!;
    expect(artwork.getPixel(0, 0).a, 0);
    // The red square is untouched by the flood from the border.
    expect(artwork.getPixel(50, 60).a, 255);
    expect(artwork.getPixel(50, 60).r, greaterThan(180));
  });

  test('an animated GIF stays animated through a split', () async {
    final frames = img.Image(width: 200, height: 100, numChannels: 4);
    img.fill(frames, color: img.ColorRgba8(255, 255, 255, 255));
    img.fillCircle(
      frames,
      x: 60,
      y: 50,
      radius: 30,
      color: img.ColorRgba8(220, 40, 40, 255),
    );
    final second = img.Image.from(frames, noAnimation: true)
      ..frameDuration = 100;
    img.fillCircle(
      second,
      x: 60,
      y: 50,
      radius: 22,
      color: img.ColorRgba8(220, 40, 40, 255),
    );
    frames.frameDuration = 100;
    frames.addFrame(second);
    frames.frameType = img.FrameType.animation;

    final stickers = await extractStickers(img.encodeGif(frames));
    expect(stickers, isNotEmpty);
    expect(stickers.first.animated, isTrue);
    expect(stickers.first.mime, 'image/gif');
    final decoded = img.decodeGif(stickers.first.bytes);
    expect(decoded, isNotNull);
    expect(decoded!.frames.length, greaterThan(1));
  });

  test('every WeChat emoji code becomes an inline picture span', () {
    expect(wechatEmojiSet, hasLength(109));
    expect(wechatEmojiByCode['旺柴'], isNotNull);

    final spans = emojiSpans('chào [微笑] bạn [旺柴]', size: 20);
    expect(spans.whereType<WidgetSpan>(), hasLength(2));
    // Unknown brackets are not emoji: the text is left alone.
    expect(emojiSpans('[không tồn tại]'), hasLength(1));
    expect(emojiPlainText('[微笑] nhé'), '微笑 nhé');
  });
}
