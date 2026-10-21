import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/core/network/video_meta.dart';

/// Builds the smallest useful MP4 header: an `mvhd` movie header followed by a
/// `tkhd` track header carrying the 16.16 fixed-point presentation size.
Uint8List header({
  required int width,
  required int height,
  int version = 0,
  int timescale = 1000,
  int duration = 4200,
}) {
  final bytes = Uint8List(512);
  final data = ByteData.sublistView(bytes);

  bytes.setRange(0, 4, 'mvhd'.codeUnits);
  bytes[4] = version;
  final mvhd = 8;
  if (version == 1) {
    data.setUint32(mvhd + 16, timescale);
    data.setUint64(mvhd + 20, duration);
  } else {
    data.setUint32(mvhd + 8, timescale);
    data.setUint32(mvhd + 12, duration);
  }

  bytes.setRange(100, 104, 'tkhd'.codeUnits);
  bytes[104] = version;
  final tkhd = 108;
  final widthAt = tkhd + (version == 1 ? 84 : 72);
  data.setUint32(widthAt, width << 16);
  data.setUint32(widthAt + 4, height << 16);
  return bytes;
}

void main() {
  test('reads landscape geometry and duration from an MP4 header', () {
    final meta = parseMp4Meta(header(width: 1920, height: 1080));

    expect(meta, isNotNull);
    expect(meta!.width, 1920);
    expect(meta.height, 1080);
    expect(meta.aspectRatio, closeTo(16 / 9, 0.001));
    expect(meta.duration, const Duration(milliseconds: 4200));
  });

  test('reads portrait geometry from a version 1 track header', () {
    final meta = parseMp4Meta(
      header(width: 1080, height: 1920, version: 1, duration: 1500),
    );

    expect(meta, isNotNull);
    expect(meta!.width, 1080);
    expect(meta.height, 1920);
    expect(meta.aspectRatio, lessThan(1));
    expect(meta.duration, const Duration(milliseconds: 1500));
  });

  test('ignores headers without a usable video size', () {
    expect(parseMp4Meta(Uint8List(0)), isNull);
    expect(parseMp4Meta(Uint8List(512)), isNull);
    expect(parseMp4Meta(header(width: 0, height: 0)), isNull);
  });

  test('restores cached geometry from stored JSON', () {
    final restored = VideoMeta.fromJson({
      'width': 1280,
      'height': 720,
      'duration': 9000,
    });

    expect(restored, isNotNull);
    expect(restored!.aspectRatio, closeTo(16 / 9, 0.001));
    expect(restored.duration, const Duration(seconds: 9));
    expect(VideoMeta.fromJson({'width': 0, 'height': 720}), isNull);
  });
}
