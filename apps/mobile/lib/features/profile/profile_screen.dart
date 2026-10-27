import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageRoute;
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../app/providers.dart';
import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';
import '../../core/design_system/reference_widgets.dart';
import '../../core/design_system/media_widgets.dart';
import '../../core/network/media_upload.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.qr = false});
  final bool qr;
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final name = TextEditingController(), bio = TextEditingController();
  late Future<dynamic> profile;
  StreamSubscription<void>? updates;
  bool initialized = false;
  String? error;
  bool uploading = false;
  final qrCardKey = GlobalKey();
  int qrStyle = 0;
  bool qrExpanded = true;
  static const qrStyles = [Color(0xff111111), Color(0xff168fe5), Color(0xffe8b323)];

  Widget _qrPage(BuildContext c, Map u) {
    final qrSize = (MediaQuery.sizeOf(c).width * .5)
        .clamp(170.0, 230.0)
        .toDouble();
    final link = qchatDark(c)
        ? const Color(0xff8ba0c6)
        : const Color(0xff576b95);
    return ListView(
      padding: const EdgeInsets.fromLTRB(8, 20, 8, 28),
      children: [
        RepaintBoundary(
          key: qrCardKey,
          child: QChatQrCard(
            child: Column(
              children: [
                QChatQrHeader(
                  icon: 'friendQr',
                  iconColor: const Color(0xffe8b323),
                  title: 'Kết bạn với tôi',
                  expanded: qrExpanded,
                  onTap: () => setState(() => qrExpanded = !qrExpanded),
                  onMore: () => qchatSheet(c, [
                    ('Lưu hình ảnh', () => saveQr()),
                    (
                      'Thay đổi phong cách',
                      () => setState(
                        () => qrStyle = (qrStyle + 1) % qrStyles.length,
                      ),
                    ),
                  ]),
                ),
                if (qrExpanded) ...[
                  const SizedBox(height: 32),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      UserAvatar(u, size: 40),
                      const SizedBox(width: 14),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            u['nickname'] ?? '',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w600,
                              color: ink(c),
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            (u['region'] as String?)?.isNotEmpty == true
                                ? u['region']
                                : 'Việt Nam',
                            style: const TextStyle(
                              fontSize: 15,
                              color: Color(0xffb2b2b2),
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      QrImageView(
                        data: 'qchat://user/${u['qchatId']}',
                        size: qrSize,
                        padding: EdgeInsets.zero,
                        backgroundColor: QChatColors.white,
                        errorCorrectionLevel: QrErrorCorrectLevel.H,
                        eyeStyle: QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: qrStyles[qrStyle],
                        ),
                        dataModuleStyle: QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: qrStyles[qrStyle],
                        ),
                      ),
                      QChatQrMark(
                        size: (qrSize * .27).clamp(44.0, 58.0).toDouble(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 236),
                    child: const Text(
                      'Quét mã QR để thêm tôi làm bạn bè.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.4,
                        color: Color(0xffb2b2b2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 34),
                  Container(
                    height: .5,
                    color: ink(c).withValues(alpha: .08),
                  ),
                  SizedBox(
                    height: 46,
                    child: Row(
                      children: [
                        QChatQrAction('Quét', link, () => c.push('/scan')),
                        Container(
                          width: .5,
                          height: 18,
                          color: ink(c).withValues(alpha: .1),
                        ),
                        QChatQrAction(
                          'Thay đổi phong cách',
                          link,
                          () => setState(
                            () => qrStyle = (qrStyle + 1) % qrStyles.length,
                          ),
                        ),
                        Container(
                          width: .5,
                          height: 18,
                          color: ink(c).withValues(alpha: .1),
                        ),
                        QChatQrAction('Lưu hình ảnh', link, saveQr),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const QChatQrCard(
          child: QChatQrHeader(
            icon: 'folderOpen',
            iconColor: Color(0xff168fe5),
            title: 'Nhận Ảnh & Tệp tin gần đây',
            subtitle: 'Quét mã QR để gửi ảnh, video và tệp cho tôi.',
            expanded: false,
          ),
        ),
        const SizedBox(height: 12),
        QChatQrCard(
          child: QChatQrHeader(
            icon: 'gift',
            iconColor: const Color(0xfffa5151),
            title: 'Nhận Hồng bao xung quanh',
            subtitle: 'Quét mã QR để gửi Lì xì cho tôi.',
            expanded: false,
            onMore: () => qchatSheet(c, [
              ('Quét', () => c.push('/scan')),
            ]),
          ),
        ),
      ],
    );
  }

  Future<void> saveQr() async {
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary = qrCardKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return;
      final image = await boundary.toImage(pixelRatio: 3);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (data == null) return;
      await FilePicker.saveFile(fileName: 'qchat-qr.png', bytes: data.buffer.asUint8List(), mimeType: 'image/png');
    } catch (_) {
      if (mounted) setState(() => error = tr(context, 'networkError'));
    }
  }
  Future<void> avatar() async {
    if (uploading) return;
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      final file = await pickImageWithSource(context);
      if (file == null || !mounted) return;
      final client = ref.read(clientProvider);
      final id = await uploadMedia(client, file);
      await client.post('/users/me/avatar', {'mediaId': id});
      if (mounted) {
        setState(() => profile = client.get('/users/me', cached: false));
      }
      client.changes.add(null);
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

  Future<void> edit(String field, String label, String initial) async {
    final controller = TextEditingController(text: initial);
    bool saving = false;
    String? failure;
    final route = CupertinoPageRoute<void>(
      builder: (c) => StatefulBuilder(
        builder: (c, update) => QChatPage(
          title: tr(c, label),
          glassHeader: false,
          leading: QChatIconButton(
            'back',
            label: tr(c, 'back'),
            onTap: () => Navigator.pop(c),
          ),
          trailing: GestureDetector(
            onTap: saving
                ? null
                : () async {
                    update(() => saving = true);
                    try {
                      await ref
                          .read(clientProvider)
                          .dio
                          .patch(
                            '/users/me',
                            data: {field: controller.text.trim()},
                          );
                      if (c.mounted) Navigator.pop(c);
                      if (mounted) {
                        setState(
                          () => profile = ref
                              .read(clientProvider)
                              .get('/users/me', cached: false),
                        );
                      }
                    } catch (_) {
                      if (c.mounted) {
                        update(() {
                          saving = false;
                          failure = tr(c, 'networkError');
                        });
                      }
                    }
                  },
            child: Center(
              child: saving
                  ? const QChatLoading()
                  : Text(
                      tr(c, 'save'),
                      style: const TextStyle(color: QChatColors.green),
                    ),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                QChatTextInput(
                  controller: controller,
                  hint: tr(c, label),
                  lines: field == 'bio' ? 3 : 1,
                ),
                if (failure != null) Text(failure!),
              ],
            ),
          ),
        ),
      ),
    );
    await Navigator.of(context).push<void>(route);
    await route.completed;
    controller.dispose();
  }

  @override
  void initState() {
    super.initState();
    profile = ref.read(clientProvider).get('/users/me');
    updates = ref.read(clientProvider).changes.stream.listen((_) {
      if (mounted) {
        setState(() => profile = ref.read(clientProvider).get('/users/me'));
      }
    });
  }

  @override
  void dispose() {
    updates?.cancel();
    name.dispose();
    bio.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext c) => QChatPage(
    title: tr(c, widget.qr ? 'qr' : 'profile'),
    glassHeader: !widget.qr,
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: FutureBuilder<dynamic>(
      future: profile,
      builder: (c, s) {
        if (s.hasError) {
          return QChatError(
            error: s.error!,
            retry: () => setState(
              () => profile = ref.read(clientProvider).get('/users/me'),
            ),
          );
        }
        if (!s.hasData) return const QChatLoading();
        final u = s.data;
        if (!initialized) {
          name.text = u['nickname'];
          bio.text = u['bio'];
          initialized = true;
        }
        if (widget.qr) return _qrPage(c, u);
        return ListView(
          children: [
            if (error != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  error!,
                  style: const TextStyle(color: QChatColors.danger),
                ),
              ),
            MenuRow(
              'avatar',
              onTap: avatar,
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox.square(
                    dimension: 34,
                    child: uploading
                        ? const QChatLoading()
                        : UserAvatar(u, size: 34),
                  ),
                  const SizedBox(width: 9),
                  const QChatIcon(
                    'chevron',
                    size: 18,
                    color: QChatColors.muted,
                  ),
                ],
              ),
            ),
            MenuRow(
              'name',
              value: u['nickname'],
              onTap: () => edit('nickname', 'name', u['nickname']),
            ),
            MenuRow(
              'gender',
              value: tr(
                c,
                (u['gender'] as String? ?? '').isEmpty ? 'notSet' : u['gender'],
              ),
              onTap: () => qchatSheet(c, [
                for (final value in ['male', 'female', 'other'])
                  (
                    tr(c, value),
                    () async {
                      try {
                        await ref
                            .read(clientProvider)
                            .dio
                            .patch('/users/me', data: {'gender': value});
                        if (mounted) {
                          setState(
                            () => profile = ref
                                .read(clientProvider)
                                .get('/users/me', cached: false),
                          );
                        }
                      } catch (_) {
                        if (mounted) {
                          setState(() => error = tr(context, 'networkError'));
                        }
                      }
                    },
                  ),
              ]),
            ),
            MenuRow(
              'region',
              value: u['region'] ?? '',
              onTap: () => edit('region', 'region', u['region'] ?? ''),
            ),
            MenuRow(
              'phone',
              value: u['phone'] ?? '',
              onTap: () => edit('phone', 'phone', u['phone'] ?? ''),
            ),
            MenuRow(
              'ID',
              value: u['qchatId'],
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: u['qchatId']));
                if (c.mounted) qchatSheet(c, [(tr(c, 'copied'), () {})]);
              },
            ),
            MenuRow(
              'qr',
              trailing: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  QChatIcon('qr', color: QChatColors.muted, size: 22),
                  SizedBox(width: 9),
                  QChatIcon('chevron', size: 18, color: QChatColors.muted),
                ],
              ),
              onTap: () => c.push('/qr'),
            ),
            MenuRow(
              'poke',
              value: u['poke'] ?? '',
              onTap: () => edit('poke', 'poke', u['poke'] ?? ''),
            ),
            MenuRow(
              'status',
              value: (u['bio'] ?? '').toString().isEmpty
                  ? tr(c, 'notSet')
                  : u['bio'],
              onTap: () => edit('bio', 'status', u['bio'] ?? ''),
            ),
            sectionGap,
            MenuRow('ringtone', onTap: () => c.push('/settings/calls')),
            sectionGap,
            const MenuRow('addresses'),
            const MenuRow('invoice'),
            sectionGap,
            const MenuRow('beans'),
          ],
        );
      },
    ),
  );
}

class QChatQrCard extends StatelessWidget {
  const QChatQrCard({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext c) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: surface(c),
      borderRadius: BorderRadius.circular(12),
    ),
    child: child,
  );
}

class QChatQrHeader extends StatelessWidget {
  const QChatQrHeader({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    this.subtitle,
    this.expanded = false,
    this.onTap,
    this.onMore,
  });
  final String icon, title;
  final String? subtitle;
  final Color iconColor;
  final bool expanded;
  final VoidCallback? onTap, onMore;
  @override
  Widget build(BuildContext c) {
    const muted = Color(0xffb2b2b2);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          14,
          subtitle == null ? 16 : 14,
          10,
          subtitle == null ? 12 : 14,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 26,
              height: 24,
              child: Align(
                alignment: Alignment.centerLeft,
                child: QChatIcon(icon, color: iconColor, size: 23),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 17,
                      height: 1.25,
                      color: ink(c),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        height: 1.3,
                        color: Color(0xffa3a3a3),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (onMore != null)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onMore,
                child: const SizedBox(
                  width: 34,
                  height: 24,
                  child: Center(
                    child: QChatIcon('more', color: muted, size: 20),
                  ),
                ),
              ),
            SizedBox(
              width: 34,
              height: 24,
              child: Center(
                child: RotatedBox(
                  quarterTurns: expanded ? -1 : 1,
                  child: const QChatIcon('chevron', color: muted, size: 19),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class QChatQrAction extends StatelessWidget {
  const QChatQrAction(this.label, this.color, this.onTap, {super.key});
  final String label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => Expanded(
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Center(
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 15, color: color),
        ),
      ),
    ),
  );
}

class QChatQrMark extends StatelessWidget {
  const QChatQrMark({super.key, required this.size});
  final double size;
  @override
  Widget build(BuildContext c) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: const Color(0xff1c1c1c),
      borderRadius: BorderRadius.circular(size * .2),
    ),
    child: CustomPaint(painter: _QrMarkPainter()),
  );
}

class _QrMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 100, size.height / 100);
    final white = Paint()
      ..color = QChatColors.white
      ..style = PaintingStyle.fill;
    final black = Paint()
      ..color = const Color(0xff1c1c1c)
      ..style = PaintingStyle.fill;

    // Smaller bubble, upper right.
    canvas.drawPath(
      Path()
        ..addRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(44, 14, 40, 32),
            const Radius.circular(15),
          ),
        )
        ..moveTo(72, 41)
        ..lineTo(80, 56)
        ..lineTo(61, 44)
        ..close(),
      white,
    );
    canvas.drawCircle(const Offset(56, 29), 3.4, black);
    canvas.drawCircle(const Offset(71, 29), 3.4, black);

    // Bigger bubble, lower left.
    canvas.drawPath(
      Path()
        ..addRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(10, 30, 50, 38),
            const Radius.circular(17),
          ),
        )
        ..moveTo(21, 66)
        ..lineTo(14, 82)
        ..lineTo(34, 68)
        ..close(),
      white,
    );
    canvas.drawCircle(const Offset(27, 48), 4, black);
    canvas.drawCircle(const Offset(45, 48), 4, black);
  }

  @override
  bool shouldRepaint(_QrMarkPainter old) => false;
}

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  bool scanned = false;
  @override
  Widget build(BuildContext c) => QChatPage(
    // Let the camera preview reach behind the system home/navigation bar.
    edgeToEdge: true,
    navigationBackground: QChatColors.black,
    title: tr(c, 'scan'),
    leading: QChatIconButton(
      'back',
      label: tr(c, 'back'),
      onTap: () => c.pop(),
    ),
    child: MobileScanner(
      onDetect: (capture) {
        if (scanned) return;
        for (final barcode in capture.barcodes) {
          final uri = Uri.tryParse(barcode.rawValue ?? '');
          if (uri?.scheme == 'qchat' &&
              uri?.host == 'user' &&
              uri!.pathSegments.length == 1) {
            scanned = true;
            context.pushReplacement(
              '/user?q=${Uri.encodeComponent(uri.pathSegments.first)}&from=qr',
            );
            break;
          }
        }
      },
    ),
  );
}
