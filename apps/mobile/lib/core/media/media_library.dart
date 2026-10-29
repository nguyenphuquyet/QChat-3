import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

/// How much of the device's photo library the user has let the app read.
enum MediaAccess {
  /// Every photo and video in the library.
  full,

  /// Only the items the user picked for QChat; the picker offers "All photos"
  /// to widen it, exactly as the OS does.
  limited,

  /// Nothing. The picker explains this and offers the Settings app.
  denied,
}

/// One album of the device library, including the synthetic "recent" album the
/// OS keeps over every asset.
class MediaAlbum {
  const MediaAlbum({
    required this.id,
    required this.name,
    required this.count,
    this.isRecent = false,
  });

  final String id;
  final String name;
  final int count;

  /// Whether this is the all-assets album rather than one of the user's own.
  final bool isRecent;
}

/// A photo or a video in the library, described without its pixels: the grid
/// asks for a thumbnail, and only a confirmed selection asks for the file.
class MediaAsset {
  const MediaAsset({
    required this.id,
    required this.isVideo,
    this.duration = Duration.zero,
  });

  final String id;
  final bool isVideo;
  final Duration duration;
}

/// The device's own photo library behind an interface, so the picker's page can
/// be tested without a platform channel and without a photo library.
abstract class MediaLibrary {
  /// Asks the OS for access and reports what was granted.
  Future<MediaAccess> requestAccess();

  /// Every album, recent first. Empty when the library has nothing in it.
  Future<List<MediaAlbum>> albums();

  /// One page of [album], newest first.
  Future<List<MediaAsset>> assets(
    MediaAlbum album, {
    required int page,
    int size = 100,
  });

  /// A decoded thumbnail of [asset], [size] pixels on its longest edge.
  Future<Uint8List?> thumbnail(MediaAsset asset, {required int size});

  /// The file to upload for [asset]. Downloads it from iCloud when the asset
  /// only lives there.
  Future<XFile> file(MediaAsset asset);

  /// Opens the OS settings so the user can grant access by hand.
  Future<void> openSettings();

  /// Widens a limited selection; a no-op where the OS has no such concept.
  Future<void> widenAccess();
}
