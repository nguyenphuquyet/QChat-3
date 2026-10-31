import '../../core/network/client.dart';
import 'sticker_models.dart';

/// The sticker endpoints. The client handles auth, retries and error mapping,
/// so this layer only shapes requests and responses.
class StickerApi {
  const StickerApi(this.client);

  final QChatClient client;

  Future<StickerLibrary> library() async =>
      StickerLibrary.fromJson(await client.get('/stickers', cached: false));

  Future<StickerPack> pack(String id) async =>
      StickerPack.fromJson(await client.get('/stickers/packs/$id', cached: false));

  Future<StickerPack> createPack(String name, {String description = ''}) async =>
      StickerPack.fromJson(
        await client.post('/stickers/packs', {
          'name': name,
          'description': description,
        }),
      );

  Future<StickerPack> updatePack(
    String id, {
    String? name,
    String? description,
    bool? published,
    String? coverMediaId,
  }) async => StickerPack.fromJson(
    (await client.dio.patch('/stickers/packs/$id', data: {
      'name': ?name,
      'description': ?description,
      'published': ?published,
      'coverMediaId': ?coverMediaId,
    })).data,
  );

  Future<void> deletePack(String id) async =>
      client.dio.delete('/stickers/packs/$id');

  Future<Sticker> addSticker(
    String packId, {
    required String mediaId,
    String label = '',
    bool animated = false,
  }) async => Sticker.fromJson(
    await client.post('/stickers/packs/$packId/stickers', {
      'mediaId': mediaId,
      'label': label,
      'animated': animated,
    }),
  );

  Future<void> removeSticker(String packId, String stickerId) async =>
      client.dio.delete('/stickers/packs/$packId/stickers/$stickerId');

  Future<StickerPack> addToLibrary(String packId) async =>
      StickerPack.fromJson(
        await client.post('/stickers/packs/$packId/add', const {}),
      );

  Future<void> removeFromLibrary(String packId) =>
      client.post('/stickers/packs/$packId/remove', const {});

  /// Records a send so "recently used" stays in the same order on every device.
  Future<void> markUsed(String stickerId) =>
      client.post('/stickers/used', {'stickerId': stickerId});
}
