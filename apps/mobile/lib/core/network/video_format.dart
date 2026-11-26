import 'dart:convert';
import 'dart:typed_data';

/// The container a clip's bytes really are, read from the file header.
///
/// A picker reports the name a file had on disk, which is not always the
/// container it holds, and the player needs both a temporary file extension and
/// a MIME type. Sniffing the header means a designer can pick any video the
/// platform offers instead of being pushed into one format.
class VideoClipFormat {
  const VideoClipFormat(this.extension, this.mime);

  /// Extension for the decoded temporary file.
  final String extension;

  /// MIME type of the container, used for the browser's blob.
  final String mime;

  static const fallback = VideoClipFormat('mp4', 'video/mp4');

  /// Detects MP4/QuickTime, Matroska/WebM, AVI and 3GP containers.
  factory VideoClipFormat.sniff(Uint8List bytes) {
    bool ascii(int at, String text) {
      if (bytes.length < at + text.length) return false;
      for (var index = 0; index < text.length; index++) {
        if (bytes[at + index] != text.codeUnitAt(index)) return false;
      }
      return true;
    }

    if (ascii(0, 'RIFF') && ascii(8, 'AVI ')) {
      return const VideoClipFormat('avi', 'video/x-msvideo');
    }
    // EBML, used by both WebM and the older Matroska container.
    if (bytes.length >= 4 &&
        bytes[0] == 0x1a &&
        bytes[1] == 0x45 &&
        bytes[2] == 0xdf &&
        bytes[3] == 0xa3) {
      final head = latin1.decode(
        bytes.sublist(0, bytes.length < 64 ? bytes.length : 64),
      );
      return head.contains('webm')
          ? const VideoClipFormat('webm', 'video/webm')
          : const VideoClipFormat('mkv', 'video/x-matroska');
    }
    if (ascii(4, 'ftyp')) {
      if (ascii(8, 'qt  ')) {
        return const VideoClipFormat('mov', 'video/quicktime');
      }
      if (ascii(8, '3gp')) {
        return const VideoClipFormat('3gp', 'video/3gpp');
      }
      if (ascii(8, 'M4V')) {
        return const VideoClipFormat('m4v', 'video/x-m4v');
      }
      return fallback;
    }
    return fallback;
  }
}
