import 'package:dio/dio.dart';

import '../../core/network/client.dart';
import 'models.dart';

/// Read-only store endpoints plus the few host-side calls the runtime needs.
/// All requests go through the authenticated [QChatClient]; the Mini App
/// sandbox never receives the access token.
class MiniAppApi {
  MiniAppApi(this.client);

  final QChatClient client;

  Future<MiniAppPage> store({
    String query = '',
    String category = '',
    String sort = 'new',
    int page = 1,
  }) async {
    final response = await client.dio.get(
      '/miniapps/store',
      queryParameters: {
        'q': query,
        'category': category,
        'sort': sort,
        'page': page,
      },
    );
    return MiniAppPage.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<List<MiniAppSummary>> recent() async {
    final response = await client.dio.get('/miniapps/recent');
    return _list(response.data);
  }

  Future<List<MiniAppSummary>> favorites() async {
    final response = await client.dio.get('/miniapps/favorites');
    return _list(response.data);
  }

  Future<MiniAppDetail> detail(String appId) async {
    final response = await client.dio.get('/miniapps/store/$appId');
    return MiniAppDetail.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Future<MiniAppBuild> build(String appId) async {
    final response = await client.dio.get('/miniapps/store/$appId/build');
    return MiniAppBuild.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Future<void> recordOpen(String appId) async {
    await client.dio.post('/miniapps/recent', data: {'appId': appId});
  }

  Future<void> telemetry({
    required String appId,
    required String version,
    required String event,
    String errorCode = '',
    int durationMs = 0,
  }) async {
    await client.dio.post(
      '/miniapps/telemetry',
      data: {
        'appId': appId,
        'version': version,
        'event': event,
        'errorCode': errorCode,
        'durationMs': durationMs,
      },
    );
  }

  Future<void> addFavorite(String appId) async {
    await client.dio.post('/miniapps/favorites', data: {'appId': appId});
  }

  Future<void> removeFavorite(String appId) async {
    await client.dio.delete('/miniapps/favorites/$appId');
  }

  Future<Map<String, dynamic>> me() async {
    final response = await client.dio.get('/users/me');
    return Map<String, dynamic>.from(response.data as Map);
  }

  /// Calls one allowlisted QChat endpoint for `QChat.request`. The caller has
  /// already checked the permission and the path; the host never forwards the
  /// token to the page.
  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? query,
    Object? body,
  }) async {
    final response = await client.dio.request(
      path,
      data: body,
      queryParameters: query,
      options: Options(method: method),
    );
    return response.data;
  }

  List<MiniAppSummary> _list(Object? data) {
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((row) => MiniAppSummary.fromJson(Map<String, dynamic>.from(row)))
        .toList(growable: false);
  }
}
