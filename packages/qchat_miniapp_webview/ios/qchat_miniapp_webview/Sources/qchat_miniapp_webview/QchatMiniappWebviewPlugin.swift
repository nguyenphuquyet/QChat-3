import Flutter
import Foundation

/// Registers the `qchat/miniapp/webview` platform view and the installer path
/// channel.
///
/// The plugin has no app-wide method channel beyond the installer: each view owns
/// `qchat/miniapp/<viewId>`, so two Mini Apps can never share a channel.
public final class QchatMiniappWebviewPlugin: NSObject, FlutterPlugin {
    private let installerChannel: FlutterMethodChannel

    init(messenger: FlutterBinaryMessenger) {
        installerChannel = FlutterMethodChannel(
            name: "qchat/miniapp/installer",
            binaryMessenger: messenger
        )
        super.init()
    }

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = QchatMiniappWebviewPlugin(messenger: registrar.messenger())
        let assets = BundleHostAssets { asset in
            registrar.lookupKey(forAsset: asset, fromPackage: "qchat_miniapp_webview")
        }
        registrar.register(
            MiniAppWebViewFactory(
                messenger: registrar.messenger(),
                assets: assets
            ),
            withId: MiniAppWebView.viewType
        )
        // `addMethodCallDelegate` keeps `instance` alive for the engine.
        registrar.addMethodCallDelegate(instance, channel: instance.installerChannel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "versionDir":
            let arguments = call.arguments as? [String: Any]
            guard let appId = arguments?["appId"] as? String,
                  let version = arguments?["version"] as? String,
                  MiniAppOrigin.isAppId(appId),
                  MiniAppOrigin.isVersion(version) else {
                result(
                    FlutterError(
                        code: MiniAppErrorCodes.bridgeInvalidMessage,
                        message: "appId or version is invalid.",
                        details: nil
                    )
                )
                return
            }
            result(
                MiniAppInstallPaths
                    .versionDirectory(appId: appId, version: version)
                    .path
            )
        default:
            result(FlutterMethodNotImplemented)
        }
    }
}
