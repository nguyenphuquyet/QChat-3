import Foundation

/// Responses served to the View WebView.
///
/// Only the host page carries a Content-Security-Policy; it then governs every
/// subresource of the document. `style-src 'unsafe-inline'` is required because
/// WXSS and the P0/P1 components write `<style>` elements.
///
/// The script, image, font and media sources name the custom scheme instead of
/// `'self'`. A document served by a custom scheme has an opaque origin in
/// WebKit, so `'self'` would match nothing; the scheme is safe to allow because
/// the only registered handler serves the installed directory and the host
/// assets. ADR 018 records this deviation from the Android CSP.
enum MiniAppResponses {
    static let contentSecurityPolicy = [
        "default-src 'none'",
        "script-src qchat-app:",
        "style-src qchat-app: 'unsafe-inline'",
        "img-src qchat-app: data:",
        "font-src qchat-app:",
        "media-src qchat-app:",
        "connect-src 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ].joined(separator: "; ")

    static func response(
        url: URL,
        status: Int,
        mime: String,
        cacheable: Bool
    ) -> HTTPURLResponse? {
        var headers: [String: String] = [
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": cacheable
                ? "public, max-age=31536000, immutable"
                : "no-store",
        ]
        if mime == "text/html" {
            headers["Content-Security-Policy"] = contentSecurityPolicy
        }
        return HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        )
    }
}
