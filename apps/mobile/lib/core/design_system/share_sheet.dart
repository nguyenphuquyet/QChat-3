import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../localization/strings.dart';
import 'overlays.dart';
import 'qchat_colors.dart';
import 'qchat_icons.dart';
import 'qchat_pressable.dart';
import 'qchat_theme.dart';

/// One recent recipient shown in the avatar strip of [QChatShareSheet].
///
/// The strip is the fastest way to send something again: tapping an avatar
/// closes the sheet with [id], so the caller knows where the item goes.
class QChatShareTarget {
  const QChatShareTarget({
    required this.id,
    required this.name,
    required this.avatar,
  });

  final String id;
  final String name;

  /// Avatar artwork, drawn at [_tileSize] and clipped to the tile radius.
  final Widget avatar;
}

/// One tile in the action grid of [QChatShareSheet].
class QChatShareAction {
  const QChatShareAction({
    required this.icon,
    required this.label,
    this.onTap,
    this.color,
    this.note,
    this.badge,
  });

  /// Name understood by [QChatIcon].
  final String icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  /// Second, lighter line under the label, e.g. "2K lần sử dụng".
  final String? note;

  /// Red pill pinned to the top-right corner of the tile, e.g. "Mới".
  final String? badge;
}

const _tileSize = 66.0;
const _tileGap = 10.0;
const _sheetRadius = 20.0;

/// The share panel used across the app: recent recipients on top, app actions
/// in a horizontal two-row grid, and a Cancel row at the bottom.
///
/// The look is the one the product approved: a soft grey sheet with white
/// rounded action tiles, a dashed "add" tile beside the recent avatars and a
/// muted indigo Cancel label. Everything is drawn with QChat primitives, so no
/// Material sheet, ripple or drag handle is involved.
class QChatShareSheet extends StatelessWidget {
  const QChatShareSheet({
    super.key,
    this.title,
    this.targets = const [],
    this.actions = const [],
    this.onAdd,
    this.addLabel,
    this.rows = 2,
  });

  final String? title;
  final List<QChatShareTarget> targets;
  final List<QChatShareAction> actions;

  /// Opens a full picker when the receiver is not one of [targets].
  final VoidCallback? onAdd;

  /// Optional caption under the dashed tile; the reference design leaves it
  /// empty, so it stays null unless a caller wants a hint.
  final String? addLabel;

  /// Actions stacked in one column. Two rows match the reference design; one
  /// row is a single strip of tiles.
  final int rows;

  @override
  Widget build(BuildContext c) {
    final dark = qchatDark(c);
    final backdrop = dark ? const Color(0xff1c1c1c) : const Color(0xffececec);
    final line = dark ? const Color(0xff2f2f2f) : const Color(0xffdedede);
    final card = dark ? const Color(0xff2c2c2c) : QChatColors.white;
    final label = dark ? const Color(0xffc9c9c9) : const Color(0xff4d4d4d);
    final note = dark ? const Color(0xff8b8b8b) : const Color(0xff9a9a9a);
    final cancelColor = dark
        ? const Color(0xff9db0e0)
        : const Color(0xff5b6b9c);

    final columns = <List<QChatShareAction>>[];
    for (var i = 0; i < actions.length; i += rows) {
      columns.add(actions.sublist(i, math.min(i + rows, actions.length)));
    }

    final hasTargets = targets.isNotEmpty || onAdd != null;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: backdrop,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(_sheetRadius),
        ),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(_sheetRadius),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.zero,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (title != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                    child: Text(
                      title!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 21,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -.2,
                        color: qchatInk(c),
                      ),
                    ),
                  ),
                if (hasTargets)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 18, 0, 20),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final target in targets) ...[
                            _ShareTargetTile(
                              target: target,
                              label: label,
                              onTap: () => Navigator.maybePop(c, target.id),
                            ),
                            const SizedBox(width: _tileGap),
                          ],
                          if (onAdd != null)
                            _AddTargetTile(
                              label: addLabel,
                              caption: label,
                              onTap: onAdd!,
                            ),
                          const SizedBox(width: 16),
                        ],
                      ),
                    ),
                  ),
                if (hasTargets && (actions.isNotEmpty)) _Divider(color: line),
                if (actions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 26, 0, 26),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (var i = 0; i < columns.length; i++) ...[
                            Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                for (var j = 0; j < columns[i].length; j++) ...[
                                  if (j > 0) const SizedBox(height: 20),
                                  _ShareActionTile(
                                    action: columns[i][j],
                                    card: card,
                                    label: label,
                                    note: note,
                                  ),
                                ],
                              ],
                            ),
                            if (i < columns.length - 1)
                              const SizedBox(width: _tileGap),
                          ],
                          const SizedBox(width: 16),
                        ],
                      ),
                    ),
                  ),
                _Divider(color: line),
                QChatPressable(
                  background: QChatColors.transparent,
                  onTap: () => Navigator.maybePop(c),
                  child: SizedBox(
                    height: 56,
                    child: Center(
                      child: Text(
                        tr(c, 'cancel'),
                        style: TextStyle(
                          fontSize: 18,
                          height: 1.2,
                          fontWeight: FontWeight.w500,
                          color: cancelColor,
                        ),
                      ),
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
}

/// Slides [QChatShareSheet] up over the current screen and returns the id of
/// the recipient the user picked, or null when they cancelled or only tapped an
/// action. Action callbacks run after the sheet closes.
Future<String?> showQChatShareSheet(
  BuildContext context, {
  String? title,
  List<QChatShareTarget> targets = const [],
  List<QChatShareAction> actions = const [],
  int rows = 2,
  VoidCallback? onAdd,
  String? addLabel,
}) => showGeneralDialog<String>(
  context: context,
  barrierDismissible: true,
  barrierLabel: tr(context, 'cancel'),
  barrierColor: qchatOverlayBarrier,
  transitionDuration: qchatOverlayDuration,
  pageBuilder: (c, _, _) {
    final media = MediaQuery.of(c);
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: media.size.width,
          maxHeight: media.size.height * .92,
        ),
        child: QChatShareSheet(
          title: title,
          targets: targets,
          actions: actions,
          rows: rows,
          onAdd: onAdd,
          addLabel: addLabel,
        ),
      ),
    );
  },
  transitionBuilder: (c, animation, _, child) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return SlideTransition(
      position: Tween(
        begin: const Offset(0, 1),
        end: Offset.zero,
      ).animate(curved),
      child: child,
    );
  },
);

class _Divider extends StatelessWidget {
  const _Divider({required this.color});
  final Color color;
  @override
  Widget build(BuildContext c) => Container(height: .5, color: color);
}

class _ShareTargetTile extends StatelessWidget {
  const _ShareTargetTile({
    required this.target,
    required this.label,
    required this.onTap,
  });
  final QChatShareTarget target;
  final Color label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => QChatPressable(
    background: QChatColors.transparent,
    onTap: onTap,
    child: SizedBox(
      width: _tileSize,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox.square(dimension: _tileSize, child: target.avatar),
          ),
          const SizedBox(height: 8),
          Text(
            target.name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, height: 1.2, color: label),
          ),
        ],
      ),
    ),
  );
}

class _AddTargetTile extends StatelessWidget {
  const _AddTargetTile({
    required this.label,
    required this.caption,
    required this.onTap,
  });
  final String? label;
  final Color caption;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext c) => QChatPressable(
    background: QChatColors.transparent,
    onTap: onTap,
    child: Semantics(
      label: label ?? tr(c, 'sendToChat'),
      child: SizedBox(
        width: _tileSize,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox.square(
              dimension: _tileSize,
              child: CustomPaint(
                painter: _DashedBorderPainter(
                  color: qchatDark(c)
                      ? const Color(0xff4a4a4a)
                      : const Color(0xffbdbdbd),
                  radius: 8,
                ),
                child: Center(
                  child: Container(
                    width: 26,
                    height: 2,
                    color: qchatDark(c)
                        ? const Color(0xff8b8b8b)
                        : const Color(0xffa8a8a8),
                  ),
                ),
              ),
            ),
            if (label != null) ...[
              const SizedBox(height: 8),
              Text(
                label!,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, height: 1.2, color: caption),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _ShareActionTile extends StatelessWidget {
  const _ShareActionTile({
    required this.action,
    required this.card,
    required this.label,
    required this.note,
  });
  final QChatShareAction action;
  final Color card;
  final Color label;
  final Color note;
  @override
  Widget build(BuildContext c) => QChatPressable(
    background: QChatColors.transparent,
    onTap: () {
      Navigator.maybePop(c);
      final run = action.onTap;
      if (run == null) return;
      // Let the sheet route finish its exit before the action opens anything.
      WidgetsBinding.instance.addPostFrameCallback((_) => run());
    },
    child: SizedBox(
      width: _tileSize,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: _tileSize,
                height: _tileSize,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: card,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: QChatIcon(
                  action.icon,
                  size: 32,
                  color: action.color ?? qchatInk(c),
                ),
              ),
              if (action.badge != null)
                Positioned(
                  top: -7,
                  right: -4,
                  child: _Badge(text: action.badge!),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            action.label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, height: 1.22, color: label),
          ),
          if (action.note != null) ...[
            const SizedBox(height: 2),
            Text(
              action.note!,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, height: 1.2, color: note),
            ),
          ],
        ],
      ),
    ),
  );
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});
  final String text;
  @override
  Widget build(BuildContext c) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xfff4514b),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      child: Text(
        text,
        style: const TextStyle(
          color: QChatColors.white,
          fontSize: 11.5,
          height: 1.15,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
  );
}

class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color, required this.radius});
  final Color color;
  final double radius;
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
          Radius.circular(radius),
        ),
      );
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6;
    const dash = 7.0, gap = 6.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + dash), paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color || old.radius != radius;
}
