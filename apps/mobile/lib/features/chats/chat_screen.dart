import '../../core/design_system/qchat_glass.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'dart:async';
import 'dart:io';
import 'package:uuid/uuid.dart';
import '../../core/design_system/dialogs.dart';
import 'dart:math' as math;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'package:record/record.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import 'message_status.dart';
import 'message_actions_menu.dart';
import 'chat_composer.dart';
import 'attachment_preview.dart';
import 'message_attachment.dart';
import 'money_message.dart';
import 'red_packet_screen.dart';
import 'transfer_receipt_screen.dart';
import 'chat_details_screen.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/design_system/qchat_animations.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/network/media_upload.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen>
    with WidgetsBindingObserver {
  final input = TextEditingController(), scroll = ScrollController();
  List<Map<String, dynamic>> messages = [];
  final selected = <String>{};
  final recalling = <String>{};
  final messageKeys = <String, GlobalKey>{};
  String? highlightedMessage;
  bool locatingQuote = false;
  Timer? highlightTimer;
  bool selecting = false;
  StreamSubscription<void>? updates;
  StreamSubscription<void>? messageUpdates;
  List<dynamic> members = [];
  int readSequence = 0;
  String title = 'QChat';
  String? error, reply;
  bool loading = true, emoji = false, uploading = false, pickingMedia = false;
  bool attachments = false, voice = false;
  int attachPage = 0;
  String myName = 'Q';
  Color? chatBackground;
  ImageProvider? chatBackgroundImage;
  String? wallpaperMediaId;
  int wallpaperRequest = 0;
  bool wallpaperLoaded = false;
  final inputFocus = FocusNode();
  final recorder = AudioRecorder();
  bool recordingVoice = false;
  DateTime? voiceStartedAt;
  Timer? voiceHoldTimer;
  int voiceHoldToken = 0;
  final composerKey = GlobalKey();
  double keyboardHeight = 0;
  double composerHeight = 56;
  Timer? panelTimer;
  Timer? voiceLimitTimer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    inputFocus.addListener(() {
      if (mounted) setState(() {});
      settlePanels();
    });
    // Only refresh the read marker here. Reloading from the scroll listener
    // used to jump the list back to the bottom while the user was dragging
    // away from it, which felt like the list kept snapping.
    scroll.addListener(() {
      if (!locatingQuote && scroll.hasClients && scroll.position.pixels < 40) {
        markRead();
      }
    });
    load();
    updates = ref.read(clientProvider).changes.stream.listen((_) {
      if (mounted) load();
    });
    messageUpdates = ref.read(clientProvider).messageChanges.stream.listen((_) {
      if (!mounted) return;
      final atBottom = !scroll.hasClients || scroll.position.pixels < 8;
      final previousCount = messages.length;
      setState(() {
        messages = ref
            .read(clientProvider)
            .visibleMessages(widget.id, messages);
        loading = false;
      });
      if (messages.length > previousCount &&
          (atBottom || messages.last['pending'] == true)) {
        scrollToEnd();
      }
    });
  }

  @override
  void dispose() {
    updates?.cancel();
    messageUpdates?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    panelTimer?.cancel();
    voiceHoldTimer?.cancel();
    voiceLimitTimer?.cancel();
    ++voiceHoldToken;
    highlightTimer?.cancel();
    if (recordingVoice) unawaited(recorder.stop());
    recorder.dispose();
    inputFocus.dispose();
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  bool fetching = false;
  bool reload = false;
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load();
  }

  /// Chạy mỗi khung hình khi bàn phím trượt: giữ danh sách bám đáy để không bị
  /// lò xo (bouncing) của iOS kéo nẩy lại khi viewport đổi kích thước.
  @override
  void didChangeMetrics() {
    if (!mounted) return;
    settlePanels();
  }

  /// Khi người dùng bấm lại vào ô nhập lúc panel đang mở, đợi bàn phím lên hẳn
  /// rồi mới đóng panel -> chiều cao vùng đáy luôn liên tục, không nhảy.
  void settlePanels() {
    panelTimer?.cancel();
    if (!(emoji || attachments) || !inputFocus.hasFocus) return;
    panelTimer = Timer(const Duration(milliseconds: 280), () {
      if (!mounted || !inputFocus.hasFocus) return;
      setState(() {
        emoji = false;
        attachments = false;
      });
    });
  }

  void stickyState(VoidCallback change) {
    final stick = !scroll.hasClients || scroll.position.pixels < 100;
    setState(change);
    if (stick) scrollToEnd();
  }

  void toggleVoice() {
    stickyState(() {
      voice = !voice;
      emoji = false;
      attachments = false;
    });
    voice ? inputFocus.unfocus() : inputFocus.requestFocus();
  }

  void beginVoiceHold() {
    final token = ++voiceHoldToken;
    voiceHoldTimer?.cancel();
    voiceHoldTimer = Timer(const Duration(milliseconds: 250), () {
      unawaited(startVoiceRecording(token));
    });
  }

  void endVoiceHold() {
    ++voiceHoldToken;
    voiceHoldTimer?.cancel();
    unawaited(stopVoiceRecording());
  }

  Future<void> startVoiceRecording(int token) async {
    if (!voice || recordingVoice || uploading) return;
    try {
      if (!await recorder.hasPermission()) {
        if (token != voiceHoldToken) return;
        if (mounted) setState(() => error = tr(context, 'microphonePermission'));
        return;
      }
      if (token != voiceHoldToken) return;
      final path = '${Directory.systemTemp.path}${Platform.pathSeparator}qchat-voice-${const Uuid().v4()}.m4a';
      await recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
      if (token != voiceHoldToken) {
        final canceledPath = await recorder.stop();
        if (canceledPath != null) await File(canceledPath).delete().catchError((_) => File(canceledPath));
        return;
      }
      if (mounted) {
        setState(() {
          recordingVoice = true;
          voiceStartedAt = DateTime.now();
        });
        voiceLimitTimer?.cancel();
        voiceLimitTimer = Timer(const Duration(seconds: 60), () {
          if (mounted && recordingVoice) unawaited(stopVoiceRecording());
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  Future<void> stopVoiceRecording() async {
    if (!recordingVoice) return;
    voiceLimitTimer?.cancel();
    voiceLimitTimer = null;
    final path = await recorder.stop();
    final startedAt = voiceStartedAt;
    if (mounted) setState(() { recordingVoice = false; voiceStartedAt = null; });
    if (path == null || startedAt == null) return;
    final file = File(path);
    if (!await file.exists()) return;
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || !mounted) {
      await file.delete().catchError((_) => file);
      return;
    }
    if (bytes.length > maxMediaBytes) {
      if (mounted) setState(() => error = tr(context, 'mediaTooLarge'));
      await file.delete().catchError((_) => file);
      return;
    }
    setState(() { uploading = true; error = null; });
    try {
      final client = ref.read(clientProvider);
      const name = 'voice-message.m4a';
      const mime = 'audio/mp4';
      final seconds = (DateTime.now().difference(startedAt).inMilliseconds / 1000)
          .round()
          .clamp(1, 60);
      final intent = await client.post('/media/upload-intent', {'name': name, 'size': bytes.length, 'mime': mime});
      await Dio().put(intent['url'], data: bytes, options: Options(headers: {'Content-Type': mime}));
      await client.post('/media/complete', {'mediaId': intent['id']});
      await client.send(widget.id, '$seconds', kind: 'AUDIO', mediaId: intent['id']);
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      await file.delete().catchError((_) => file);
      if (mounted) setState(() => uploading = false);
    }
  }

  void toggleEmoji() {
    if (emoji) {
      inputFocus.requestFocus();
      return;
    }
    stickyState(() {
      emoji = true;
      attachments = false;
      voice = false;
    });
    inputFocus.unfocus();
  }

  void togglePlus() {
    if (attachments) {
      inputFocus.requestFocus();
      return;
    }
    stickyState(() {
      attachments = true;
      emoji = false;
      voice = false;
      attachPage = 0;
    });
    inputFocus.unfocus();
  }

  void dismissInput() {
    inputFocus.unfocus();
    if (emoji || attachments) {
      stickyState(() {
        emoji = false;
        attachments = false;
      });
    }
  }

  void insertEmoji(String e) {
    final text = input.text;
    final sel = input.selection;
    final start = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    input.value = TextEditingValue(
      text: text.replaceRange(start, end, e),
      selection: TextSelection.collapsed(offset: start + e.length),
    );
    setState(() {});
  }

  static const emojis = [
    '😀',
    '😊',
    '😂',
    '🥰',
    '😍',
    '🤔',
    '😢',
    '😎',
    '👍',
    '👏',
    '🙏',
    '💚',
    '❤️',
    '🎉',
    '🌻',
    '☕',
  ];

  void scrollToEnd() {
    if (locatingQuote) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!locatingQuote && scroll.hasClients) scroll.jumpTo(0);
    });
  }

  /// Marks the newest message as read without reloading the conversation, so
  /// scrolling near the bottom never rebuilds the list or moves its offset.
  void markRead() {
    if (!mounted ||
        !(ModalRoute.of(context)?.isCurrent ?? false) ||
        WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) {
      return;
    }
    var sequence = readSequence;
    for (final message in messages) {
      final value = message['sequence'];
      if (message['pending'] != true && value is int && value > sequence) {
        sequence = value;
      }
    }
    if (sequence <= readSequence) return;
    readSequence = sequence;
    final client = ref.read(clientProvider);
    unawaited(
      client
          .post('/conversations/${widget.id}/read', {'sequence': sequence})
          .then((_) => client.applyConversationRead(widget.id, sequence))
          .catchError((_) {}),
    );
  }

  /// Measures the floating input bar so the list can keep its newest message
  /// above it even when the field grows to several lines or the selection /
  /// reply bars appear.
  void measureComposer() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final size = composerKey.currentContext?.size;
      if (size == null || (size.height - composerHeight).abs() < .5) return;
      setState(() => composerHeight = size.height);
    });
  }

  Map? quotedMessage(String id) {
    for (final message in messages) {
      if (message['id'] == id) return message;
    }
    return null;
  }

  String quoteLabel(String id) {
    final original = quotedMessage(id);
    if (original == null) return tr(context, 'quoteUnavailable');
    if (original['recalledAt'] != null) return tr(context, 'recalled');
    final text = original['text']?.toString() ?? '';
    return text.isEmpty ? tr(context, 'reply') : text;
  }

  String quoteSender(String id) {
    final original = quotedMessage(id);
    if (original == null) return '';
    final senderId = original['senderId'];
    for (final member in members.cast<Map>()) {
      if (member['userId'] != senderId) continue;
      final user = member['user'];
      final nickname = user is Map ? user['nickname']?.toString() : null;
      if (nickname != null && nickname.isNotEmpty) return nickname;
    }
    final sender = original['sender'];
    final nickname = sender is Map ? sender['nickname']?.toString() : null;
    if (nickname != null && nickname.isNotEmpty) return nickname;
    return senderId == ref.read(clientProvider).userId ? myName : title;
  }

  /// Khung trích dẫn nằm ngay dưới bong bóng tin nhắn.
  Widget quoteBlock(String id) => ConstrainedBox(
    constraints: BoxConstraints(
      maxWidth: MediaQuery.sizeOf(context).width * .68 + 24,
    ),
    child: Padding(
      padding: const EdgeInsets.only(top: 4, left: 12, right: 12),
      child: QChatQuote(
        name: quoteSender(id),
        text: quoteLabel(id),
        onTap: () => jumpToQuote(id),
      ),
    ),
  );

  Future<void> jumpToQuote(String id) async {
    if (locatingQuote) return;
    dismissInput();
    final target = messages.indexWhere((m) => m['id'] == id);
    if (target < 0) {
      setState(() => error = tr(context, 'quoteUnavailable'));
      return;
    }
    locatingQuote = true;
    try {
      for (var step = 0; mounted && step <= messages.length * 2; step++) {
        final targetContext = messageKeys[id]?.currentContext;
        if (targetContext != null && targetContext.mounted) {
          await Scrollable.ensureVisible(
            targetContext,
            alignment: .5,
            duration: const Duration(milliseconds: 250),
          );
          if (!mounted) return;
          highlightTimer?.cancel();
          setState(() {
            highlightedMessage = id;
            error = null;
          });
          highlightTimer = Timer(const Duration(seconds: 2), () {
            if (mounted) setState(() => highlightedMessage = null);
          });
          return;
        }
        if (!scroll.hasClients) break;
        final mountedIndices = <int>[
          for (var i = 0; i < messages.length; i++)
            if (messageKeys[messages[i]['id']]?.currentContext != null) i,
        ];
        final older = mountedIndices.isEmpty || target < mountedIndices.first;
        final position = scroll.position;
        final next =
            (position.pixels +
                    (older ? 1 : -1) * position.viewportDimension * .7)
                .clamp(position.minScrollExtent, position.maxScrollExtent)
                .toDouble();
        if ((next - position.pixels).abs() < .1) break;
        scroll.jumpTo(next);
        await WidgetsBinding.instance.endOfFrame;
      }
      if (mounted) setState(() => error = tr(context, 'quoteUnavailable'));
    } finally {
      locatingQuote = false;
    }
  }

  void applyWallpaper(Map conversation) {
    if (!mounted) return;
    wallpaperLoaded = true;
    final color = conversation['wallpaperColor'];
    final colorValue =
        color is String && RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(color)
        ? int.tryParse('ff${color.substring(1)}', radix: 16)
        : null;
    final mediaId = conversation['wallpaperMediaId'] as String?;
    setState(
      () => chatBackground = colorValue == null ? null : Color(colorValue),
    );
    if (mediaId == wallpaperMediaId && chatBackgroundImage != null) return;
    final request = ++wallpaperRequest;
    wallpaperMediaId = mediaId;
    if (mediaId == null) {
      setState(() => chatBackgroundImage = null);
      return;
    }
    unawaited(
      MediaCache.load(ref.read(clientProvider), mediaId)
          .then((bytes) {
            if (!mounted || request != wallpaperRequest || bytes == null) {
              return;
            }
            setState(() => chatBackgroundImage = MemoryImage(bytes));
          })
          .catchError((_) {}),
    );
  }

  Future<void> load() async {
    if (fetching) {
      reload = true;
      return;
    }
    fetching = true;
    final nearEnd =
        !locatingQuote && (!scroll.hasClients || scroll.offset < 100);
    try {
      final client = ref.read(clientProvider);
      if (!wallpaperLoaded) {
        final cachedConversation = await client.local?.read(
          '/conversations/${widget.id}',
        );
        if (cachedConversation is Map) applyWallpaper(cachedConversation);
      }
      final cached = await client.local?.read('messages:${widget.id}');
      client.clearedSequences[widget.id] =
          await client.local?.read('clearedSequence:${widget.id}') as int? ?? 0;
      if (cached is List && mounted) {
        setState(() {
          messages = client.visibleMessages(
            widget.id,
            cached.map((m) => Map<String, dynamic>.from(m)).toList(),
          );
          loading = false;
        });
      }
      final c = await client.get('/conversations/${widget.id}', cached: false);
      applyWallpaper(c);
      try {
        await client.local?.cache('/conversations/${widget.id}', c);
      } catch (_) {}
      final ownMember = (c['members'] as List).firstWhere(
        (m) => m['userId'] == client.userId,
      );
      await client.applyClearedSequence(
        widget.id,
        ownMember['clearedSequence'] as int? ?? 0,
      );
      if (ownMember['markedUnread'] == true) {
        await client.dio.patch(
          '/conversations/${widget.id}/state',
          data: {'markedUnread': false},
        );
        await client.applyConversationRead(
          widget.id,
          ownMember['readSequence'] as int? ?? 0,
          clearMarkedUnread: true,
        );
      }
      final rows = await client.messages(widget.id);
      final others = (c['members'] as List).where(
        (m) => m['userId'] != client.userId,
      );
      if (mounted) {
        setState(() {
          messages = client.visibleMessages(widget.id, rows);
          members = c['members'];
          final own = members.where((m) => m['userId'] == client.userId);
          if (own.isNotEmpty) myName = own.first['user']['nickname'];
          title = c['kind'] == 'GROUP'
              ? c['title']
              : others.isEmpty
              ? 'QChat'
              : others.first['user']['nickname'];
          error = null;
        });
      }
      // Do not jump to the bottom here: the reversed list already stays at the
      // newest message, and jumping interrupted the user whenever a refresh
      // (receipt, reconnect, read sync) completed mid-scroll.
      if (nearEnd) markRead();
    } catch (e) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    } finally {
      fetching = false;
      if (mounted) setState(() => loading = false);
      if (reload && mounted) {
        reload = false;
        unawaited(load());
      }
    }
  }

  Future<void> send() async {
    if (input.text.trim().isEmpty) return;
    final text = input.text;
    input.clear();
    try {
      await ref.read(clientProvider).send(widget.id, text, replyToId: reply);
      if (mounted) setState(() => reply = null);
    } catch (e) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  Future<void> attachFile(PlatformFile file, {bool confirmed = false}) async {
    if (uploading) return;
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      if ((await file.length() ?? 0) > maxMediaBytes) {
        throw StateError('mediaTooLarge');
      }
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty || bytes.length > maxMediaBytes) {
        throw StateError('mediaTooLarge');
      }
      const mime = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'mp3': 'audio/mpeg',
        'pdf': 'application/pdf',
      };
      final ext = file.extension?.toLowerCase();
      final type = mime[ext];
      if (type == null) throw StateError('unsupportedMedia');
      if (!mounted) return;
      confirmed =
          confirmed || await previewAttachment(context, file, bytes, type);
      if (!confirmed || !mounted) return;
      final client = ref.read(clientProvider);
      final intent = await client.post('/media/upload-intent', {
        'name': file.name,
        'size': bytes.length,
        'mime': type,
      });
      await Dio().put(
        intent['url'],
        data: bytes,
        options: Options(headers: {'Content-Type': type}),
      );
      await client.post('/media/complete', {'mediaId': intent['id']});
      if (type.startsWith('image/') || type.startsWith('video/')) {
        await MediaCache.rememberMedia(
          intent['id'],
          bytes,
          type,
          local: client.local,
        );
      }
      await client.send(
        widget.id,
        file.name,
        kind: type.startsWith('image')
            ? 'IMAGE'
            : type.startsWith('video')
            ? 'VIDEO'
            : type.startsWith('audio')
            ? 'AUDIO'
            : 'FILE',
        mediaId: intent['id'],
      );
    } catch (e) {
      if (mounted) {
        setState(
          () => error = tr(
            context,
            e is StateError ? e.message.toString() : 'networkError',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> attach({List<String>? extensions}) async {
    final result = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions:
          extensions ??
          ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'mp3', 'pdf'],
    );
    if (result != null) await attachFile(result);
  }

  Future<void> attachImage() async {
    if (pickingMedia || uploading) return;
    setState(() => pickingMedia = true);
    try {
      dismissInput();
      final files = await pickMediaWithSource(
        context,
        confirmLabel: tr(context, 'send'),
      );
      for (final file in files) {
        if (!mounted) break;
        await attachFile(file, confirmed: true);
        if (error != null) break;
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => error = tr(
            context,
            e is StateError ? e.message.toString() : 'mediaUnavailable',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => pickingMedia = false);
    }
  }

  Future<void> takePhoto() async {
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(source: ImageSource.camera);
      if (photo != null) {
        await attachFile(XFilePlatformFile(photo));
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  String messageTime(dynamic raw) {
    final d = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (d == null) return '';
    final now = DateTime.now();
    final time =
        '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    return d.year == now.year && d.month == now.month && d.day == now.day
        ? time
        : '${d.day}/${d.month} $time';
  }

  bool showTime(int i) {
    if (i == 0) return true;
    final a = DateTime.tryParse(messages[i]['createdAt']?.toString() ?? '');
    final b = DateTime.tryParse(messages[i - 1]['createdAt']?.toString() ?? '');
    return a != null && b != null && a.difference(b).inMinutes.abs() >= 5;
  }

  String? get peerQchatId {
    for (final member in members) {
      if (member is! Map) continue;
      if (member['userId'] == ref.read(clientProvider).userId) continue;
      final user = member['user'];
      final id = user is Map ? user['qchatId']?.toString() : null;
      if (id != null && id.isNotEmpty) return id;
    }
    return null;
  }

  void openMoney(BuildContext c, {bool redPacket = false}) {
    final peer = peerQchatId;
    c.push(
      '/payments/transfer'
      '?to=${Uri.encodeQueryComponent(peer ?? '')}'
      '${peer == null ? '' : '&conversation=${widget.id}'}'
      '${redPacket ? '&red=1' : ''}',
    );
  }

  void callPeer(BuildContext c, bool video) =>
      c.push('/call/${widget.id}?video=$video');

  Future<int?> claimMoneyMessage(Map message) async {
    try {
      final result = Map<String, dynamic>.from(
        await ref.read(clientProvider).post('/messages/${message['id']}/claim', {}),
      );
      await ref.read(clientProvider).applyMoneyClaim(result);
      final claims = result['claims'];
      if (claims is List && claims.isNotEmpty && claims.first is Map) {
        return (claims.first['amount'] as num?)?.toInt();
      }
    } on DioException catch (exception) {
      if (mounted) {
        setState(() {
          error = exception.response?.statusCode == 403
              ? 'Hồng bao hoặc chuyển tiền này không dành cho bạn.'
              : 'Không thể nhận tiền lúc này.';
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Không thể nhận tiền lúc này.');
    }
    return null;
  }

  Future<void> openMoneyMessage(Map m, Map sender, bool mine) async {
    if (m['kind'] == 'RED_PACKET') {
      // Another device may have claimed it already; fetch the latest claim
      // before deciding between the cover and the opened receipt.
      final message = await ref
          .read(clientProvider)
          .refreshMoneyMessage(Map<String, dynamic>.from(m));
      if (!mounted) return;
      final result = await Navigator.of(context).push<String>(
        PageRouteBuilder(
          opaque: false,
          barrierDismissible: true,
          barrierColor: const Color(0x80000000),
          barrierLabel: 'Hồng bao',
          transitionDuration: const Duration(milliseconds: 220),
          reverseTransitionDuration: const Duration(milliseconds: 180),
          pageBuilder: (_, animation, _) =>
              RedPacketScreen(
                message: message,
                sender: sender,
                mine: mine,
                onClaim: () => claimMoneyMessage(message),
              ),
          transitionsBuilder: (_, animation, _, child) => FadeTransition(
            opacity: animation,
            child: ScaleTransition(
              scale: Tween<double>(begin: .97, end: 1).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOut),
              ),
              child: child,
            ),
          ),
        ),
      );
      if (!mounted) return;
      if (result == 'sticker') {
        setState(() {
          emoji = true;
          attachments = false;
          voice = false;
        });
        inputFocus.unfocus();
      }
      return;
    }
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => TransferReceiptScreen(
          message: m,
          mine: mine,
          onClaim: () => claimMoneyMessage(m),
        ),
      ),
    );
  }

  Widget attachmentPanel(BuildContext c, double safeBottom) {
    final pages = <List<(String, String, VoidCallback)>>[
      [
        ('image', 'image', attachImage),
        ('camera', 'camera', takePhoto),
        ('videoCall', 'videoCall', () => callPeer(c, true)),
        ('call', 'call', () => callPeer(c, false)),
        ('location', 'location', () => openFeature(c, 'location')),
        ('gift', 'redPacket', () => openMoney(c, redPacket: true)),
        ('payments', 'transferMoney', () => openMoney(c)),
        ('favorites', 'favorites', () => c.push('/favorites')),
      ],
      [
        ('me', 'contactCard', () => openFeature(c, 'contactCard')),
        ('file', 'file', () => attach()),
        ('music', 'music', () => attach(extensions: ['mp3'])),
      ],
    ];
    return Column(
      children: [
        Expanded(
          child: PageView(
            onPageChanged: (value) => setState(() => attachPage = value),
            children: [
              for (final page in pages)
                GridView.count(
                  padding: const EdgeInsets.fromLTRB(12, 16, 12, 4),
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 4,
                  childAspectRatio: .88,
                  children: [
                    for (final a in page)
                      GestureDetector(
                        onTap: uploading || pickingMedia ? null : a.$3,
                        child: Column(
                          children: [
                            Container(
                              width: 62,
                              height: 62,
                              decoration: BoxDecoration(
                                color: surface(c),
                                borderRadius: BorderRadius.circular(17),
                              ),
                              child: Center(
                                child: QChatIcon(
                                  a.$1,
                                  size: 29,
                                  color: const Color(0xff505050),
                                  filled: true,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              tr(c, a.$2),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xff888888),
                                decoration: TextDecoration.none,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
            ],
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(0, 2, 0, 8 + safeBottom),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < pages.length; i++)
                Container(
                  width: 7,
                  height: 7,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: i == attachPage
                        ? const Color(0xff666666)
                        : const Color(0xffd2d2d2),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget emojiPanel(BuildContext c, double safeBottom) => GridView.count(
    padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + safeBottom),
    crossAxisCount: 8,
    children: [
      for (final e in emojis)
        GestureDetector(
          onTap: () => insertEmoji(e),
          child: Center(child: Text(e, style: const TextStyle(fontSize: 26))),
        ),
    ],
  );

  Future<void> forward(List<Map<String, dynamic>> rows) async {
    try {
      final client = ref.read(clientProvider);
      final chats = await client.get('/conversations', cached: false) as List;
      if (!mounted) return;
      final target = await showQChatDialog<String>(
        context,
        title: tr(context, 'forward'),
        content: Builder(
          builder: (c) => ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320),
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final chat in chats)
                  TCell(
                    title: Text(
                      chat['kind'] == 'GROUP'
                          ? chat['title']
                          : (chat['members'] as List)
                                .where((m) => m['userId'] != client.userId)
                                .map((m) => m['user']['nickname'])
                                .join(', '),
                    ),
                    onTap: () => Navigator.pop(c, chat['id'] as String),
                  ),
              ],
            ),
          ),
        ),
        actions: [QChatDialogAction(label: tr(context, 'cancel'))],
      );
      if (target == null) return;
      for (final row in rows) {
        await client.post('/messages/${row['id']}/forward', {
          'conversationId': target,
          'clientId': const Uuid().v4(),
        });
      }
      if (mounted) {
        setState(() {
          selecting = false;
          selected.clear();
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  Future<void> deleteMessages(List<Map<String, dynamic>> rows) async {
    if (!await confirmAction(
      context,
      tr(context, 'delete'),
      tr(context, 'deleteMessagesNote'),
    )) {
      return;
    }
    final client = ref.read(clientProvider);
    final ids = {for (final row in rows) row['id'].toString()};
    try {
      for (final row in rows) {
        await client.dio.delete('/messages/${row['id']}');
      }
      if (!mounted) return;
      // Remove the rows locally instead of refetching the whole conversation,
      // so the list keeps its scroll position and media stays untouched.
      setState(() {
        messages = [
          for (final m in messages)
            if (!ids.contains(m['id'].toString())) m,
        ];
        selecting = false;
        selected.clear();
      });
      await client.applyDelete(widget.id, ids);
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  void openMessageMenu(Map<String, dynamic> m, BuildContext anchor) {
    final sent = m['pending'] != true && m['recalledAt'] == null;
    final created = DateTime.tryParse(m['createdAt']?.toString() ?? '');
    final text = (m['text'] ?? '').toString().trim();
    final actions = <MessageAction>[
      if (sent)
        MessageAction(
          id: 'quoteMessage',
          icon: TIcons.quote,
          label: tr(context, 'quoteMessage'),
          onTap: () {
            setState(() => reply = m['id']);
            inputFocus.requestFocus();
          },
        ),
      if (text.isNotEmpty)
        MessageAction(
          id: 'copy',
          icon: TIcons.copy,
          label: tr(context, 'copy'),
          onTap: () => Clipboard.setData(ClipboardData(text: text)),
        ),
      if (sent) ...[
        MessageAction(
          id: 'forward',
          icon: TIcons.share,
          label: tr(context, 'forward'),
          onTap: () => forward([m]),
        ),
        MessageAction(
          id: 'favorites',
          icon: TIcons.star,
          label: tr(context, 'favorites'),
          onTap: () => operation(
            () => ref
                .read(clientProvider)
                .dio
                .patch(
                  '/messages/${m['id']}/favorite',
                  data: {'favorite': true},
                ),
          ),
        ),
        MessageAction(
          id: 'search',
          icon: TIcons.search,
          label: tr(context, 'search'),
          onTap: () => Navigator.of(context).push(
            CupertinoPageRoute<void>(
              builder: (_) =>
                  ChatHistoryScreen(id: widget.id, query: m['text'] ?? ''),
            ),
          ),
        ),
        MessageAction(
          id: 'selectMessages',
          icon: TIcons.check_rectangle,
          label: tr(context, 'selectMessages'),
          onTap: () => setState(() {
            selecting = true;
            selected.add(m['id']);
          }),
        ),
        if (m['senderId'] == ref.read(clientProvider).userId &&
            created != null &&
            DateTime.now().difference(created).inSeconds < 120)
          MessageAction(
            id: 'recall',
            icon: TIcons.rollback,
            label: tr(context, 'recall'),
            destructive: true,
            onTap: () => recallMessage(m),
          ),
        MessageAction(
          id: 'delete',
          icon: TIcons.delete,
          label: tr(context, 'delete'),
          destructive: true,
          onTap: () => deleteMessages([m]),
        ),
      ],
    ];
    if (actions.isEmpty) return;
    showMessageActions(context, anchorContext: anchor, actions: actions);
  }

  Future<void> operation(Future<dynamic> Function() fn) async {
    try {
      await fn();
      await ref.read(clientProvider).local!.cache('messages:${widget.id}', []);
      await ref.read(clientProvider).local!.cache('cursor:${widget.id}', 0);
      ref
          .read(clientProvider)
          .confirmed
          .removeWhere((_, m) => m['conversationId'] == widget.id);
      await load();
    } catch (e) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }

  Future<void> recallMessage(Map<String, dynamic> message) async {
    final id = message['id'] as String;
    if (!recalling.add(id)) return;
    setState(() {});
    try {
      final client = ref.read(clientProvider);
      final result = await client.post('/messages/$id/recall', {});
      await client.applyRecall(
        widget.id,
        id,
        at: result['recalledAt'] as String?,
      );
      if (mounted && reply == id) setState(() => reply = null);
    } catch (_) {
      if (mounted) {
        await showQChatDialog<void>(
          context,
          message: tr(context, 'networkError'),
          actions: [
            QChatDialogAction(label: tr(context, 'confirm'), primary: true),
          ],
        );
      }
    } finally {
      if (mounted) setState(() => recalling.remove(id));
    }
  }

  @override
  Widget build(BuildContext c) {
    final lastOutgoing = messages.lastIndexWhere(
      (message) =>
          message['senderId'] == ref.read(clientProvider).userId &&
          message['recalledAt'] == null,
    );
    final keyboard = MediaQuery.viewInsetsOf(c).bottom;
    final safeBottom = MediaQuery.viewPaddingOf(c).bottom;
    // The glass bar floats over the list, so reserve its height at the top of
    // the content instead of letting the newest messages sit under the blur.
    final headerInset = MediaQuery.paddingOf(c).top + 54;
    if (keyboard > keyboardHeight) keyboardHeight = keyboard;
    final panelOpen = emoji || attachments;
    final panelHeight = math.max(keyboardHeight, 250 + safeBottom);
    // Vùng đáy nằm trong lớp kính của thanh nhập: bàn phím | panel | safe area.
    // Dùng max() để khi bàn phím đóng dần, ô nhập vẫn nằm trên safe area chứ
    // không tụt xuống sát đáy rồi bật ngược lên.
    final reserved = panelOpen ? panelHeight : math.max(keyboard, safeBottom);
    // Bàn phím đã tự chạy animation của hệ thống nên bám theo nó ngay từng
    // khung hình; chỉ riêng lúc mở/đóng panel mới cần nội suy để ô nhập và
    // danh sách tin nhắn cùng trượt, không bị giật lệch nhau.
    final insetDuration = keyboard > 0 || inputFocus.hasFocus
        ? Duration.zero
        : qchatDuration(c);
    measureComposer();
    return QChatPage(
      title: title,
      glassHeader: true,
      background: chatBackground,
      backgroundImage: chatBackgroundImage,
      leading: QChatIconButton(
        'back',
        label: tr(c, 'back'),
        onTap: () => context.canPop() ? context.pop() : context.go('/home'),
      ),
      trailing: QChatIconButton(
        'more',
        label: tr(c, 'settings'),
        onTap: () async {
          dismissInput();
          final route = CupertinoPageRoute<void>(
            builder: (_) => ChatDetailsScreen(id: widget.id),
          );
          await Navigator.of(c).push(route);
          // The pop result arrives before an interactive back swipe settles.
          // Refresh only after the route overlay has finished moving away.
          await route.completed;
          if (mounted) load();
        },
      ),
      child: Column(
        children: [
          if (error != null)
            GestureDetector(
              onTap: load,
              child: Padding(
                padding: EdgeInsets.fromLTRB(8, headerInset + 8, 8, 8),
                child: Text(
                  error!,
                  style: const TextStyle(
                    color: QChatColors.danger,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                                  child: loading
                      ? const QChatLoading(label: 'Đang tải')
                      : messages.isEmpty
                      ? QChatEmptyState(tr(c, 'emptyChats'))
                      : GestureDetector(
                          behavior: HitTestBehavior.translucent,
                          onTap: dismissInput,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: TweenAnimationBuilder<double>(
                              tween: Tween<double>(
                                end: composerHeight + reserved,
                              ),
                              duration: insetDuration,
                              curve: Curves.easeOut,
                              builder: (c, bottomInset, _) =>
                                  ListView.builder(
                                controller: scroll,
                                padding: EdgeInsets.only(
                                  top: error == null ? headerInset : 0,
                                  bottom: bottomInset,
                                ),
                                // reverse: điểm bắt đầu là tin mới nhất -> mở chat không phải
                                // cuộn từ trên xuống. Ít tin thì shrinkWrap + Align để vẫn
                                // nằm sát phía trên như cũ.
                                reverse: true,
                                shrinkWrap: messages.length < 12,
                                keyboardDismissBehavior:
                                    ScrollViewKeyboardDismissBehavior.onDrag,
                                itemCount: messages.length,
                                itemBuilder: (c, index) {
                                  final i = messages.length - 1 - index;
                                  final m = messages[i],
                                      mine =
                                          m['senderId'] ==
                                          ref.read(clientProvider).userId;
                                  final sender = members.cast<Map>().firstWhere(
                                    (member) =>
                                        member['userId'] == m['senderId'],
                                    orElse: () => {
                                      'user':
                                          m['sender'] ??
                                          {
                                            'nickname': mine ? myName : title,
                                          },
                                    },
                                  )['user'];
                                  final money =
                                      m['kind'] == 'TRANSFER' ||
                                      m['kind'] == 'RED_PACKET';
                                  return AnimatedContainer(
                                    key: messageKeys.putIfAbsent(
                                      m['id'].toString(),
                                      () => GlobalKey(),
                                    ),
                                    duration: const Duration(milliseconds: 200),
                                    color: highlightedMessage == m['id']
                                        ? QChatColors.green.withValues(
                                            alpha: .18,
                                          )
                                        : Colors.transparent,
                                    child: Column(
                                      children: [
                                        if (showTime(i))
                                          Padding(
                                            padding: const EdgeInsets.symmetric(
                                              vertical: 16,
                                            ),
                                            child: Text(
                                              messageTime(m['createdAt']),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: QChatColors.muted,
                                              ),
                                            ),
                                          ),
                                        if (selecting && m['pending'] != true)
                                          TButton(
                                            variant: TButtonVariant.text,
                                            onPressed: () => setState(
                                              () => selected.contains(m['id'])
                                                  ? selected.remove(m['id'])
                                                  : selected.add(m['id']),
                                            ),
                                            child: TIcon(
                                              selected.contains(m['id'])
                                                  ? TIcons.check_circle_filled
                                                  : TIcons.circle,
                                              color: QChatColors.green,
                                            ),
                                          ),
                                        QChatChatBubble(
                                          bareMedia:
                                              m['mediaId'] != null &&
                                              m['recalledAt'] == null &&
                                              (m['kind'] == 'IMAGE' ||
                                                  m['kind'] == 'VIDEO') ||
                                              money,
                                          bubbleWrapper: (bubble) => Builder(
                                            builder: (anchor) => GestureDetector(
                                              onLongPress: () =>
                                                  openMessageMenu(m, anchor),
                                              child: Column(
                                                mainAxisSize: MainAxisSize.min,
                                                crossAxisAlignment: mine
                                                    ? CrossAxisAlignment.end
                                                    : CrossAxisAlignment.start,
                                                children: [
                                                  Stack(
                                                    alignment: Alignment.center,
                                                    children: [
                                                      Opacity(
                                                        opacity:
                                                            recalling.contains(
                                                              m['id'],
                                                            )
                                                            ? .45
                                                            : 1,
                                                        child: bubble,
                                                      ),
                                                      if (recalling.contains(
                                                        m['id'],
                                                      ))
                                                        const SizedBox(
                                                          width: 16,
                                                          height: 16,
                                                          child:
                                                              CircularProgressIndicator(
                                                                strokeWidth:
                                                                    1.5,
                                                              ),
                                                        ),
                                                    ],
                                                  ),
                                                  if (m['replyToId'] != null)
                                                    quoteBlock(
                                                      m['replyToId']
                                                          .toString(),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ),
                                          mine: mine,
                                          avatar: UserAvatar(
                                            openProfile: !mine,
                                            sender,
                                            size: 42,
                                          ),
                                          name: mine ? myName : title,
                                          child: money
                                              ? MoneyMessageCard(
                                                  message: m,
                                                  mine: mine,
                                                  onTap: () =>
                                                      openMoneyMessage(
                                                        m,
                                                        sender,
                                                        mine,
                                                      ),
                                                )
                                              : Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              if (m['mediaId'] != null &&
                                                  m['recalledAt'] == null)
                                                GestureDetector(
                                                  onTap: () => context.push(
                                                    '/media/${m['mediaId']}',
                                                    extra: "message-${m['id']}",
                                                  ),
                                                  child: MessageAttachment(
                                                    sourceTag:
                                                        "message-${m['id']}",
                                                    key: ValueKey(m['mediaId']),
                                                    id: m['mediaId'].toString(),
                                                    kind: m['kind'] ?? 'FILE',
                                                    name: m['text'] ?? '',
                                                  ),
                                                ),
                                              if (m['mediaId'] == null ||
                                                  m['recalledAt'] != null)
                                                Text(
                                                  m['recalledAt'] != null
                                                      ? tr(c, 'recalled')
                                                      : m['text'] ?? '',
                                                ),
                                            ],
                                          ),
                                        ),
                                        if (i == lastOutgoing)
                                          MessageStatus(
                                            status: ref
                                                .read(clientProvider)
                                                .messageStatus(m, members),
                                            onRetry: () => ref
                                                .read(clientProvider)
                                                .flush(),
                                          ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                ),
                // The input bar floats over the list so messages slide under
                // its glass; composerHeight is the list's bottom inset.
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: QChatGlass(
                    topBorder: true,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Column(
                          key: composerKey,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (selecting)
                              Row(
                                children: [
                                  Expanded(
                                    child: TButton(
                                      variant: TButtonVariant.text,
                                      onPressed: selected.isEmpty
                                          ? null
                                          : () => forward(
                                              messages
                                                  .where(
                                                    (m) => selected.contains(
                                                      m['id'],
                                                    ),
                                                  )
                                                  .toList(),
                                            ),
                                      child: Text(tr(c, 'forward')),
                                    ),
                                  ),
                                  Expanded(
                                    child: TButton(
                                      variant: TButtonVariant.text,
                                      onPressed: selected.isEmpty
                                          ? null
                                          : () => deleteMessages(
                                              messages
                                                  .where(
                                                    (m) => selected.contains(
                                                      m['id'],
                                                    ),
                                                  )
                                                  .toList(),
                                            ),
                                      child: Text(tr(c, 'delete')),
                                    ),
                                  ),
                                  Expanded(
                                    child: TButton(
                                      variant: TButtonVariant.text,
                                      onPressed: () => setState(() {
                                        selecting = false;
                                        selected.clear();
                                      }),
                                      child: Text(tr(c, 'cancel')),
                                    ),
                                  ),
                                ],
                              ),
                            ChatInputBar(
                              mediaBusy: uploading || pickingMedia,
                              controller: input,
                              focusNode: inputFocus,
                              voice: voice,
                              hasText: input.text.trim().isNotEmpty,
                              voiceLabel: tr(c, 'voice'),
                              emojiLabel: 'Emoji',
                              plusLabel: tr(c, 'file'),
                              sendLabel: tr(c, 'send'),
                              holdLabel: recordingVoice ? tr(c, 'recording') : tr(c, 'holdToTalk'),
                              onVoice: toggleVoice,
                              onEmoji: toggleEmoji,
                              onPlus: togglePlus,
                              onSend: send,
                              onHoldStart: beginVoiceHold,
                              onHoldEnd: endVoiceHold,
                              onChanged: (_) => setState(() {}),
                              replyPreview: reply == null
                                  ? null
                                  : QChatQuote(
                                      name: quoteSender(reply!),
                                      text: quoteLabel(reply!),
                                      cancelLabel: tr(c, 'cancel'),
                                      onCancel: () =>
                                          setState(() => reply = null),
                                    ),
                            ),
                          ],
                        ),
                        // Vùng đáy nằm trong cùng lớp kính: bàn phím | panel
                        // | safe area, để tin nhắn trượt xuống dưới được cả
                        // phần này thay vì một mảng đục ở đáy.
                        AnimatedContainer(
                          duration: insetDuration,
                          curve: Curves.easeOut,
                          height: reserved,
                          child: panelOpen
                              ? ClipRect(
                                  child: OverflowBox(
                                    alignment: Alignment.topCenter,
                                    minHeight: 0,
                                    maxHeight: panelHeight,
                                    child: SizedBox(
                                      height: panelHeight,
                                      child: emoji
                                          ? emojiPanel(c, safeBottom)
                                          : attachmentPanel(c, safeBottom),
                                    ),
                                  ),
                                )
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
