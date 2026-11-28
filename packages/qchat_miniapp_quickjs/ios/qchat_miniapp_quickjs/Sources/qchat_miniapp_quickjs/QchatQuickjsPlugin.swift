import Flutter
import Foundation

/// Registers the `qchat/miniapp/service` channel on iOS.
///
/// The plugin owns one `MiniAppServiceHost` for the whole engine: every Mini App
/// session creates its own runtime id on that channel, so two sessions can
/// never share a `JSContext`. `detachFromEngine` closes every runtime that is
/// still open, because a hot restart must not leave a service runtime behind.
public final class QchatQuickjsPlugin: NSObject, FlutterPlugin {
    private let host: MiniAppServiceHost

    init(messenger: FlutterBinaryMessenger) {
        host = MiniAppServiceHost(messenger: messenger)
        super.init()
    }

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = QchatQuickjsPlugin(messenger: registrar.messenger())
        // `addMethodCallDelegate` keeps `instance` alive for the engine.
        registrar.addMethodCallDelegate(instance, channel: instance.host.methodChannel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        host.handle(call, result: result)
    }

    public func detachFromEngine(for registrar: FlutterPluginRegistrar) {
        host.dispose()
    }
}
