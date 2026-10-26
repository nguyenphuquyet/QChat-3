/// Platform selection for the native Mini App backend.
library;

export 'qapp_backend_types.dart';
export 'qapp_backend_stub.dart'
    if (dart.library.io) 'qapp_backend_native.dart'
    show createQappBackend;
