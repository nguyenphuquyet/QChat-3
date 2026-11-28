/// Android QuickJS service runtime for QChat Mini Apps.
///
/// The service runtime is deliberately outside the page WebView: a Mini App's
/// JavaScript never runs in the renderer process. One [QjsRuntime] owns one
/// `JSRuntime`/`JSContext` pair and is only touched from its own thread. The
/// JNI boundary and the pinned upstream build are documented in ADR 017.
library;

export 'src/qjs_result.dart';
export 'src/qjs_runtime.dart';
