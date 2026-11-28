// swift-tools-version: 5.9
//
// The iOS half of the Mini App View host (ADR 018). Flutter looks for a
// plugin's Swift package at ios/<plugin_name>/Package.swift; without this
// manifest the plugin is not registered when the app uses Swift Package
// Manager instead of CocoaPods.
//
// The deployment target matches the app and the generated Flutter package
// (iOS 15 is Flutter 3.47's floor; the Runner itself targets iOS 16).

import PackageDescription

let package = Package(
    name: "qchat_miniapp_webview",
    platforms: [
        .iOS("15.0")
    ],
    products: [
        .library(name: "qchat-miniapp-webview", targets: ["qchat_miniapp_webview"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "qchat_miniapp_webview",
            dependencies: []
        )
    ]
)
