-- Native `.japp` packages are stored beside legacy WebView builds. Existing
-- rows keep the WebView runtime and have no SDK version.
ALTER TABLE "MiniAppVersion" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'webview';
ALTER TABLE "MiniAppVersion" ADD COLUMN "sdkVersion" TEXT;
