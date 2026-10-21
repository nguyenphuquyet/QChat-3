import 'package:video_player/video_player.dart';

VideoPlayerController previewVideoController(String path) =>
    VideoPlayerController.networkUrl(Uri.parse(path));
