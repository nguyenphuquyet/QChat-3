// swift-tools-version: 5.9
//
// The iOS half of the Mini App Service Runtime (ADR 019). Flutter looks for a
// plugin's Swift package at ios/<plugin_name>/Package.swift; without this
// manifest the plugin is not registered when the app uses Swift Package Manager
// instead of CocoaPods.
//
// JavaScriptCore ships with iOS, so the IPA carries no JavaScript engine of its
// own and the vendored QuickJS sources under android/ are not compiled here.

import PackageDescription

let package = Package(
    name: "qchat_miniapp_quickjs",
    platforms: [
        .iOS("15.0")
    ],
    products: [
        .library(name: "qchat-miniapp-quickjs", targets: ["qchat_miniapp_quickjs"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "qchat_miniapp_quickjs",
            dependencies: [],
            linkerSettings: [
                .linkedFramework("JavaScriptCore")
            ]
        )
    ]
)
