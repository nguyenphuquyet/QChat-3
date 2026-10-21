$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
$runtime = Join-Path $root '.tools/runtime'
New-Item -ItemType Directory -Force $runtime | Out-Null
$configPath = Join-Path $runtime 'config.json'
if (!(Test-Path -LiteralPath $configPath)) {
  $config = @{ dbPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)); jwtSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)) }
  $config | ConvertTo-Json | Set-Content -LiteralPath $configPath
}
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$env:DATABASE_URL = "postgresql://qchat:$($config.dbPassword)@127.0.0.1:5432/qchat"
$env:JWT_SECRET = $config.jwtSecret
$env:REDIS_URL = 'redis://127.0.0.1:6379'
$env:WEB_ORIGIN = 'http://localhost:8080'
$env:REALTIME_PORT = '3001'
$env:PGPASSWORD = $config.dbPassword
$pg = Join-Path $root '.tools/postgres/package/native/bin'
$pgData = Join-Path $runtime 'pgdata'
function IsListening([int]$port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1',$port); return $true } catch { return $false } finally { $client.Dispose() }
}
if (!(Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
  $passwordFile = Join-Path $runtime 'pg-password.txt'
  [IO.File]::WriteAllText($passwordFile, $config.dbPassword)
  & "$pg/initdb.exe" -D $pgData -U qchat -A scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
  if ($LASTEXITCODE) { throw 'PostgreSQL initialization failed' }
}
if (!(IsListening 5432)) {
  Start-Process -FilePath "$pg/postgres.exe" -ArgumentList @('-D',"`"$pgData`"",'-h','127.0.0.1','-p','5432') -WindowStyle Hidden -RedirectStandardOutput "$runtime/postgres.log" -RedirectStandardError "$runtime/postgres-error.log" | Out-Null
  for($i=0;$i -lt 30 -and !(IsListening 5432);$i++){Start-Sleep -Milliseconds 300}
}
if (!(IsListening 5432)) { throw 'PostgreSQL did not start; see .tools/runtime/postgres-error.log' }
$node = (Get-Command node).Source
& $node scripts/init-local-db.mjs
if ($LASTEXITCODE) { throw 'Database creation failed' }
$redisExe = Get-ChildItem -LiteralPath "$root/.tools/redis" -Recurse -Filter redis-server.exe | Select-Object -First 1 -ExpandProperty FullName
if (!(IsListening 6379)) {
  Start-Process -FilePath $redisExe -WorkingDirectory (Split-Path $redisExe) -ArgumentList @('--bind','127.0.0.1','--port','6379','--appendonly','yes') -WindowStyle Hidden -RedirectStandardOutput "$runtime/redis.log" -RedirectStandardError "$runtime/redis-error.log" | Out-Null
  for($i=0;$i -lt 30 -and !(IsListening 6379);$i++){Start-Sleep -Milliseconds 300}
}
if (!(IsListening 6379)) { throw 'Redis did not start; see .tools/runtime/redis-error.log' }
$node = (Get-Command node).Source
& $node node_modules/prisma/build/index.js migrate deploy --schema apps/server/prisma/schema.prisma
if ($LASTEXITCODE) { throw 'Migration failed' }
if (!(IsListening 3000)) {
  Start-Process -FilePath $node -WorkingDirectory "$root/apps/server" -ArgumentList @('"../../node_modules/next/dist/bin/next"','dev','--hostname','127.0.0.1') -WindowStyle Hidden -RedirectStandardOutput "$runtime/server.log" -RedirectStandardError "$runtime/server-error.log" | Out-Null
}
if (!(IsListening 3001)) {
  Start-Process -FilePath $node -WorkingDirectory $root -ArgumentList @('node_modules/tsx/dist/cli.mjs','apps/realtime/src/index.ts') -WindowStyle Hidden -RedirectStandardOutput "$runtime/realtime.log" -RedirectStandardError "$runtime/realtime-error.log" | Out-Null
}
if (!(IsListening 8080)) {
  Start-Process -FilePath $node -WorkingDirectory $root -ArgumentList @('scripts/serve-web.mjs') -WindowStyle Hidden -RedirectStandardOutput "$runtime/web.log" -RedirectStandardError "$runtime/web-error.log" | Out-Null
}
for ($i=0; $i -lt 60 -and !(IsListening 3000); $i++) { Start-Sleep -Milliseconds 500 }
if (!(IsListening 3000)) { throw 'Next.js did not become ready; see .tools/runtime/server-error.log' }
Write-Output 'QChat web: http://localhost:8080'
Write-Output 'QChat API: http://localhost:3000/api/health'
Write-Output 'Local runtime logs: .tools/runtime'
