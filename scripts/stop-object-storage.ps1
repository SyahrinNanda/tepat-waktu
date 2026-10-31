param(
  [string]$StorageRoot = "D:\mini-data",
  [int]$S3Port = 18334
)

$weedBinary = Join-Path $StorageRoot "weed.exe"
$dataPath = Join-Path $StorageRoot "tepatwaktu"
$pidPath = Join-Path $dataPath "tepatwaktu-storage.pid"
$processId = $null

if (Test-Path -LiteralPath $pidPath -PathType Leaf) {
  $savedPid = (Get-Content -LiteralPath $pidPath -Raw).Trim()
  if ($savedPid -match '^\d+$') {
    $processId = [int]$savedPid
  }
}

if (-not $processId) {
  $connection = Get-NetTCPConnection -LocalPort $S3Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) {
    $processId = $connection.OwningProcess
  }
}

if (-not $processId) {
  if (Test-Path -LiteralPath $pidPath) {
    Remove-Item -LiteralPath $pidPath -Force
  }
  Write-Output "Object storage TepatWaktu sudah berhenti. Tidak ada listener pada port $S3Port."
  exit 0
}

$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
if (-not $process) {
  if (Test-Path -LiteralPath $pidPath) {
    Remove-Item -LiteralPath $pidPath -Force
  }
  Write-Output "Object storage TepatWaktu sudah berhenti. PID tersimpan sudah tidak aktif."
  exit 0
}

if (-not $process.Path -or ([IO.Path]::GetFullPath($process.Path) -ine [IO.Path]::GetFullPath($weedBinary))) {
  throw "Proses PID $processId bukan executable object storage TepatWaktu ($weedBinary). Proses tidak dihentikan."
}

Stop-Process -InputObject $process -ErrorAction Stop
if (-not $process.WaitForExit(10000)) {
  Stop-Process -Id $processId -Force -ErrorAction Stop
  $process.WaitForExit(5000) | Out-Null
}

if (Test-Path -LiteralPath $pidPath) {
  Remove-Item -LiteralPath $pidPath -Force
}

$remaining = Get-NetTCPConnection -LocalPort $S3Port -State Listen -ErrorAction SilentlyContinue
if ($remaining) {
  throw "Proses berhenti, tetapi port $S3Port masih digunakan proses lain (PID $($remaining.OwningProcess))."
}

Write-Output "Object storage TepatWaktu berhasil dihentikan (PID $processId)."
