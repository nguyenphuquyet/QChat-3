$ErrorActionPreference = 'Stop'
pnpm db:generate
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm typecheck
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm test
if ($LASTEXITCODE) { exit $LASTEXITCODE }
pnpm build
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Push-Location apps/mobile
try {
  flutter pub get --enforce-lockfile
  flutter analyze
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
  flutter test
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
  flutter build web --release
} finally { Pop-Location }
