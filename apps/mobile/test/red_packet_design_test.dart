import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qchat/features/chats/red_packet_cover.dart';
import 'package:qchat/features/chats/red_packet_design.dart';

import 'test_app.dart';

void main() {
  test('a cover design round-trips through its JSON form', () {
    const design = CoverDesign(
      background: CoverBackground(
        type: 'gradient',
        colors: [Color(0xffd93b30), Color(0xfff3d19c)],
      ),
      bottomColor: Color(0xffc0342a),
      topHeight: .62,
      receiptHeight: .55,
      overlayColor: Color(0x99000000),
      openColor: Color(0xffe8b323),
      openLabel: 'Nhận',
      decorations: [
        CoverDecoration(
          id: 'blossom',
          value: '🌸',
          x: .2,
          y: .4,
          size: .3,
          rotation: .5,
          animation: 'float',
          area: 'all',
        ),
      ],
      effects: CoverEffects(sparkles: true, float: true),
      message: CoverMessage(
        imageId: 'message-photo',
        startColor: Color(0xfff2a63a),
        endColor: Color(0xfff7c65a),
      ),
    );

    final parsed = CoverDesign.fromJson(design.toJsonString());

    expect(parsed.topHeight, .62);
    expect(parsed.receiptHeight, .55);
    expect(parsed.bottomColor, const Color(0xffc0342a));
    expect(parsed.overlayColor, const Color(0x99000000));
    expect(parsed.openLabel, 'Nhận');
    expect(parsed.background.type, 'gradient');
    expect(parsed.background.colors, const [
      Color(0xffd93b30),
      Color(0xfff3d19c),
    ]);
    expect(parsed.decorations.single.value, '🌸');
    expect(parsed.decorations.single.animation, 'float');
    expect(parsed.decorations.single.area, 'all');
    expect(parsed.effects.sparkles, isTrue);
    expect(parsed.effects.float, isTrue);
    expect(parsed.effects.pulse, isFalse);
    expect(parsed.message.imageId, 'message-photo');
    expect(parsed.message.startColor, const Color(0xfff2a63a));
    expect(parsed.message.endColor, const Color(0xfff7c65a));
    expect(parsed.message.hasImage, isTrue);
  });

  test('a video cover keeps its clip and legacy GIF covers still parse', () {
    const webm = CoverDesign(
      background: CoverBackground(type: 'webm', mediaId: 'clip-1'),
    );
    final parsed = CoverDesign.fromJson(webm.toJsonString());

    expect(parsed.background.type, 'webm');
    expect(parsed.background.mediaId, 'clip-1');
    expect(parsed.background.isVideo, isTrue);
    expect(parsed.background.isImage, isFalse);
    expect(parsed.background.hasMedia, isTrue);
    expect(parsed.background.videoExtension, 'webm');

    const mp4 = CoverDesign(
      background: CoverBackground(type: 'mp4', mediaId: 'clip-2'),
    );
    final h264 = CoverDesign.fromJson(mp4.toJsonString());

    expect(h264.background.type, 'mp4');
    expect(h264.background.isVideo, isTrue);
    expect(h264.background.videoExtension, 'mp4');

    final legacy = CoverDesign.fromJson({
      'background': {'type': 'gif', 'mediaId': 'old-gif'},
    });
    expect(legacy.background.type, 'gif');
    expect(legacy.background.isImage, isTrue);
    expect(legacy.background.isVideo, isFalse);
  });

  test('a cover without a message design falls back to warm gold', () {
    final parsed = CoverDesign.fromJson({'topHeight': .7});

    expect(parsed.message.hasImage, isFalse);
    expect(parsed.message.startColor, redPacketGold);
    expect(parsed.message.endColor, const Color(0xfff7c65a));
  });

  test('out-of-range heights and colours fall back safely', () {
    final parsed = CoverDesign.fromJson({
      'topHeight': 5,
      'receiptHeight': 0,
      'overlayColor': 'not-a-colour',
    });

    expect(parsed.topHeight, .92);
    expect(parsed.receiptHeight, .12);
    expect(parsed.overlayColor, const Color(0x80000000));
    expect(CoverDesign.fromJson('{broken').topHeight, .80);
  });

  test('colour parsing accepts #rrggbb and #aarrggbb', () {
    expect(
      coverColor('#ff0000', const Color(0xff000000)),
      const Color(0xffff0000),
    );
    expect(
      coverColor('#80d93b30', const Color(0xff000000)),
      const Color(0x80d93b30),
    );
    expect(
      coverColor('nope', const Color(0xff123456)),
      const Color(0xff123456),
    );
  });

  test('cover metadata reads the designer identity and ownership', () {
    final cover = RedPacketCoverData.fromJson({
      'id': 'cover-1',
      'name': 'Mai vàng',
      'status': 'PUBLISHED',
      'claimCount': 12,
      'selected': true,
      'owned': true,
      'designer': {
        'userId': 'designer-1',
        'displayName': 'Lan',
        'user': {'qchatId': 'lan01', 'avatarId': 'avatar-1'},
      },
      'design': {'topHeight': .7},
    });

    expect(cover, isNotNull);
    expect(cover!.designerName, 'Lan');
    expect(cover.designerId, 'designer-1');
    expect(cover.designerQchatId, 'lan01');
    expect(cover.selected, isTrue);
    expect(cover.owned, isTrue);
    expect(cover.published, isTrue);
    expect(cover.design.topHeight, .7);
  });

  testWidgets('the arch follows the design top height', (tester) async {
    Future<double> seam(double topHeight) async {
      await tester.pumpWidget(
        qchatHarness(
          RedPacketCover(
            design: CoverDesign(topHeight: topHeight),
            sender: const {'nickname': 'Lan'},
            senderName: 'Lan',
            greeting: 'Best wishes',
            mine: false,
            opening: false,
            onOpen: () {},
          ),
        ),
      );
      await tester.pump();
      return tester
          .getBottomLeft(find.byKey(const ValueKey('red-packet-cover-top')))
          .dy;
    }

    final high = await seam(.5);
    final low = await seam(.9);
    expect(low, greaterThan(high));
  });

  testWidgets('decorations render on the half their area names', (
    tester,
  ) async {
    await tester.pumpWidget(
      qchatHarness(
        const CoverArtwork(
          design: CoverDesign(
            decorations: [
              CoverDecoration(
                id: 'top',
                value: '🧧',
                x: .5,
                y: .3,
                size: .2,
                area: 'top',
              ),
              CoverDecoration(
                id: 'bottom',
                value: '🍊',
                x: .5,
                y: .8,
                size: .2,
                area: 'bottom',
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('🧧'), findsOneWidget);
    expect(find.text('🍊'), findsOneWidget);
  });
}
