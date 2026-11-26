import 'package:flutter/widgets.dart';

import '../localization/strings.dart';

/// Album names the system hands over in its own language, keyed by their
/// lower-case form. iOS names its albums in the device language rather than the
/// app's, so a phone running English would otherwise show "Favorites" inside a
/// Vietnamese picker.
const _kAlbumKeys = <String, String>{
  'recents': 'recentMedia',
  'recent': 'recentMedia',
  'all photos': 'albumAll',
  '所有照片': 'albumAll',
  'favorites': 'albumFavorites',
  'favourites': 'albumFavorites',
  '收藏': 'albumFavorites',
  '个人收藏': 'albumFavorites',
  'videos': 'albumVideos',
  'video': 'albumVideos',
  '视频': 'albumVideos',
  'selfies': 'albumSelfies',
  '自拍': 'albumSelfies',
  'live photos': 'albumLivePhotos',
  '实况照片': 'albumLivePhotos',
  'portrait': 'albumPortrait',
  'portraits': 'albumPortrait',
  '人像': 'albumPortrait',
  'long exposure': 'albumLongExposure',
  '长曝光': 'albumLongExposure',
  'spatial': 'albumSpatial',
  '空间照片': 'albumSpatial',
  'screenshots': 'albumScreenshots',
  'screenshot': 'albumScreenshots',
  '截屏': 'albumScreenshots',
  'screen recordings': 'albumScreenRecordings',
  '屏幕录制': 'albumScreenRecordings',
  'camera': 'albumCamera',
  'camera roll': 'albumCamera',
  '相机': 'albumCamera',
};

/// The picker's label for a device album. Unknown albums keep the name the
/// system gave them, because inventing one would be worse than a foreign word.
String mediaAlbumName(BuildContext context, String name) {
  final key = _kAlbumKeys[name.trim().toLowerCase()];
  return key == null ? name : tr(context, key);
}
