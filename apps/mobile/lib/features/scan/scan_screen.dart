import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// The colours the scanner draws its controls with. They are fixed rather than
/// taken from the app palette because the page is always the camera preview,
/// in light and dark mode alike.
const _controlFill = Color(0xff1f1f1f);
const _noteInk = Color(0xff9c9c9c);
const _newRed = Color(0xfffb4d4e);

/// A full-bleed QR scanner: the camera preview fills the page, the only chrome
/// is a back disc, a camera switch and the three shortcuts along the bottom.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen>
    with SingleTickerProviderStateMixin {
  final _scanner = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  late final AnimationController _glow = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  )..repeat(reverse: true);
  bool _found = false;
  bool _reading = false;

  @override
  void dispose() {
    _glow.dispose();
    unawaited(_scanner.dispose());
    super.dispose();
  }

  void _scan(BarcodeCapture capture) {
    if (_found) return;
    for (final barcode in capture.barcodes) {
      final uri = Uri.tryParse(barcode.rawValue ?? '');
      if (uri != null &&
          uri.scheme == 'qchat' &&
          uri.host == 'user' &&
          uri.pathSegments.length == 1) {
        _found = true;
        context.pushReplacement(
          '/user?q=${Uri.encodeComponent(uri.pathSegments.first)}&from=qr',
        );
        return;
      }
    }
  }

  Future<void> _switchCamera() async {
    if (!_scanner.value.isInitialized) return;
    try {
      await _scanner.switchCamera();
    } catch (_) {
      // A device without a second camera simply keeps the current one.
    }
  }

  /// Reads a code from a picture instead of the preview, the way the gallery
  /// shortcut does on the system camera.
  Future<void> _readPicture() async {
    if (_reading) return;
    setState(() => _reading = true);
    try {
      final picture = await ImagePicker().pickImage(
        source: ImageSource.gallery,
      );
      if (picture == null) return;
      final capture = await _scanner.analyzeImage(picture.path);
      final found = capture?.barcodes.isNotEmpty ?? false;
      if (!mounted) return;
      if (found) {
        _scan(capture!);
      } else {
        showQChatToast(context, tr(context, 'scanNoCode'));
      }
    } catch (_) {
      if (mounted) showQChatToast(context, tr(context, 'scanNoCode'));
    } finally {
      if (mounted) setState(() => _reading = false);
    }
  }

  @override
  Widget build(BuildContext context) => QChatPage(
    // The preview reaches behind the status bar and the home indicator.
    edgeToEdge: true,
    background: QChatColors.black,
    navigationBackground: QChatColors.black,
    child: ScanChrome(
      glow: _glow,
      preview: MobileScanner(
        controller: _scanner,
        fit: BoxFit.cover,
        onDetect: _scan,
        errorBuilder: (context, _) => const _CameraUnavailable(),
      ),
      onBack: () => context.pop(),
      onSwitchCamera: () => unawaited(_switchCamera()),
      onMyQr: () => context.push('/qr'),
      onGallery: () => unawaited(_readPicture()),
      onFeature: () => showQChatToast(context, tr(context, 'scanSoon')),
    ),
  );
}

/// The scanner's chrome over an arbitrary preview.
///
/// [ScanScreen] passes the live camera; tests pass a plain box, because a
/// camera never runs under `flutter test`. Everything the screen draws is here,
/// so the layout can be pinned without a platform channel.
class ScanChrome extends StatelessWidget {
  const ScanChrome({
    super.key,
    required this.preview,
    required this.onBack,
    required this.onSwitchCamera,
    required this.onMyQr,
    required this.onGallery,
    required this.onFeature,
    this.glow,
  });

  final Widget preview;
  final VoidCallback onBack, onSwitchCamera, onMyQr, onGallery, onFeature;

  /// Drives the breathing of the scan light. A still value is fine: the glow is
  /// drawn from whatever the animation reports.
  final Animation<double>? glow;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      preview,
      _ScanGlow(animation: glow),
      _topBar(context),
      _bottomBar(context),
    ],
  );

  Widget _topBar(BuildContext context) => SafeArea(
    bottom: false,
    child: Align(
      alignment: Alignment.topCenter,
      child: Padding(
        // The discs are laid out at their touch size; these margins put the
        // drawn circles 18 pt from the screen edges and their centres 32 pt
        // below the status bar, as the reference screen does.
        padding: const EdgeInsets.fromLTRB(6, 8, 8, 0),
        child: Row(
          children: [
            QChatCircleButton(
              'backBold',
              label: tr(context, 'back'),
              onTap: onBack,
              size: 24,
              hitSize: 48,
              iconSize: 21,
              background: QChatColors.white,
              color: QChatColors.black,
            ),
            const Spacer(),
            QChatIconButton(
              'switchCamera',
              label: tr(context, 'switchCamera'),
              onTap: onSwitchCamera,
              color: QChatColors.white,
              size: 26,
            ),
          ],
        ),
      ),
    ),
  );

  Widget _bottomBar(BuildContext context) => Positioned(
    left: 0,
    right: 0,
    bottom: 0,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: Row(
          children: [
            QChatCircleButton(
              'qrFilled',
              label: tr(context, 'scanMyQr'),
              onTap: onMyQr,
              iconSize: 27,
              background: _controlFill,
            ),
            const SizedBox(width: 12),
            Expanded(child: _FeaturePill(onTap: onFeature)),
            const SizedBox(width: 12),
            QChatCircleButton(
              'imageFilled',
              label: tr(context, 'scanGallery'),
              onTap: onGallery,
              iconSize: 27,
              background: _controlFill,
            ),
          ],
        ),
      ),
    ),
  );
}

/// The scan light: a green glow resting on an invisible line at 42.5 % of the
/// screen, fading upward into the preview.
class _ScanGlow extends StatelessWidget {
  const _ScanGlow({required this.animation});

  final Animation<double>? animation;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: LayoutBuilder(
      builder: (context, box) {
        Widget paint(double value) => CustomPaint(
          size: Size(box.maxWidth, box.maxHeight),
          painter: _GlowPainter(
            bottom: box.maxHeight * .425,
            breathe: value,
          ),
        );
        final animation = this.animation;
        if (animation == null) return paint(1);
        return AnimatedBuilder(
          animation: animation,
          builder: (context, _) => paint(animation.value),
        );
      },
    ),
  );
}

class _GlowPainter extends CustomPainter {
  _GlowPainter({required this.bottom, required this.breathe});

  final double bottom;
  final double breathe;

  @override
  void paint(Canvas canvas, Size size) {
    // A radial gradient stretched sideways: the light sits on a wide ellipse,
    // so it reaches the edges of the screen while staying a thin band. The band
    // is clipped at [bottom], which gives the glow the flat lower edge of a
    // light resting on a surface.
    const radius = 72.0;
    const band = 104.0;
    final strength = .86 + .14 * breathe;
    canvas.save();
    canvas.clipRect(Rect.fromLTRB(0, bottom - band, size.width, bottom));
    canvas.translate(size.width / 2, bottom);
    canvas.scale(3.4, 1);
    canvas.drawCircle(
      Offset.zero,
      radius,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset.zero,
          radius,
          [
            const Color(0xff1ecf90).withValues(alpha: .84 * strength),
            const Color(0xff10a06a).withValues(alpha: .46 * strength),
            const Color(0xff0a6b4c).withValues(alpha: .13 * strength),
            const Color(0x00000000),
          ],
          const [0, .34, .70, 1],
        ),
    );
    canvas.restore();
    // The line the light rests on: brightest under the middle, still visible at
    // the edges, then black below it.
    canvas.drawRect(
      Rect.fromLTWH(0, bottom - 1, size.width, 1.1),
      Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, bottom),
          Offset(size.width, bottom),
          [
            const Color(0xff1d5a47).withValues(alpha: .55 * strength),
            const Color(0xff43c293).withValues(alpha: .95 * strength),
            const Color(0xff1d5a47).withValues(alpha: .55 * strength),
          ],
          const [0, .5, 1],
        ),
    );
  }

  @override
  bool shouldRepaint(_GlowPainter old) =>
      old.bottom != bottom || old.breathe != breathe;
}

/// The shortcut that carries the new feature: two dots, a headline, a "new"
/// badge and a second line, all inside a capsule as tall as the discs.
class _FeaturePill extends StatelessWidget {
  const _FeaturePill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: tr(context, 'scanFeatureTitle'),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 57,
        padding: const EdgeInsets.fromLTRB(20, 0, 17, 0),
        decoration: const BoxDecoration(
          color: _controlFill,
          borderRadius: BorderRadius.all(Radius.circular(28.5)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (var index = 0; index < 2; index++) ...[
                  if (index > 0) const SizedBox(width: 4.5),
                  Container(
                    width: 4.5,
                    height: 4.5,
                    decoration: const BoxDecoration(
                      color: QChatColors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
                const SizedBox(width: 9),
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      tr(context, 'scanFeatureTitle'),
                      maxLines: 1,
                      style: const TextStyle(
                        fontSize: 17,
                        height: 1.15,
                        fontWeight: FontWeight.w600,
                        color: QChatColors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const _NewBadge(),
              ],
            ),
            const SizedBox(height: 2),
            // The reference keeps the note on one line, so the line shrinks
            // rather than losing its tail when a translation runs long.
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                tr(context, 'scanFeatureNote'),
                maxLines: 1,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.15,
                  color: _noteInk,
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _NewBadge extends StatelessWidget {
  const _NewBadge();

  @override
  Widget build(BuildContext context) => Container(
    height: 18,
    padding: const EdgeInsets.symmetric(horizontal: 8),
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      color: _newRed,
      borderRadius: BorderRadius.all(Radius.circular(9)),
    ),
    child: Text(
      tr(context, 'scanNew'),
      style: const TextStyle(
        fontSize: 11.5,
        height: 1,
        fontWeight: FontWeight.w600,
        color: QChatColors.white,
      ),
    ),
  );
}

/// Shown in place of the preview when the platform has no camera or permission
/// was refused.
class _CameraUnavailable extends StatelessWidget {
  const _CameraUnavailable();

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: QChatColors.black,
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const QChatIcon('scan', color: QChatColors.white38, size: 46),
          const SizedBox(height: 14),
          Text(
            tr(context, 'scanCameraUnavailable'),
            style: const TextStyle(fontSize: 15, color: QChatColors.white70),
          ),
        ],
      ),
    ),
  );
}
