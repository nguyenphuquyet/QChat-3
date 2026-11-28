import Foundation

/// The JSON envelope the `qchat/miniapp/service` channel returns for one `eval`.
///
/// The shape is identical to the Android QuickJS JNI (ADR 017):
///
///     {"ok":true,"result":<json>}
///     {"ok":false,"error":{"name":"...","message":"...","stack":"..."}}
///
/// `Dart` (`QjsEvalResult.decode`) parses both platforms with the same code, so
/// the field names, the defaults and the `TimeoutError` name must not drift.
/// A thrown script is a successful channel call with `ok: false`; only a broken
/// runtime makes the channel itself fail.
enum MiniAppServiceEnvelope {
    /// Embed the already-encoded JSON result. `nil` is JavaScript `undefined`,
    /// which Android reports as `result: null`.
    static func success(_ json: String?) -> String {
        "{\"ok\":true,\"result\":\(json ?? "null")}"
    }

    static func error(name: String?, message: String?, stack: String?) -> String {
        let payload: [String: Any] = [
            "ok": false,
            "error": [
                "name": name ?? "Error",
                "message": message ?? "The script threw an error.",
                "stack": stack ?? "",
            ],
        ]
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let text = String(data: data, encoding: .utf8)
        else {
            return fallback
        }
        return text
    }

    /// The message matches the Android JNI exactly; Dart tests and the spike
    /// look for the `TimeoutError` name, not for the wording.
    static func timeout() -> String {
        MiniAppServiceEnvelope.error(
            name: "TimeoutError",
            message: "The script exceeded its time limit.",
            stack: nil
        )
    }

    /// JavaScriptCore cannot interrupt a running script, so a timed-out runtime
    /// is discarded rather than reused (ADR 019).
    static func poisoned() -> String {
        MiniAppServiceEnvelope.error(
            name: "TimeoutError",
            message: "The runtime exceeded a time limit and was discarded. "
                + "Create a new runtime.",
            stack: nil
        )
    }

    static func closed() -> String {
        MiniAppServiceEnvelope.error(
            name: "Error",
            message: "The service runtime is closed.",
            stack: nil
        )
    }

    /// A throwing exception can only be stringified through the context, which
    /// may itself fail; this is the last-resort envelope Android also uses.
    private static let fallback = "{\"ok\":false,\"error\":{\"name\":\"Error\","
        + "\"message\":\"The service runtime could not encode its result.\","
        + "\"stack\":\"\"}}"
}
