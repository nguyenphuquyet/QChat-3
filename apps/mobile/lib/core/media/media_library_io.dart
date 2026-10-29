import 'dart:typed_data';

import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:photo_manager/photo_manager.dart';

import 'media_library.dart';

/// The real photo library, read through `photo_manager`.
///
/// The plugin only lists albums and decodes thumbnails; every pixel the picker
/// paints is QChat's own, so the sheet never inherits a third-party design
/// language (and, being a plugin rather than a widget package, it brings no
/// Material along).
class DeviceMediaLibrary implements MediaLibrary {
  DeviceMediaLibrary({required this.imagesOnly});

  /// Whether videos belong in the sheet at all.
  final bool imagesOnly;

  final _paths = <String, AssetPathEntity>{};
  final _entities = <String, AssetEntity>{};

  RequestType get _type => imagesOnly ? RequestType.image : RequestType.common;

  FilterOptionGroup get _filter => FilterOptionGroup(
    orders: [OrderOption(type: OrderOptionType.createDate, asc: false)],
  );

  @override
  Future<MediaAccess> requestAccess() async {
    final state = await PhotoManager.requestPermissionExtend();
    if (state.isLimited) return MediaAccess.limited;
    return state.hasAccess ? MediaAccess.full : MediaAccess.denied;
  }

  @override
  Future<List<MediaAlbum>> albums() async {
    final paths = await PhotoManager.getAssetPathList(
      type: _type,
      filterOption: _filter,
      hasAll: true,
    );
    final albums = <MediaAlbum>[];
    for (final path in paths) {
      _paths[path.id] = path;
      albums.add(
        MediaAlbum(
          id: path.id,
          name: path.name,
          count: await path.assetCountAsync,
          isRecent: path.isAll,
        ),
      );
    }
    return albums;
  }

  @override
  Future<List<MediaAsset>> assets(
    MediaAlbum album, {
    required int page,
    int size = 100,
  }) async {
    final path = _paths[album.id];
    if (path == null) return const [];
    final entities = await path.getAssetListPaged(page: page, size: size);
    final assets = <MediaAsset>[];
    for (final entity in entities) {
      _entities[entity.id] = entity;
      assets.add(
        MediaAsset(
          id: entity.id,
          isVideo: entity.type == AssetType.video,
          duration: entity.videoDuration,
        ),
      );
    }
    return assets;
  }

  @override
  Future<Uint8List?> thumbnail(MediaAsset asset, {required int size}) {
    final entity = _entities[asset.id];
    if (entity == null) return Future.value(null);
    return entity.thumbnailDataWithSize(
      ThumbnailSize.square(size),
      quality: 85,
    );
  }

  @override
  Future<XFile> file(MediaAsset asset) async {
    final entity = _entities[asset.id] ?? await AssetEntity.fromId(asset.id);
    if (entity == null) throw StateError('mediaUnavailable');
    final file = await entity.file ?? await entity.originFile;
    if (file == null) throw StateError('mediaUnavailable');
    if (p.extension(file.path).isNotEmpty) return XFile(file.path);
    // On every platform but the web, `XFile.name` is the basename of the path,
    // and the upload keys off its extension: a bare cache file has to be given
    // a name, not merely described with one. `entity.file` yields a JPEG copy
    // where the library holds HEIC, so the extension always matches the bytes.
    final mime = entity.mimeType ?? await entity.mimeTypeAsync;
    final extension =
        _extensionOf(mime) ?? (entity.type == AssetType.video ? 'mp4' : 'jpg');
    final id = entity.id.replaceAll(RegExp('[^A-Za-z0-9]'), '_');
    final copy = await file.copy(
      p.join(Directory.systemTemp.path, 'qchat-$id.$extension'),
    );
    return XFile(copy.path, mimeType: mime);
  }

  @override
  Future<void> openSettings() => PhotoManager.openSetting();

  @override
  Future<void> widenAccess() => PhotoManager.presentLimited();
}

String? _extensionOf(String? mime) => switch (mime?.toLowerCase()) {
  'image/jpeg' => 'jpg',
  'image/png' => 'png',
  'image/gif' => 'gif',
  'image/webp' => 'webp',
  'image/heic' => 'heic',
  'video/mp4' => 'mp4',
  'video/quicktime' => 'mov',
  _ => null,
};
