/// Platform-specific factory for the sandboxed Mini App JavaScript runtime.
///
/// Web builds get a stub that reports the platform as unsupported; native
/// builds use QuickJS through `flutter_js`.
library;

export 'qapp_js_types.dart';
export 'qapp_js_runtime_stub.dart'
    if (dart.library.io) 'qapp_js_runtime_native.dart'
    show createQappJsRuntime;
