<#
  Local development services WITHOUT Docker (deploy still uses the Dockerfile / docker-compose).

    npm run local:setup    one-time: download portable PostgreSQL + Mailpit, create the database
    npm run local:start    start PostgreSQL, object storage (SeaweedFS) and Mailpit
    npm run local:stop     stop all three
    npm run local:status   show what is running

  Everything lives under D:\mini-data (override with -Root). Nothing is installed as a Windows service,
  so nothing keeps running after local:stop or a reboot.
#>
param(
  [Parameter(Position = 0)][ValidateSet("setup", "start", "stop", "status", "import-docker")][string]$Action = "status",
  [string]$Root = "D:\mini-data",
  [string]$PostgresVersion = "17.10-1",
  [string]$MailpitVersion = "v1.33.1"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$pgHome = Join-Path $Root "pgsql"
$pgBin = Join-Path $pgHome "bin"
$pgData = Join-Path $Root "pgdata"
$pgLog = Join-Path $Root "postgres.log"
$mailpitDir = Join-Path $Root "mailpit"
$mailpitExe = Join-Path $mailpitDir "mailpit.exe"
$mailpitPid = Join-Path $mailpitDir "mailpit.pid"

function Read-EnvValue([string]$name) {
  $file = Join-Path $workspace ".env.local"
  if (-not (Test-Path -LiteralPath $file)) { throw ".env.local tidak ditemukan. Salin .env.example menjadi .env.local terlebih dahulu." }
  foreach ($line in Get-Content -LiteralPath $file) {
    if ($line -match "^\s*$name\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
  }
  return $null
}

# Database settings come from DATABASE_URL in .env.local so the app and this script always agree.
function Get-DbConfig {
  $url = Read-EnvValue "DATABASE_URL"
  if (-not $url) { throw "DATABASE_URL belum diisi di .env.local." }
  if ($url -notmatch '^postgres(?:ql)?://([^:/@]+)(?::([^@]*))?@([^:/]+)(?::(\d+))?/([^?]+)') { throw "Format DATABASE_URL tidak dikenali (contoh: postgresql://postgres:postgres@localhost:5432/tepatwaktu)." }
  $config = [pscustomobject]@{ User = $Matches[1]; Password = [uri]::UnescapeDataString($Matches[2]); Host = $Matches[3]; Port = [int]($(if ($Matches[4]) { $Matches[4] } else { 5432 })); Database = $Matches[5] }
  if ($config.Host -notin @("localhost", "127.0.0.1", "::1")) { throw "DATABASE_URL di .env.local menunjuk ke $($config.Host), bukan database lokal. Ubah host ke localhost untuk mode tanpa Docker." }
  return $config
}

# Windows' own tar.exe (bsdtar, reads .zip) and curl.exe. npm may run inside Git Bash, whose PATH puts
# GNU tar first: it cannot read zip files and treats "C:" in a path as a remote host.
$system32 = [Environment]::GetFolderPath("System")
$windowsTar = Join-Path $system32 "tar.exe"
$windowsCurl = Join-Path $system32 "curl.exe"

function Expand-ZipEntries([string]$zip, [string]$destination, [string[]]$entries) {
  if (Test-Path -LiteralPath $windowsTar) {
    & $windowsTar -xf $zip -C $destination @entries
    if ($LASTEXITCODE -ne 0) { throw "Gagal mengekstrak $zip" }
    return
  }
  # Fallback without tar.exe: extract everything to a temp folder, then move the wanted entries.
  $temp = Join-Path $env:TEMP "tepatwaktu-extract-$([guid]::NewGuid())"
  try {
    Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force
    foreach ($entry in $entries) {
      $source = Join-Path $temp $entry
      $target = Join-Path $destination $entry
      New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
      Move-Item -LiteralPath $source -Destination $target -Force
    }
  } finally { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}

function Get-Listener([int]$port) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 }
function Get-ProcessName([int]$processId) { (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName }

function Save-Download([string]$url, [string]$target) {
  Write-Output "  Mengunduh $url"
  $curl = if (Test-Path -LiteralPath $windowsCurl) { $windowsCurl } else { "curl.exe" }
  & $curl -L --fail --silent --show-error -o $target $url
  if ($LASTEXITCODE -ne 0) { throw "Gagal mengunduh $url" }
}

function Install-Postgres {
  if (Test-Path -LiteralPath (Join-Path $pgBin "pg_ctl.exe")) { Write-Output "PostgreSQL portable sudah ada di $pgHome"; return }
  New-Item -ItemType Directory -Force -Path $Root | Out-Null
  $zip = Join-Path $env:TEMP "postgresql-$PostgresVersion-windows-x64-binaries.zip"
  # Reuse a complete download left by an earlier run that failed while extracting.
  if (-not ((Test-Path -LiteralPath $zip) -and (Get-Item -LiteralPath $zip).Length -gt 100MB)) {
    Save-Download "https://get.enterprisedb.com/postgresql/postgresql-$PostgresVersion-windows-x64-binaries.zip" $zip
  } else { Write-Output "  Memakai unduhan sebelumnya: $zip" }
  Write-Output "  Mengekstrak PostgreSQL (tanpa pgAdmin)..."
  Expand-ZipEntries $zip $Root @("pgsql/bin", "pgsql/lib", "pgsql/share")
  Remove-Item -LiteralPath $zip -Force
  Write-Output "PostgreSQL $PostgresVersion terpasang di $pgHome"
}

function Initialize-Database($db) {
  if (Test-Path -LiteralPath (Join-Path $pgData "PG_VERSION")) { Write-Output "Data PostgreSQL sudah ada di $pgData"; return }
  $pwFile = Join-Path $env:TEMP "tepatwaktu-pg-$([guid]::NewGuid()).txt"
  Set-Content -LiteralPath $pwFile -Value $db.Password -Encoding ASCII -NoNewline
  try {
    & (Join-Path $pgBin "initdb.exe") -D $pgData -U $db.User --pwfile=$pwFile -E UTF8 --locale=C --auth=scram-sha-256 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "initdb gagal." }
  } finally { Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue }
  Write-Output "Cluster PostgreSQL dibuat di $pgData (user $($db.User), password dari DATABASE_URL)."
}

function Start-Postgres($db) {
  $listener = Get-Listener $db.Port
  if ($listener) {
    $name = Get-ProcessName $listener.OwningProcess
    if ($name -eq "postgres") { Write-Output "PostgreSQL sudah berjalan di port $($db.Port)"; return }
    throw "Port $($db.Port) dipakai proses lain ($name, PID $($listener.OwningProcess)). Matikan dulu (mis. container Docker: docker compose stop postgres)."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $pgData "PG_VERSION"))) { throw "PostgreSQL belum disiapkan. Jalankan: npm run local:setup" }
  # pg_ctl leaves the server running in the background. Its output must NOT go through a PowerShell pipe
  # (| Out-Null): the server would inherit the pipe and PowerShell would wait for it until the server stops.
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $pgBin "pg_ctl.exe"
  $info.Arguments = "-D `"$pgData`" -l `"$pgLog`" -o `"-p $($db.Port) -c listen_addresses=localhost`" -w -t 60 start"
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $pgCtl = [System.Diagnostics.Process]::Start($info)
  $pgCtl.WaitForExit()
  if ($pgCtl.ExitCode -ne 0) { throw "PostgreSQL gagal menyala. Lihat log: $pgLog" }
  Write-Output "PostgreSQL berjalan di localhost:$($db.Port) (log: $pgLog)"
}

function Initialize-AppDatabase($db) {
  $env:PGPASSWORD = $db.Password
  try {
    $exists = & (Join-Path $pgBin "psql.exe") -h localhost -p $db.Port -U $db.User -d postgres -tAc "select 1 from pg_database where datname = '$($db.Database)'"
    if ($exists -ne "1") {
      & (Join-Path $pgBin "createdb.exe") -h localhost -p $db.Port -U $db.User $db.Database
      if ($LASTEXITCODE -ne 0) { throw "Gagal membuat database $($db.Database)." }
      Write-Output "Database $($db.Database) dibuat."
    } else { Write-Output "Database $($db.Database) sudah ada." }
  } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
}

function Stop-Postgres {
  if (-not (Test-Path -LiteralPath (Join-Path $pgData "postmaster.pid"))) { Write-Output "PostgreSQL sudah berhenti."; return }
  & (Join-Path $pgBin "pg_ctl.exe") -D $pgData -m fast -w stop | Out-Null
  Write-Output "PostgreSQL dihentikan."
}

function Install-Mailpit {
  if (Test-Path -LiteralPath $mailpitExe) { Write-Output "Mailpit sudah ada di $mailpitDir"; return }
  New-Item -ItemType Directory -Force -Path $mailpitDir | Out-Null
  $zip = Join-Path $env:TEMP "mailpit-windows-amd64.zip"
  Save-Download "https://github.com/axllent/mailpit/releases/download/$MailpitVersion/mailpit-windows-amd64.zip" $zip
  Expand-ZipEntries $zip $mailpitDir @("mailpit.exe")
  Remove-Item -LiteralPath $zip -Force
  Write-Output "Mailpit $MailpitVersion terpasang di $mailpitDir"
}

function Start-Mailpit {
  if (-not (Test-Path -LiteralPath $mailpitExe)) { Write-Output "Mailpit belum dipasang (lewati). Jalankan npm run local:setup untuk inbox email lokal."; return }
  $listener = Get-Listener 8025
  if ($listener) {
    if ((Get-ProcessName $listener.OwningProcess) -eq "mailpit") { Write-Output "Mailpit sudah berjalan: http://localhost:8025"; return }
    throw "Port 8025 dipakai proses lain (PID $($listener.OwningProcess))."
  }
  $arguments = @("--listen", "127.0.0.1:8025", "--smtp", "127.0.0.1:1025", "--database", (Join-Path $mailpitDir "mailpit.db"))
  $process = Start-Process -FilePath $mailpitExe -ArgumentList $arguments -WorkingDirectory $mailpitDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $mailpitDir "mailpit.log") -RedirectStandardError (Join-Path $mailpitDir "mailpit-error.log") -PassThru
  Set-Content -LiteralPath $mailpitPid -Value $process.Id -Encoding ASCII
  Write-Output "Mailpit berjalan: inbox http://localhost:8025, SMTP localhost:1025"
}

function Stop-Mailpit {
  $processId = $null
  if (Test-Path -LiteralPath $mailpitPid) { $processId = [int](Get-Content -LiteralPath $mailpitPid -Raw).Trim() }
  if (-not $processId) { $listener = Get-Listener 8025; if ($listener) { $processId = $listener.OwningProcess } }
  $process = if ($processId) { Get-Process -Id $processId -ErrorAction SilentlyContinue } else { $null }
  if ($process -and $process.Path -and ([IO.Path]::GetFullPath($process.Path) -ieq [IO.Path]::GetFullPath($mailpitExe))) {
    Stop-Process -InputObject $process -Force
    Write-Output "Mailpit dihentikan."
  } else { Write-Output "Mailpit sudah berhenti." }
  Remove-Item -LiteralPath $mailpitPid -Force -ErrorAction SilentlyContinue
}

function Invoke-Storage([string]$script) {
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $script) -StorageRoot $Root
  if ($LASTEXITCODE -ne 0) { throw "Object storage: $output" }
  $output
}

function Show-Status {
  $db = Get-DbConfig
  $storagePort = 18334
  $endpoint = Read-EnvValue "OBJECT_STORAGE_ENDPOINT"
  if ($endpoint -match ':(\d+)/?$') { $storagePort = [int]$Matches[1] }
  foreach ($item in @(@("PostgreSQL", $db.Port, "postgres"), @("Object storage", $storagePort, "weed"), @("Mailpit (inbox :8025)", 8025, "mailpit"), @("Web (npm run dev)", 3000, "node"))) {
    $listener = Get-Listener $item[1]
    $state = if (-not $listener) { "berhenti" } else { $name = Get-ProcessName $listener.OwningProcess; if ($name -eq $item[2]) { "berjalan" } else { "port dipakai $name" } }
    "{0,-24} port {1,-6} {2}" -f $item[0], $item[1], $state
  }
}

switch ($Action) {
  "setup" {
    $db = Get-DbConfig
    if (-not (Test-Path -LiteralPath (Join-Path $Root "weed.exe"))) { Write-Warning "Object storage (weed.exe) tidak ada di $Root. Unduh SeaweedFS windows_amd64 dari https://github.com/seaweedfs/seaweedfs/releases dan taruh weed.exe di $Root." }
    Install-Postgres
    Initialize-Database $db
    Start-Postgres $db
    Initialize-AppDatabase $db
    Install-Mailpit
    Write-Output ""
    Write-Output "Setup selesai. Langkah berikutnya: npm run local:start, npm run db:migrate, lalu npm run dev"
  }
  "start" {
    $db = Get-DbConfig
    Start-Postgres $db
    Invoke-Storage "start-object-storage.ps1"
    Start-Mailpit
    Write-Output ""
    Write-Output "Semua service lokal menyala. Jalankan aplikasi: npm run dev  ->  http://localhost:3000"
  }
  "stop" {
    Stop-Mailpit
    Invoke-Storage "stop-object-storage.ps1"
    Stop-Postgres
  }
  "status" { Show-Status }
  "import-docker" {
    # One-time copy of the database inside the Docker volume into the local PostgreSQL (replaces local data).
    $db = Get-DbConfig
    Start-Postgres $db
    $dump = Join-Path $Root "docker-db.dump"
    Write-Output "Menyalakan container postgres Docker sementara di port 55432..."
    $env:POSTGRES_PORT = "55432"
    & docker compose -f (Join-Path $workspace "docker-compose.yml") up -d --wait postgres
    if ($LASTEXITCODE -ne 0) { throw "Container postgres Docker gagal menyala. Pastikan Docker Desktop berjalan." }
    & docker exec tepatwaktu-postgres pg_dump -U postgres -Fc -f /tmp/tepatwaktu.dump tepatwaktu
    if ($LASTEXITCODE -ne 0) { throw "pg_dump di container gagal." }
    & docker cp tepatwaktu-postgres:/tmp/tepatwaktu.dump $dump
    & docker compose -f (Join-Path $workspace "docker-compose.yml") stop postgres | Out-Null
    $env:PGPASSWORD = $db.Password
    try {
      & (Join-Path $pgBin "dropdb.exe") -h localhost -p $db.Port -U $db.User --if-exists $db.Database
      & (Join-Path $pgBin "createdb.exe") -h localhost -p $db.Port -U $db.User $db.Database
      & (Join-Path $pgBin "pg_restore.exe") -h localhost -p $db.Port -U $db.User -d $db.Database --no-owner --no-privileges $dump
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    Write-Output "Database Docker disalin ke PostgreSQL lokal (file dump: $dump)."
  }
}
