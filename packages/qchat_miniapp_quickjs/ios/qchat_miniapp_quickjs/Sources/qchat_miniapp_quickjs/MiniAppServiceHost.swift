import Flutter
import Foundation

/// `qchat/miniapp/service`: create, evaluate and destroy one Service Runtime.
///
/// Mirrors the Android channel (`MiniAppServiceChannel.kt`, ADR 017) method for
/// method, so `QjsRuntime` in Dart is one API over two engines:
///
/// | Method  | Arguments | Reply |
/// |---------|-----------|-------|
/// | `create` | `memoryLimitBytes`, `stackSizeBytes` | the runtime id |
/// | `eval`  | `runtimeId`, `source`, `filename`, `timeoutMs` | the JSON envelope |
/// | `destroy` | `runtimeId` | `null` |
///
/// Method calls arrive on the platform thread. `create` only allocates, so it
/// replies synchronously; `eval` runs on the runtime's own queue and posts its
/// result back to the platform thread, which `FlutterResult` requires.
final class MiniAppServiceHost {
    static let channelName = "qchat/miniapp/service"

    private let channel: FlutterMethodChannel
    private var runtimes: [Int: MiniAppJSRuntime] = [:]
    private var nextRuntimeId = 1

    init(messenger: FlutterBinaryMessenger) {
        channel = FlutterMethodChannel(
            name: MiniAppServiceHost.channelName,
            binaryMessenger: messenger
        )
        channel.setMethodCallHandler { [weak self] call, result in
            self?.handle(call, result: result)
        }
    }

    var methodChannel: FlutterMethodChannel { channel }

    func dispose() {
        channel.setMethodCallHandler(nil)
        let current = runtimes
        runtimes.removeAll()
        current.values.forEach { $0.close() }
    }

    func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "create":
            create(call, result: result)
        case "eval":
            eval(call, result: result)
        case "destroy":
            destroy(call, result: result)
        default:
            result(FlutterMethodNotImplemented)
        }
    }

    private func create(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let arguments = call.arguments as? [String: Any]
        let memoryLimit = (arguments?["memoryLimitBytes"] as? NSNumber)?.int64Value
            ?? MiniAppJSRuntime.defaultMemoryLimitBytes
        let stackSize = (arguments?["stackSizeBytes"] as? NSNumber)?.int64Value
            ?? MiniAppJSRuntime.defaultStackSizeBytes
        guard memoryLimit > 0, stackSize > 0 else {
            result(
                FlutterError(
                    code: MiniAppServiceCodes.invalidRequest,
                    message: "The runtime limits must be positive.",
                    details: nil
                )
            )
            return
        }
        // JavaScriptCore has no public heap or stack ceiling, so the limits are
        // accepted for contract parity and recorded in ADR 019; they are not
        // enforced. Creating a context cannot fail the way loading a native
        // library can on Android, so there is no `SERVICE_START_FAILED` path.
        let runtime = MiniAppJSRuntime()
        let id = nextRuntimeId
        nextRuntimeId += 1
        runtimes[id] = runtime
        result(id)
    }

    private func eval(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let arguments = call.arguments as? [String: Any]
        let id = (arguments?["runtimeId"] as? NSNumber)?.intValue
        let source = arguments?["source"] as? String
        let filename = arguments?["filename"] as? String ?? "<eval>"
        let timeoutMs = (arguments?["timeoutMs"] as? NSNumber)?.intValue
            ?? MiniAppJSRuntime.defaultTimeoutMs
        guard
            let id,
            let runtime = runtimes[id],
            let source,
            timeoutMs > 0
        else {
            result(
                FlutterError(
                    code: MiniAppServiceCodes.invalidRequest,
                    message: "Unknown runtime, missing source or a non-positive timeout.",
                    details: nil
                )
            )
            return
        }
        runtime.eval(
            source: source,
            filename: filename,
            timeoutMs: timeoutMs
        ) { envelope in
            DispatchQueue.main.async {
                result(envelope)
            }
        }
    }

    private func destroy(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let arguments = call.arguments as? [String: Any]
        let id = (arguments?["runtimeId"] as? NSNumber)?.intValue
        if let id, let runtime = runtimes.removeValue(forKey: id) {
            runtime.close()
        }
        result(nil)
    }
}

/// Error codes shared with `packages/miniapp-contracts/src/errors.ts` and the
/// Android channel. A code is never reused for a different meaning.
private enum MiniAppServiceCodes {
    static let invalidRequest = "SERVICE_INVALID_REQUEST"
}
