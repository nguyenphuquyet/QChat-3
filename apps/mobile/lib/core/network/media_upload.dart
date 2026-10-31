import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/widgets.dart';
import '../design_system/media_widgets.dart';
import '../media/media_picker.dart';
import 'client.dart';

const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const momentExtensions = [...imageExtensions, 'mp4', 'mov'];
const maxMediaBytes = 25 * 1024 * 1024;

base class XFilePlatformFile extends PlatformFile {
  XFilePlatformFile(this._xFile, [this._bytes, this._length]);
  final XFile _xFile;
  final Uint8List? _bytes;
  final int? _length;

  @override
  String get name => _xFile.name;

  @override
  Uri get uri => Uri.parse(
    _xFile.path.startsWith('http') ||
            _xFile.path.startsWith('content:') ||
            _xFile.path.startsWith('file:')
        ? _xFile.path
        : 'file://${_xFile.path}',
  );

  @override
  String? get path => _xFile.path;

  @override
  XFile get xFile => _xFile;

  @override
  int? lengthSync() => _length ?? _bytes?.length;

  @override
  Future<int?> length() async =>
      _length ?? _bytes?.length ?? await _xFile.length();

  @override
  Future<Uint8List> readAsBytes() async => _bytes ?? await _xFile.readAsBytes();

  @override
  Stream<Uint8List> readAsByteStream() => _xFile.openRead();
}

Future<PlatformFile?> pickImageWithSource(BuildContext context) async {
  final files = await pickQChatMedia(context, imagesOnly: true, maxAssets: 1);
  return files.isEmpty ? null : XFilePlatformFile(files.first);
}

Future<List<PlatformFile>> pickMediaWithSource(
  BuildContext context, {
  int maxAssets = 9,
  String? confirmLabel,
}) async {
  final files = await pickQChatMedia(
    context,
    maxAssets: maxAssets,
    confirmLabel: confirmLabel,
  );
  return files.map(XFilePlatformFile.new).toList();
}

String? mediaMime(String? extension) => const {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
}[extension?.toLowerCase()];

Future<String> uploadMedia(QChatClient client, PlatformFile file) async {
  final mime = mediaMime(file.extension);
  if (mime == null) throw StateError('unsupportedMedia');
  if ((await file.length() ?? 0) > maxMediaBytes) {
    throw StateError('mediaTooLarge');
  }
  final bytes = await file.readAsBytes();
  if (bytes.isEmpty || bytes.length > maxMediaBytes) {
    throw StateError('mediaTooLarge');
  }
  final intent = await client.post('/media/upload-intent', {
    'name': file.name,
    'size': bytes.length,
    'mime': mime,
  });
  final uploader = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(minutes: 3),
      receiveTimeout: const Duration(seconds: 30),
    ),
  );
  try {
    await uploader.put(
      intent['url'],
      data: bytes,
      options: Options(headers: {'Content-Type': mime}),
    );
    await client.post('/media/complete', {'mediaId': intent['id']});
    final mediaId = intent['id'] as String;
    await MediaCache.rememberMedia(mediaId, bytes, mime, local: client.local);
    return mediaId;
  } finally {
    uploader.close();
  }
}
