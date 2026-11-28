import Foundation
import JavaScriptCore

/// One JavaScriptCore context and the single serial queue that uses it.
///
/// ADR 019: iOS runs the same Service Runtime contract as the Android QuickJS
/// host (`qchat/miniapp/service`, the `{"ok":...}` envelope) on JavaScriptCore,
/// which ships with iOS, so the IPA carries no JavaScript engine of its own.
///
/// JavaScriptCore is not confined to one thread, but a `JSContext` must never be
/// used by two threads at once, so every evaluation runs on `qchat-jsc`.
///
/// Two limits differ from Android, and ADR 019 records both:
///
/// - JavaScriptCore has no public heap or stack ceiling. The requested limits
///   are accepted for parity and cannot be enforced.
/// - JavaScriptCore has no interrupt handler. A script that overruns its budget
///   cannot be stopped, so the runtime replies `TimeoutError` on time and is
///   then **poisoned**: the abandoned script keeps its context alive until it
///   returns, and later evaluations report the timeout instead of running.
///   A caller that sees a timeout closes the runtime and creates a new one.
final class MiniAppJSRuntime {
    static let defaultMemoryLimitBytes: Int64 = 64 * 1024 * 1024
    static let defaultStackSizeBytes: Int64 = 1 * 1024 * 1024
    static let defaultTimeoutMs = 2000

    /// One serial queue per runtime: the same shape as the Android `qchat-qjs`
    /// thread, so the Dart side may call from any isolate.
    private let queue = DispatchQueue(label: "qchat-jsc", qos: .userInitiated)

    /// Guards `poisoned`, `closed`, `context` and `stringify`; the timeout timer
    /// runs off the queue, so plain properties would race.
    private let state = NSLock()

    private var context: JSContext?
    private var stringify: JSValue?
    private var poisoned = false
    private var closed = false

    init() {
        let context: JSContext? = JSContext()
        // Captured before any Mini App script runs: a script that replaces
        // `JSON.stringify` must not be able to change how results are encoded.
        self.stringify = context?
            .objectForKeyedSubscript("JSON")?
            .objectForKeyedSubscript("stringify")
        self.context = context
    }

    /// Evaluate [source] as a global script and report the JSON envelope.
    ///
    /// The completion is called exactly once, on the queue or on the timeout
    /// thread; the channel posts it back to the platform thread.
    func eval(
        source: String,
        filename: String,
        timeoutMs: Int,
        completion: @escaping (String) -> Void
    ) {
        state.lock()
        if closed {
            state.unlock()
            completion(MiniAppServiceEnvelope.closed())
            return
        }
        if poisoned {
            state.unlock()
            completion(MiniAppServiceEnvelope.poisoned())
            return
        }
        state.unlock()

        let ticket = SettleOnce()
        let timer = DispatchWorkItem { [weak self] in
            guard !ticket.isSettled else { return }
            guard let self, self.poison() else { return }
            ticket.settle { completion(MiniAppServiceEnvelope.timeout()) }
        }
        DispatchQueue.global(qos: .userInitiated).asyncAfter(
            deadline: .now() + .milliseconds(timeoutMs),
            execute: timer
        )

        queue.async { [weak self] in
            guard let self else {
                ticket.settle { completion(MiniAppServiceEnvelope.closed()) }
                return
            }
            self.state.lock()
            let usable = !self.closed && !self.poisoned
            self.state.unlock()
            guard usable else {
                timer.cancel()
                ticket.settle { completion(MiniAppServiceEnvelope.poisoned()) }
                return
            }
            let envelope = self.evaluate(source: source, filename: filename)
            timer.cancel()
            ticket.settle { completion(envelope) }
        }
    }

    /// Release the context. Safe to call more than once.
    ///
    /// The release is queued so it stays off the platform thread. A script that
    /// never returns keeps the queue busy, so the context is released only when
    /// that script ends; the runtime itself is already unusable.
    func close() {
        state.lock()
        if closed {
            state.unlock()
            return
        }
        closed = true
        let context = self.context
        self.context = nil
        self.stringify = nil
        state.unlock()
        queue.async {
            _ = context
        }
    }

    private func poison() -> Bool {
        state.lock()
        defer { state.unlock() }
        if closed || poisoned {
            return false
        }
        poisoned = true
        return true
    }

    private func evaluate(source: String, filename: String) -> String {
        state.lock()
        let context = self.context
        let stringify = self.stringify
        state.unlock()

        guard let context else {
            return MiniAppServiceEnvelope.closed()
        }

        context.exception = nil
        let value = context.evaluateScript(source, withSourceURL: sourceURL(filename))
        if let exception = context.exception {
            context.exception = nil
            return MiniAppServiceEnvelope.error(
                name: Self.stringProperty(exception, "name"),
                message: Self.stringProperty(exception, "message"),
                stack: Self.stringProperty(exception, "stack")
            )
        }
        guard let value else {
            return MiniAppServiceEnvelope.error(
                name: "Error",
                message: "The script returned no value.",
                stack: nil
            )
        }
        // `undefined` has no JSON form; Android reports it as `result: null`.
        if value.isUndefined {
            return MiniAppServiceEnvelope.success(nil)
        }
        guard let stringify else {
            return MiniAppServiceEnvelope.error(
                name: "Error",
                message: "The runtime has no JSON encoder.",
                stack: nil
            )
        }

        context.exception = nil
        let json = stringify.call(withArguments: [value])
        if context.exception != nil {
            context.exception = nil
            // A cycle, a `BigInt` or a throwing getter: the same `TypeError`
            // Android reports when `JS_JSONStringify` fails.
            return MiniAppServiceEnvelope.error(
                name: "TypeError",
                message: "The result cannot be represented as JSON.",
                stack: nil
            )
        }
        guard let json, !json.isUndefined, let text = json.toString() else {
            return MiniAppServiceEnvelope.success(nil)
        }
        return MiniAppServiceEnvelope.success(text)
    }

    /// Mirror Android's `js_string_property`: only own or inherited string
    /// values count, `undefined`/`null` become `nil`, and the envelope applies
    /// the defaults.
    private static func stringProperty(_ object: JSValue, _ key: String) -> String? {
        guard object.isObject else { return nil }
        guard
            let value = object.objectForKeyedSubscript(key),
            !value.isUndefined,
            !value.isNull
        else {
            return nil
        }
        return value.toString()
    }

    /// JSC shows the source URL in a stack. `<eval>` is not a URL, so it becomes
    /// a synthetic `qchat-eval:` URL; the file name still reads the same.
    private func sourceURL(_ filename: String) -> URL? {
        if filename.isEmpty || filename == "<eval>" {
            return nil
        }
        if let url = URL(string: filename), url.scheme != nil {
            return url
        }
        let escaped = filename.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? "eval"
        return URL(string: "qchat-eval:///\(escaped)")
    }
}

/// A completion that must run once, whichever of the evaluation and its timeout
/// arrives first.
private final class SettleOnce {
    private let lock = NSLock()
    private var settled = false

    var isSettled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return settled
    }

    func settle(_ body: () -> Void) {
        lock.lock()
        if settled {
            lock.unlock()
            return
        }
        settled = true
        lock.unlock()
        body()
    }
}
