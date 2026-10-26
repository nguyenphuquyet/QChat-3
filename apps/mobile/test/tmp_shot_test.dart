import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/miniapps/qapp/qapp_renderer.dart';
import 'package:qchat/features/miniapps/qapp/qapp_tree.dart';

const outDir = r'C:\Users\QuyetGuic\AppData\Local\Temp\opencode';

Map<String, dynamic> trees() =>
    jsonDecode(File('$outDir\\trees.json').readAsStringSync())
        as Map<String, dynamic>;

Future<void> loadRoboto() async {
  const dir = r'E:\flutter\bin\cache\artifacts\material_fonts';
  final loader = FontLoader('Roboto');
  for (final name in ['roboto-regular.ttf', 'roboto-bold.ttf']) {
    final bytes = File('$dir\\$name').readAsBytesSync();
    loader.addFont(Future.value(ByteData.sublistView(bytes)));
  }
  await loader.load();
}

void main() {
  setUpAll(loadRoboto);
  final data = trees();
  for (final name in data.keys) {
    testWidgets('shot $name', (tester) async {
      tester.view.physicalSize = const Size(1125, 2436);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final tree = QappTree.fromJson(data[name] as Map<String, dynamic>);
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: ThemeData(fontFamily: 'Roboto'),
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(375, 812),
              padding: EdgeInsets.only(top: 44, bottom: 34),
              viewPadding: EdgeInsets.only(top: 44, bottom: 34),
            ),
            child: RepaintBoundary(
              key: key,
              child: Material(
                type: MaterialType.transparency,
                child: QappRenderer(
                  root: tree.root!,
                  onEvent: (_, _, _) {},
                  loadAsset: (_) async => null,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File(
        '$outDir\\shot_$name.png',
      ).writeAsBytesSync(bytes!.buffer.asUint8List());
      image.dispose();
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
}
