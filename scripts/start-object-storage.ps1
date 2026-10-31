param(
  [string]$StorageRoot = "D:\mini-data",
  [int]$S3Port = 18334
)

$weedBinary = Join-Path $StorageRoot "weed.exe"
$dataPath = Join-Path $StorageRoot "tepatwaktu"
$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logPath = Join-Path $workspacePath "object-storage.log"
$errorLogPath = Join-Path $workspacePath "object-storage-error.log"
$pidPath = Join-Path $dataPath "tepatwaktu-storage.pid"

if (-not (Test-Path -LiteralPath $weedBinary -PathType Leaf)) {
  throw "Binary S3-compatible lokal tidak ditemukan di $weedBinary."
}
if (-not (Test-Path -LiteralPath $dataPath -PathType Container)) {
  New-Item -ItemType Directory -Path $dataPath | Out-Null
}

$existing = Get-NetTCPConnection -LocalPort $S3Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  $existingProcess = Get-Process -Id $existing.OwningProcess -ErrorAction SilentlyContinue
  if ($existingProcess -and $existingProcess.Path -and ([IO.Path]::GetFullPath($existingProcess.Path) -ieq [IO.Path]::GetFullPath($weedBinary))) {
    Set-Content -LiteralPath $pidPath -Value $existingProcess.Id -Encoding ASCII
  }
  Write-Output "Object storage sudah berjalan di http://127.0.0.1:$S3Port"
  exit 0
}

$arguments = @(
  "server",
  "-dir=$dataPath",
  "-ip=127.0.0.1",
  "-ip.bind=127.0.0.1",
  "-master.port=19334",
  "-volume.port=18081",
  "-volume.max=20",
  "-filer.port=18889",
  "-s3",
  "-s3.port=$S3Port",
  "-s3.port.iceberg=18182",
  "-s3.port.lance=19102",
  "-iam.port=18112",
  "-master.telemetry=false"
)

# The host development environment may define DEBUG=release. SeaweedFS maps
# environment variables to flags and expects this value to be boolean.
$env:DEBUG = "false"
$process = Start-Process -FilePath $weedBinary -ArgumentList $arguments -WorkingDirectory $dataPath -WindowStyle Hidden -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru
Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ASCII
Write-Output "Object storage TepatWaktu berjalan dengan PID $($process.Id). Endpoint: http://127.0.0.1:$S3Port, Data: $dataPath"
