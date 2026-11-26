import 'package:dio/dio.dart';

String _string(Object? value, [String fallback = '']) =>
    value == null ? fallback : value.toString();

int _int(Object? value, [int fallback = 0]) =>
    value is int ? value : int.tryParse('$value') ?? fallback;

bool _bool(Object? value) => value == true;

DateTime? _date(Object? value) =>
    value == null ? null : DateTime.tryParse(value.toString());

List<String> _strings(Object? value) => value is List
    ? value.map((item) => item.toString()).toList(growable: false)
    : const [];

class MiniAppSummary {
  const MiniAppSummary({
    required this.appId,
    required this.name,
    required this.description,
    required this.iconUrl,
    required this.category,
    required this.developerName,
    required this.status,
    required this.currentVersion,
    required this.requestedPermissions,
    required this.favorite,
    required this.openCount,
    required this.updatedAt,
    this.openedAt,
  });

  final String appId;
  final String name;
  final String description;
  final String iconUrl;
  final String category;
  final String developerName;
  final String status;
  final String? currentVersion;
  final List<String> requestedPermissions;
  final bool favorite;
  final int openCount;
  final DateTime? updatedAt;
  final DateTime? openedAt;

  factory MiniAppSummary.fromJson(Map<String, dynamic> json) => MiniAppSummary(
    appId: _string(json['appId']),
    name: _string(json['name']),
    description: _string(json['description']),
    iconUrl: _string(json['iconUrl']),
    category: _string(json['category'], 'utilities'),
    developerName: _string(json['developerName']),
    status: _string(json['status']),
    currentVersion: json['currentVersion']?.toString(),
    requestedPermissions: _strings(json['requestedPermissions']),
    favorite: _bool(json['favorite']),
    openCount: _int(json['openCount']),
    updatedAt: _date(json['updatedAt']),
    openedAt: _date(json['openedAt']),
  );

  MiniAppSummary copyWith({bool? favorite}) => MiniAppSummary(
    appId: appId,
    name: name,
    description: description,
    iconUrl: iconUrl,
    category: category,
    developerName: developerName,
    status: status,
    currentVersion: currentVersion,
    requestedPermissions: requestedPermissions,
    favorite: favorite ?? this.favorite,
    openCount: openCount,
    updatedAt: updatedAt,
    openedAt: openedAt,
  );
}

class MiniAppDetail extends MiniAppSummary {
  const MiniAppDetail({
    required super.appId,
    required super.name,
    required super.description,
    required super.iconUrl,
    required super.category,
    required super.developerName,
    required super.status,
    required super.currentVersion,
    required super.requestedPermissions,
    required super.favorite,
    required super.openCount,
    required super.updatedAt,
    super.openedAt,
    required this.supportUrl,
    required this.privacyUrl,
    required this.minRuntimeVersion,
    required this.size,
    required this.runtimeVersion,
  });

  final String supportUrl;
  final String privacyUrl;
  final String minRuntimeVersion;
  final int size;
  final String runtimeVersion;

  factory MiniAppDetail.fromJson(Map<String, dynamic> json) {
    final summary = MiniAppSummary.fromJson(json);
    return MiniAppDetail(
      appId: summary.appId,
      name: summary.name,
      description: summary.description,
      iconUrl: summary.iconUrl,
      category: summary.category,
      developerName: summary.developerName,
      status: summary.status,
      currentVersion: summary.currentVersion,
      requestedPermissions: summary.requestedPermissions,
      favorite: summary.favorite,
      openCount: summary.openCount,
      updatedAt: summary.updatedAt,
      openedAt: summary.openedAt,
      supportUrl: _string(json['supportUrl']),
      privacyUrl: _string(json['privacyUrl']),
      minRuntimeVersion: _string(json['minRuntimeVersion'], '1.0.0'),
      size: _int(json['size']),
      runtimeVersion: _string(json['runtimeVersion'], '1.0.0'),
    );
  }
}

class MiniAppManifest {
  const MiniAppManifest({
    this.schemaVersion = 2,
    required this.name,
    required this.description,
    required this.version,
    this.entry = 'app.js',
    this.minRuntimeVersion = '1.0.0',
    required this.requestedPermissions,
    this.format = 'qapp',
    this.sdkVersion,
    this.buildHash,
  });

  final int schemaVersion;
  final String name;
  final String description;
  final String version;
  final String entry;
  final String minRuntimeVersion;
  final List<String> requestedPermissions;

  /// Internal package format id. Native `.japp` packages always use `qapp`.
  final String format;
  final String? sdkVersion;
  final String? buildHash;

  factory MiniAppManifest.fromJson(Map<String, dynamic> json) {
    final schemaVersion = _int(json['schemaVersion'], 2);
    final declared = _string(json['format']).trim().toLowerCase();
    return MiniAppManifest(
      schemaVersion: schemaVersion,
      name: _string(json['name']),
      description: _string(json['description']),
      version: _string(json['version']),
      entry: _string(json['entry'], 'app.js'),
      minRuntimeVersion: _string(json['minRuntimeVersion'], '1.0.0'),
      requestedPermissions: _strings(json['requestedPermissions']),
      // A package without a format field is classified by its schema version,
      // so a legacy `schemaVersion: 1` manifest can never masquerade as qapp.
      format: declared.isEmpty
          ? (schemaVersion >= 2 ? 'qapp' : 'webview')
          : declared,
      sdkVersion: json['sdkVersion']?.toString(),
      buildHash: json['buildHash']?.toString(),
    );
  }
}

class MiniAppBuild {
  const MiniAppBuild({
    required this.appId,
    required this.version,
    required this.entry,
    required this.sha256,
    required this.size,
    required this.minRuntimeVersion,
    required this.requestedPermissions,
    required this.manifest,
    required this.url,
    this.format = 'qapp',
    this.sdkVersion,
    this.expiresAt,
  });

  final String appId;
  final String version;
  final String entry;
  final String sha256;
  final int size;
  final String minRuntimeVersion;
  final List<String> requestedPermissions;
  final MiniAppManifest manifest;
  final String url;
  final String format;
  final String? sdkVersion;
  final DateTime? expiresAt;

  factory MiniAppBuild.fromJson(Map<String, dynamic> json) {
    final manifest = json['manifest'];
    final parsed = MiniAppManifest.fromJson(
      manifest is Map
          ? Map<String, dynamic>.from(manifest)
          : const <String, dynamic>{},
    );
    final format = _string(json['format'], parsed.format);
    return MiniAppBuild(
      appId: _string(json['appId']),
      version: _string(json['version']),
      entry: _string(json['entry'], parsed.entry),
      sha256: _string(json['sha256']),
      size: _int(json['size']),
      minRuntimeVersion: _string(json['minRuntimeVersion'], '1.0.0'),
      requestedPermissions: _strings(json['requestedPermissions']).isEmpty
          ? parsed.requestedPermissions
          : _strings(json['requestedPermissions']),
      manifest: parsed,
      url: _string(json['url']),
      format: format,
      sdkVersion: json['sdkVersion']?.toString() ?? parsed.sdkVersion,
      expiresAt: _date(json['expiresAt']),
    );
  }
}

class MiniAppPage {
  const MiniAppPage({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
  });

  final List<MiniAppSummary> items;
  final int total;
  final int page;
  final int pageSize;

  factory MiniAppPage.fromJson(Map<String, dynamic> json) {
    final rows = json['items'];
    return MiniAppPage(
      items: rows is List
          ? rows
                .whereType<Map>()
                .map(
                  (row) =>
                      MiniAppSummary.fromJson(Map<String, dynamic>.from(row)),
                )
                .toList(growable: false)
          : const [],
      total: _int(json['total']),
      page: _int(json['page'], 1),
      pageSize: _int(json['pageSize'], 20),
    );
  }
}

class MiniAppException implements Exception {
  const MiniAppException(this.code, {this.status, this.message});

  final String code;
  final int? status;
  final String? message;

  bool get unauthorized => status == 401 || code == 'UNAUTHORIZED';
  bool get unavailable =>
      status == 410 || code == 'APP_SUSPENDED' || code == 'VERSION_REVOKED';
  bool get offline => code == 'NETWORK_ERROR' || code == 'CONNECTION_ERROR';

  static MiniAppException from(Object error) {
    if (error is MiniAppException) return error;
    if (error is DioException) {
      final response = error.response;
      final data = response?.data;
      final code = data is Map
          ? (data['error']?.toString() ?? 'SERVICE_ERROR')
          : 'NETWORK_ERROR';
      return MiniAppException(
        code,
        status: response?.statusCode,
        message: error.message,
      );
    }
    return MiniAppException('SERVICE_ERROR', message: error.toString());
  }

  @override
  String toString() => 'MiniAppException($code, status: $status)';
}
