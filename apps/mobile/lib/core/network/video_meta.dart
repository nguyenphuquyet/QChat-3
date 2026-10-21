import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../storage/database.dart';

/// Intrinsic video geometry, resolved before the player finishes loading so
/// the chat preview keeps the real video shape instead of a portrait guess.
class VideoMeta {
  const VideoMeta({required this.width, required this.height, this.duration});

  final int width;
  final int height;
  final Duration? duration;

  bool get isValid => width > 0 && height > 0;

  double get aspectRatio => isValid ? width / height : 9 / 16;

  Map<String, dynamic> toJson() => {
    'width': width,
    'height': height,
    if (duration != null) 'duration': duration!.inMilliseconds,
  };

  static VideoMeta? fromJson(dynamic value) {
    if (value is! Map) return null;
    final width = (value['width'] as num?)?.round() ?? 0;
    final height = (value['height'] as num?)?.round() ?? 0;
    if (width <= 0 || height <= 0) return null;
    final millis = (value['duration'] as num?)?.round() ?? 0;
    return VideoMeta(
      width: width,
      height: height,
      duration: millis > 0 ? Duration(milliseconds: millis) : null,
    );
  }
}

/// Keeps known video geometry in memory and in the account's local database,
/// mirroring how [MediaCache] persists image bytes.
class VideoMetaCache {
  static final Map<String, VideoMeta> _memory = {};

  static VideoMeta? fromMemory(String id) => _memory[id];

  static Future<VideoMeta?> load(LocalDatabase? local, String id) async {
    final memory = _memory[id];
    if (memory != null) return memory;
    if (id.isEmpty || local == null) return null;
    try {
      final meta = VideoMeta.fromJson(await local.read('video_meta:$id'));
      if (meta != null) _memory[id] = meta;
      return meta;
    } catch (_) {
      return null;
    }
  }

  static void remember(String id, VideoMeta meta, {LocalDatabase? local}) {
    if (id.isEmpty || !meta.isValid) return;
    _memory[id] = meta;
    if (local != null) {
      unawaited(
        local.cache('video_meta:$id', meta.toJson()).catchError((_) {}),
      );
    }
  }

  static void clear() => _memory.clear();
}

const _probeWindow = 512 * 1024;

/// Reads the MP4 header without downloading the whole clip.
///
/// The `moov` atom sits either at the start (fast-start files) or at the end
/// (most phone recordings), so a small prefix and suffix are inspected. Bytes
/// are optional: a server that ignores `Range` simply returns the whole file.
Future<VideoMeta?> probeVideoMeta(Dio dio, String url, {int? size}) async {
  if (url.isEmpty) return null;
  final prefix = await _readRange(dio, url, 0, _probeWindow - 1);
  var meta = prefix == null ? null : parseMp4Meta(prefix);
  if (meta != null) return meta;
  if (size == null || size <= _probeWindow) return null;
  final suffix = await _readRange(dio, url, size - _probeWindow, size - 1);
  meta = suffix == null ? null : parseMp4Meta(suffix);
  return meta;
}

Future<Uint8List?> _readRange(Dio dio, String url, int start, int end) async {
  try {
    final response = await dio.get<List<int>>(
      url,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {'Range': 'bytes=$start-$end'},
        validateStatus: (status) => status == 200 || status == 206,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 15),
      ),
    );
    final data = response.data;
    return data == null || data.isEmpty ? null : Uint8List.fromList(data);
  } catch (_) {
    return null;
  }
}

/// Extracts width, height and duration from raw MP4 bytes.
///
/// `tkhd` carries the presentation size (16.16 fixed point) and `mvhd` the
/// movie timescale, so both markers are located directly: the boxes can start
/// before the inspected window, which makes a strict from-zero walk fragile.
VideoMeta? parseMp4Meta(Uint8List bytes) {
  ({int width, int height})? size;
  for (
    var at = _marker(bytes, 'tkhd');
    at >= 0;
    at = _marker(bytes, 'tkhd', at + 4)
  ) {
    final found = _tkhdSize(bytes, at);
    if (found != null) {
      size = found;
      break;
    }
  }
  if (size == null) return null;
  final ratio = size.width / size.height;
  if (ratio < 0.05 || ratio > 20) return null;
  return VideoMeta(
    width: size.width,
    height: size.height,
    duration: _mvhdDuration(bytes),
  );
}

({int width, int height})? _tkhdSize(Uint8List bytes, int marker) {
  if (marker + 8 > bytes.length) return null;
  final version = bytes[marker + 4];
  if (version != 0 && version != 1) return null;
  final fields = marker + 8;
  final widthAt = fields + (version == 1 ? 84 : 72);
  final heightAt = widthAt + 4;
  if (heightAt + 4 > bytes.length) return null;
  final data = ByteData.sublistView(bytes);
  final width = (data.getUint32(widthAt) / 65536).round();
  final height = (data.getUint32(heightAt) / 65536).round();
  if (width < 16 || height < 16 || width > 10000 || height > 10000) {
    return null;
  }
  return (width: width, height: height);
}

Duration? _mvhdDuration(Uint8List bytes) {
  final marker = _marker(bytes, 'mvhd');
  if (marker < 0 || marker + 8 > bytes.length) return null;
  final version = bytes[marker + 4];
  if (version != 0 && version != 1) return null;
  final fields = marker + 8;
  final timescaleAt = fields + (version == 1 ? 16 : 8);
  final durationAt = timescaleAt + 4;
  final end = durationAt + (version == 1 ? 8 : 4);
  if (end > bytes.length) return null;
  final data = ByteData.sublistView(bytes);
  final timescale = data.getUint32(timescaleAt);
  if (timescale == 0) return null;
  final duration = version == 1
      ? data.getUint64(durationAt)
      : data.getUint32(durationAt);
  if (duration <= 0) return null;
  return Duration(milliseconds: (duration * 1000 / timescale).round());
}

int _marker(Uint8List bytes, String name, [int from = 0]) {
  final target = name.codeUnits;
  final last = bytes.length - target.length;
  for (var i = from; i <= last; i++) {
    if (bytes[i] != target[0]) continue;
    var match = true;
    for (var j = 1; j < target.length; j++) {
      if (bytes[i + j] != target[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
