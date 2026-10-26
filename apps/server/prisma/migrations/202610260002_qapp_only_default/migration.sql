-- Mini Apps now ship only as native `.japp` packages. Existing rows keep their
-- stored value so the history is not rewritten, but new builds default to qapp.
ALTER TABLE "MiniAppVersion" ALTER COLUMN "format" SET DEFAULT 'qapp';
