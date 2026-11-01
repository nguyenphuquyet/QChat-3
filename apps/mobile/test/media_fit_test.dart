import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:qchat/core/media/media_fit.dart';

Uint8List png([int side = 8]) =>
    img.encodePng(img.Image(width: side, height: side, numChannels: 4));

Uint8List jpeg([int side = 8]) =>
    img.encodeJpg(img.Image(width: side, height: side, numChannels: 3));

void main() {
  test('the format comes from the bytes, not from the file name', () {
    expect(imageMimeFromBytes(png()), 'image/png');
    expect(imageMimeFromBytes(jpeg()), 'image/jpeg');
    expect(imageMimeFromBytes(img.encodeGif(img.Image(width: 8, height: 8))), 'image/gif');
    // A HEIC starts with a box header, which QChat does not store as-is.
    expect(
      imageMimeFromBytes(Uint8List.fromList([0, 0, 0, 0x18, 0x66, 0x74, 0x79])),
      isNull,
    );
  });

  test('a mime maps to the extension an upload is named with', () {
    expect(imageExtension('image/png'), 'png');
    expect(imageExtension('image/gif'), 'gif');
    expect(imageExtension('image/webp'), 'webp');
    expect(imageExtension('image/jpeg'), 'jpg');
  });

  testWidgets('a PNG named like a JPEG is declared a PNG', (tester) async {
    final bytes = png();
    final file = XFile.fromData(bytes, name: 'screenshot.jpg');
    final fitted = await tester.runAsync(
      () => fitImageFile(
        file,
        const MediaFit(width: 1600, height: 1600, quality: .9),
      ),
    );

    expect(fitted!.mimeType, 'image/png');
  });

  testWidgets('a JPEG with no mime of its own is declared a JPEG', (
    tester,
  ) async {
    final bytes = jpeg();
    final fitted = await tester.runAsync(
      () => fitImageFile(
        XFile.fromData(bytes, name: 'photo'),
        const MediaFit(width: 1600, height: 1600, quality: .9),
      ),
    );

    expect(fitted!.mimeType, 'image/jpeg');
  });

  testWidgets('a picture over the fit comes back as a PNG', (tester) async {
    final bytes = jpeg(16);
    final fitted = await tester.runAsync(
      () => fitImageFile(
        XFile.fromData(bytes, mimeType: 'image/jpeg', name: 'photo.jpg'),
        const MediaFit(width: 8, height: 8, quality: .9),
      ),
    );

    expect(fitted!.mimeType, 'image/png');
  });
}
