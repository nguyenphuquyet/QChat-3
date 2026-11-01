import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:qchat/features/stickers/emoji_text.dart';
import 'package:qchat/features/stickers/sticker_background.dart';
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

/// A tiny monochrome WBMP: one square on a field. Only Flutter's decoder reads
/// the format, which is what the re-encode fallback is for.
Uint8List wbmp(int side) {
  final rowBytes = (side + 7) ~/ 8;
  final bytes = <int>[0, 0];
  // WBMP sizes are seven bits per byte, the top bit meaning "more to come".
  void put(int value) {
    final parts = <int>[];
    do {
      parts.insert(0, value & 0x7f);
      value >>= 7;
    } while (value > 0);
    for (var i = 0; i < parts.length - 1; i++) {
      parts[i] |= 0x80;
    }
    bytes.addAll(parts);
  }

  put(side);
  put(side);
  for (var y = 0; y < side; y++) {
    for (var b = 0; b < rowBytes; b++) {
      var value = 0;
      for (var bit = 0; bit < 8; bit++) {
        final x = b * 8 + bit;
        if (x >= side) continue;
        final inside =
            x > side * .2 && x < side * .8 && y > side * .2 && y < side * .8;
        if (inside) value |= 0x80 >> bit;
      }
      bytes.add(value);
    }
  }
  return Uint8List.fromList(bytes);
}

void main() {
  test('splits one sheet into square drawings', () async {
    final source = img.encodePng(sheet());
    final stickers = await extractStickers(source);

    expect(stickers, hasLength(2));
    for (final sticker in stickers) {
      expect(sticker.animated, isFalse);
      expect(sticker.width, sticker.height);
      final artwork = img.decodePng(sticker.bytes);
      expect(artwork, isNotNull);
      // Each crop is the drawing plus a small margin, never the whole sheet.
      expect(artwork!.width, lessThan(100));
      expect(artwork.height, artwork.width);
    }
    // The opaque sheet stays opaque unless background removal is requested.
    final first = img.decodePng(stickers.first.bytes)!;
    expect(first.getPixel(0, 0).a, 255);
  });

  test('crops a plain picture to a square', () async {
    final stickers = await extractStickers(
      img.encodePng(sheet()),
      split: false,
    );
    expect(stickers, hasLength(1));
    final artwork = img.decodePng(stickers.single.bytes)!;
    // 240x120 becomes the centred 120x120 square.
    expect(artwork.width, 120);
    expect(artwork.height, 120);
    expect(stickers.single.width, 120);
    expect(stickers.single.height, 120);
  });

  test('a tall drawing keeps its outline on a transparent square', () async {
    final tall = img.Image(width: 120, height: 240, numChannels: 4);
    img.fill(tall, color: img.ColorRgba8(255, 255, 255, 255));
    img.fillRect(
      tall,
      x1: 50,
      y1: 20,
      x2: 69,
      y2: 219,
      color: img.ColorRgba8(220, 40, 40, 255),
    );

    final stickers = await extractStickers(
      img.encodePng(tall),
      split: false,
      removeBackground: true,
    );
    final artwork = img.decodePng(stickers.single.bytes)!;
    expect(artwork.width, artwork.height);
    // The 200 px drawing is kept whole: the square pads the sides instead of
    // cropping the top and bottom off. It is cropped to the drawing, though, not
    // left on the 240 px canvas.
    expect(artwork.height, inInclusiveRange(200, 235));
    // The padded bands are transparent, not white.
    expect(artwork.getPixel(0, 0).a, 0);
    expect(
      artwork.getPixel(artwork.width ~/ 2, artwork.height ~/ 2).r,
      greaterThan(180),
    );
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
    expect(artwork.width, artwork.height);
    expect(artwork.getPixel(0, 0).a, 0);
    // The red square is untouched by the flood from the border and sits in the
    // middle of the transparent square.
    final centre = artwork.getPixel(50, artwork.height ~/ 2);
    expect(centre.a, 255);
    expect(centre.r, greaterThan(180));
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

  test('a GIF with one frame is a PNG, not a mislabelled GIF', () async {
    final stickers = await extractStickers(img.encodeGif(sheet()));

    expect(stickers, isNotEmpty);
    for (final sticker in stickers) {
      // The encoder writes a PNG for a single frame, so the artwork must be
      // declared a PNG: the server compares the declared mime with the bytes.
      expect(sticker.animated, isFalse);
      expect(sticker.mime, 'image/png');
      expect(sticker.bytes.take(4), [0x89, 0x50, 0x4e, 0x47]);
    }
  });

  test('a stroke that joins two drawings does not break the split', () async {
    // Two drawings and a stroke between them: the stroke's padded box claims
    // both, so the merge has to fold three boxes into one while it walks the
    // list. Joining them by editing the list mid-walk used to throw.
    final image = img.Image(width: 900, height: 900, numChannels: 4);
    img.fill(image, color: img.ColorRgba8(255, 255, 255, 255));
    final ink = img.ColorRgba8(20, 20, 20, 255);
    img.fillRect(image, x1: 60, y1: 60, x2: 140, y2: 140, color: ink);
    img.fillRect(image, x1: 280, y1: 60, x2: 360, y2: 140, color: ink);
    // Close enough to both to be joined by the drawer's margin, far enough
    // apart that the pixels never touch: three drawings, one sticker.
    img.fillRect(image, x1: 180, y1: 100, x2: 240, y2: 130, color: ink);

    final stickers = await extractStickers(img.encodePng(image));

    expect(stickers, hasLength(1));
    // One drawing, not the whole sheet: the fallback would hand back the 900 px
    // sheet squared to 512.
    expect(stickers.single.width, lessThan(450));
  });

  test('a picture that yields no drawing becomes the whole picture', () async {
    // A plain photo with the switches on: nothing stands out from the border,
    // so there is no drawing to cut. It is still a sticker.
    final stickers = await extractStickers(
      img.encodePng(sheet()),
      removeBackground: true,
    );

    expect(stickers, isNotEmpty);
  });

  test('the model keeps a hole its border cannot reach', () {
    // A ring of subject with a hollow centre. The segmenter called the centre
    // background — deliberately, to be sure the reach decides, not the model.
    const side = 9;
    final alpha = Uint8List(side * side);
    for (var y = 2; y <= 6; y++) {
      for (var x = 2; x <= 6; x++) {
        if (x == 2 || x == 6 || y == 2 || y == 6) alpha[y * side + x] = 255;
      }
    }

    final outside = outsideMask(alpha, side, side);

    expect(outside[0], 1, reason: 'the picture border is background');
    expect(outside[2 * side + 2], 0, reason: 'the ring is the subject');
    expect(outside[4 * side + 4], 0, reason: 'the enclosed hole stays');
  });

  test(
    'a model cut is cropped tightly to a square around the subject',
    () async {
      // What the segmenter hands back: the subject, and transparent everywhere
      // the background used to be. The canvas is far wider than the subject, and
      // keeping the canvas would leave a sticker floating in empty space.
      final cut = img.Image(width: 200, height: 140, numChannels: 4);
      img.fill(cut, color: img.ColorRgba8(0, 0, 0, 0));
      img.fillRect(
        cut,
        x1: 80,
        y1: 40,
        x2: 159,
        y2: 99,
        color: img.ColorRgba8(220, 40, 40, 255),
      );
      final png = img.encodePng(cut);
      debugStickerCutter = (_) async => png;
      addTearDown(() => debugStickerCutter = null);

      final stickers = await extractStickers(
        png,
        split: false,
        removeBackground: true,
      );

      expect(stickers, hasLength(1));
      final sticker = stickers.single;
      expect(sticker.width, sticker.height);
      // The 80x60 subject plus its margin, not the 200x140 canvas.
      expect(sticker.width, lessThan(140));
      expect(sticker.width, greaterThan(60));
      final artwork = img.decodePng(sticker.bytes)!;
      expect(artwork.getPixel(0, 0).a, 0);
      final centre = artwork.getPixel(artwork.width ~/ 2, artwork.height ~/ 2);
      expect(centre.a, 255);
      expect(centre.r, greaterThan(180));
    },
  );

  test('a picture only Flutter can read is re-encoded and cut', () async {
    // A WBMP: Flutter's decoder shows it (that is how the studio's preview
    // draws the picked file), while the `image` package has no decoder for it
    // and reports no picture at all.
    final bytes = wbmp(160);
    expect(img.decodeImage(bytes), isNull);

    final stickers = await extractStickers(bytes);

    expect(stickers, hasLength(1));
    final artwork = img.decodePng(stickers.single.bytes);
    expect(artwork, isNotNull);
    expect(artwork!.width, artwork.height);
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

  testWidgets('a keyboard emoji is drawn in the artwork\'s square', (
    tester,
  ) async {
    for (final emoji in ['😎', '👨‍👩‍👧', '👍🏽', '🕺', '1️⃣']) {
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: QChatEmojiText(emoji, size: 20),
        ),
      );
      expect(
        tester.getSize(
          find.descendant(
            of: find.byType(QChatEmojiText),
            matching: find.byType(SizedBox),
          ),
        ),
        const Size(20, 20),
        reason: emoji,
      );
    }
  });

  testWidgets('the composer paints a finished code as its picture', (
    tester,
  ) async {
    late BuildContext context;
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: Builder(
          builder: (c) {
            context = c;
            return const SizedBox();
          },
        ),
      ),
    );

    late TextSpan span;

    TextSpan spansFor(String text) {
      final controller = EmojiTextEditingController(text: text);
      final built = controller.buildTextSpan(
        context: context,
        style: const TextStyle(fontSize: 16),
        withComposing: false,
      );
      // The drawn text keeps the length of the controller's text, so a caret
      // offset means the same thing before and after the picture replaced it.
      expect(built.toPlainText().length, text.length, reason: text);
      return built;
    }

    span = spansFor('chào [微笑] bạn');
    expect(
      span.children!.whereType<WidgetSpan>(),
      hasLength(1),
      reason: 'a finished code is one picture',
    );

    // A half-typed code is still text, so it can be finished by hand.
    expect(spansFor('[微笑').children!.whereType<WidgetSpan>(), isEmpty);
    expect(spansFor('[không có]').children!.whereType<WidgetSpan>(), isEmpty);
  });
}
