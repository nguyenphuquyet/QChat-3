import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import '../../app/providers.dart';
import '../../core/network/client.dart';
import '../../core/storage/database.dart';
import '../network/video_meta.dart';
import 'components.dart';

class MediaCache {
  static final Map<String, Uint8List> _memory = {};
  static final Map<String, Future<Uint8List?>> _inFlight = {};
  static const int maxMemoryEntries = 250;
  static const int maxMemoryBytes = 64 * 1024 * 1024;
  static final Map<String, Map<String, dynamic>> _info = {};

  static Map<String, dynamic>? infoFromMemory(String id) => _info[id];

  static Future<Map<String, dynamic>?> info(
    QChatClient client,
    String id,
  ) async {
    if (_info.containsKey(id)) return _info[id];
    final stored = await client.local?.read('media_info:$id');
    if (stored is Map) return _info[id] = Map<String, dynamic>.from(stored);
    return null;
  }

  static Future<void> rememberMedia(
    String id,
    Uint8List bytes,
    String mime, {
    LocalDatabase? local,
  }) async {
    put(id, bytes);
    final details = <String, dynamic>{'mime': mime};
    try {
      if (mime.startsWith('image/')) {
        final codec = await ui.instantiateImageCodec(bytes);
        final frame = await codec.getNextFrame();
        details.addAll({
          'width': frame.image.width,
          'height': frame.image.height,
        });
        frame.image.dispose();
        codec.dispose();
      } else if (mime.startsWith('video/')) {
        final meta = parseMp4Meta(bytes);
        if (meta != null) {
          details.addAll(meta.toJson());
          VideoMetaCache.remember(id, meta, local: local);
        }
      }
    } catch (_) {}
    _info[id] = details;
    try {
      await local?.cache('media_bytes:$id', base64Encode(bytes));
      await local?.cache('media_info:$id', details);
    } catch (_) {}
  }

  static Uint8List? getFromMemory(String id) => _memory[id];

  static void put(String id, Uint8List bytes, {LocalDatabase? local}) {
    if (id.isEmpty || bytes.isEmpty) return;
    _memory.remove(id);
    while (_memory.isNotEmpty &&
        (_memory.length >= maxMemoryEntries ||
            _memory.values.fold<int>(0, (sum, item) => sum + item.length) +
                    bytes.length >
                maxMemoryBytes)) {
      _memory.remove(_memory.keys.first);
    }
    _memory[id] = bytes;
    if (local != null) {
      unawaited(
        local.cache('media_bytes:$id', base64Encode(bytes)).catchError((_) {}),
      );
    }
  }

  static void evict(String id, {LocalDatabase? local}) {
    _memory.remove(id);
    if (local != null) {
      unawaited(local.removeCache('media_bytes:$id').catchError((_) {}));
    }
  }

  static void clear() {
    _memory.clear();
    _inFlight.clear();
    _info.clear();
  }

  static Future<Uint8List?> load(QChatClient client, String id) {
    if (id.isEmpty) return Future.value(null);
    final inMem = _memory[id];
    if (inMem != null) return Future.value(inMem);

    final existing = _inFlight[id];
    if (existing != null) return existing;

    final future = _loadFromDiskOrNetwork(client, id);
    _inFlight[id] = future;
    return future.whenComplete(() => _inFlight.remove(id));
  }

  static Future<Uint8List?> _loadFromDiskOrNetwork(
    QChatClient client,
    String id,
  ) async {
    // 1. Check local database cache
    try {
      final disk = await client.local?.read('media_bytes:$id');
      if (disk is String && disk.isNotEmpty) {
        final bytes = base64Decode(disk);
        put(id, bytes);
        return bytes;
      }
    } catch (_) {}

    // 2. Load access URL and bytes from server
    try {
      final access = await client.get('/media/$id/access', cached: false);
      if (access is Map && access['url'] != null) {
        final url = access['url'].toString();
        final response = await client.dio.get<List<int>>(
          url,
          options: Options(
            responseType: ResponseType.bytes,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 20),
          ),
        );
        final data = response.data;
        if (data != null && data.isNotEmpty) {
          final bytes = Uint8List.fromList(data);
          await rememberMedia(
            id,
            bytes,
            access['mime']?.toString() ?? '',
            local: client.local,
          );
          return bytes;
        }
      }
    } catch (_) {}
    return null;
  }
}

class MediaImage extends ConsumerStatefulWidget {
  const MediaImage({
    super.key,
    required this.id,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.errorWidget,
  });
  final String id;
  final BoxFit fit;
  final Widget? placeholder;
  final Widget? errorWidget;

  @override
  ConsumerState<MediaImage> createState() => _MediaImageState();
}

class _MediaImageState extends ConsumerState<MediaImage> {
  Uint8List? _bytes;
  bool _error = false;
  int _revision = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MediaImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      _load();
    }
  }

  void _load() {
    final mem = MediaCache.getFromMemory(widget.id);
    if (mem != null) {
      _bytes = mem;
      _error = false;
      return;
    }

    _bytes = null;
    _error = false;
    final currentRev = ++_revision;
    final client = ref.read(clientProvider);

    MediaCache.load(client, widget.id)
        .then((bytes) {
          if (mounted && currentRev == _revision) {
            setState(() {
              _bytes = bytes;
              _error = bytes == null;
            });
          }
        })
        .catchError((_) {
          if (mounted && currentRev == _revision) {
            setState(() {
              _error = true;
            });
          }
        });
  }

  @override
  Widget build(BuildContext c) {
    if (_bytes != null) {
      return Image.memory(
        _bytes!,
        fit: widget.fit,
        gaplessPlayback: true,
        errorBuilder: (_, _, _) => _buildError(),
      );
    }
    if (_error) {
      return _buildError();
    }
    return widget.placeholder ??
        ColoredBox(
          color: qchatDark(c)
              ? const Color(0xff2a2a2a)
              : const Color(0xffededed),
        );
  }

  Widget _buildError() =>
      widget.errorWidget ??
      GestureDetector(
        onTap: () => setState(_load),
        child: const Center(
          child: QChatIcon('refresh', size: 20, color: QChatColors.muted),
        ),
      );
}

class UserAvatar extends StatelessWidget {
  const UserAvatar(
    this.user, {
    super.key,
    this.size = 48,
    this.openProfile = false,
  });
  final Map user;
  final double size;
  final bool openProfile;
  @override
  Widget build(BuildContext c) {
    final avatarId = user['avatarId']?.toString();
    final nickname = user['nickname']?.toString() ?? '';
    final fallback = QChatAvatar(nickname, size: size);

    final content = avatarId == null || avatarId.isEmpty
        ? fallback
        : SizedBox.square(
            dimension: size,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(5),
              child: MediaImage(
                id: avatarId,
                placeholder: fallback,
                errorWidget: fallback,
              ),
            ),
          );
    if (!openProfile || user['id'] == null) return content;
    return GestureDetector(
      onTap: () => c.push('/user/${user['id']}'),
      child: content,
    );
  }
}

class GroupAvatar extends StatelessWidget {
  const GroupAvatar(
    this.conversation, {
    super.key,
    this.size = 48,
    this.customAvatarId,
    this.onTap,
  });

  final Map conversation;
  final double size;
  final String? customAvatarId;
  final VoidCallback? onTap;

  String? getAvatarId() {
    if (customAvatarId != null && customAvatarId!.isNotEmpty) {
      return customAvatarId;
    }
    final rawAvatar = conversation['avatarId']?.toString();
    if (rawAvatar != null && rawAvatar.isNotEmpty) return rawAvatar;
    final ann = conversation['announcement']?.toString();
    if (ann != null && ann.startsWith('{')) {
      try {
        final map = jsonDecode(ann);
        if (map is Map && map['avatarId'] != null) {
          return map['avatarId'].toString();
        }
      } catch (_) {}
    }
    return null;
  }

  @override
  Widget build(BuildContext c) {
    final avatarId = getAvatarId();
    final borderRadius = BorderRadius.circular(size > 40 ? 6 : 4);

    Widget content;
    if (avatarId != null && avatarId.isNotEmpty) {
      final fallback = QChatAvatar(
        conversation['title']?.toString() ?? 'G',
        size: size,
      );
      content = SizedBox.square(
        dimension: size,
        child: ClipRRect(
          borderRadius: borderRadius,
          child: MediaImage(
            id: avatarId,
            placeholder: fallback,
            errorWidget: fallback,
          ),
        ),
      );
    } else {
      final members = (conversation['members'] as List? ?? [])
          .where((m) => m is Map && m['user'] is Map)
          .toList();

      final sample = members.take(4).toList();
      if (sample.isEmpty) {
        content = QChatAvatar(
          conversation['title']?.toString() ?? 'G',
          size: size,
        );
      } else if (sample.length == 1) {
        content = UserAvatar(sample.first['user'] as Map, size: size);
      } else {
        // 2x2 grid for up to 4 members
        final gap = 1.5;
        final cell = (size - 3 * gap) / 2;

        content = Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: qchatDark(c)
                ? const Color(0xff333333)
                : const Color(0xffeaeaea),
            borderRadius: borderRadius,
          ),
          padding: EdgeInsets.all(gap),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _cell(sample[0]['user'] as Map, cell),
                  SizedBox(width: gap),
                  _cell(sample[1]['user'] as Map, cell),
                ],
              ),
              SizedBox(height: gap),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (sample.length >= 3)
                    _cell(sample[2]['user'] as Map, cell)
                  else
                    SizedBox(width: cell, height: cell),
                  SizedBox(width: gap),
                  if (sample.length >= 4)
                    _cell(sample[3]['user'] as Map, cell)
                  else
                    SizedBox(width: cell, height: cell),
                ],
              ),
            ],
          ),
        );
      }
    }

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: content);
    }
    return content;
  }

  Widget _cell(Map user, double cellSize) {
    final avatarId = user['avatarId']?.toString();
    final nickname = user['nickname']?.toString() ?? '';
    final fallback = QChatAvatar(nickname, size: cellSize);

    return SizedBox.square(
      dimension: cellSize,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: avatarId != null && avatarId.isNotEmpty
            ? MediaImage(
                id: avatarId,
                placeholder: fallback,
                errorWidget: fallback,
              )
            : fallback,
      ),
    );
  }
}
