/// Service runtime for QChat Mini Apps.
///
/// The service runtime is deliberately outside the page WebView: a Mini App's
/// JavaScript never runs in the renderer process. One [QjsRuntime] owns one
/// `JSRuntime`/`JSContext` pair and is only touched from its own thread. The
/// engine is QuickJS on Android (ADR 017: JNI boundary, pinned upstream build)
/// and JavaScriptCore on iOS (ADR 019: the same channel and envelope, the
/// documented limit and timeout differences).
library;

export 'src/qjs_result.dart';
export 'src/qjs_runtime.dart';
