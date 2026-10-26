import 'qapp_js_types.dart';

QappJsRuntime createQappJsRuntime() => const UnsupportedQappJsRuntime();

class UnsupportedQappJsRuntime implements QappJsRuntime {
  const UnsupportedQappJsRuntime();

  @override
  Future<void> start({required String appJs, required QappJsHost host}) {
    throw const QappRuntimeException(
      'RUNTIME_UNAVAILABLE',
      'Native Mini Apps are only available on the QChat mobile app',
    );
  }

  @override
  void dispatch(String nodeId, String event, Object? payload) {}

  @override
  void lifecycle(String event, [Object? payload]) {}
  @override
  void dispose() {}
}
