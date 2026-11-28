import Flutter
import UIKit

/// Builds one `MiniAppWebView` per `UiKitView`.
///
/// Creation parameters are the app binding; the installed directory and the page
/// CSS are derived by the host, not passed in.
final class MiniAppWebViewFactory: NSObject, FlutterPlatformViewFactory {
    private let messenger: FlutterBinaryMessenger
    private let assets: MiniAppHostAssets

    init(messenger: FlutterBinaryMessenger, assets: MiniAppHostAssets) {
        self.messenger = messenger
        self.assets = assets
        super.init()
    }

    func create(
        withFrame frame: CGRect,
        viewIdentifier viewId: Int64,
        arguments args: Any?
    ) -> FlutterPlatformView {
        MiniAppWebView(
            frame: frame,
            viewId: viewId,
            args: args,
            messenger: messenger,
            assets: assets
        )
    }

    func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol {
        FlutterStandardMessageCodec.sharedInstance()
    }
}
