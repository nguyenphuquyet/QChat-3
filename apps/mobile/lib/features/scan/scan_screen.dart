import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/design_system/components.dart';
import '../../core/localization/strings.dart';

/// The colours the scanner draws its controls with. They are fixed rather than
/// taken from the app palette because the page is always the camera preview,
/// in light and dark mode alike.
/// The scanner's controls float over a live camera, so their fill is smoked
/// glass: a translucent tint over a blur of whatever the preview shows, not an
/// opaque grey. The white back disc is the only solid control.
const _controlTint = Color(0xff1f1f1f);
const _controlOpacity = .74;
const _controlBlur = 22.0;
const _noteInk = Color(0xff9c9c9c);
const _newRed = Color(0xfffb4d4e);

/// A full-bleed QR scanner: the camera preview fills the page, the only chrome
/// is a back disc, a camera switch and the three shortcuts along the bottom.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _scanner = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _found = false;
  bool _reading = false;

  @override
  void dispose() {
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
  });

  final Widget preview;
  final VoidCallback onBack, onSwitchCamera, onMyQr, onGallery, onFeature;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [preview, _topBar(context), _bottomBar(context)],
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
              background: _controlTint.withValues(alpha: _controlOpacity),
              blur: _controlBlur,
            ),
            const SizedBox(width: 12),
            Expanded(child: _FeaturePill(onTap: onFeature)),
            const SizedBox(width: 12),
            QChatCircleButton(
              'imageFilled',
              label: tr(context, 'scanGallery'),
              onTap: onGallery,
              iconSize: 27,
              background: _controlTint.withValues(alpha: _controlOpacity),
              blur: _controlBlur,
            ),
          ],
        ),
      ),
    ),
  );
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
      child: QChatGlass(
        color: _controlTint,
        opacity: _controlOpacity,
        border: false,
        blur: _controlBlur,
        radius: const BorderRadius.all(Radius.circular(28.5)),
        child: Container(
          height: 57,
          padding: const EdgeInsets.fromLTRB(20, 0, 17, 0),
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
