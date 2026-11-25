-- Mini Apps are static web packages rendered in a WebView. New builds default
-- to the webapp format and the 2.0.0 host; older qapp builds are not served.
ALTER TABLE "MiniAppVersion" ALTER COLUMN "format" SET DEFAULT 'webapp';
ALTER TABLE "MiniAppVersion" ALTER COLUMN "minRuntimeVersion" SET DEFAULT '2.0.0';
