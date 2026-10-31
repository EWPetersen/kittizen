param([string]$Python = 'python', [string]$BindAddress = '127.0.0.1', [int]$Port = 8077, [switch]$SkipGameUpdate, [switch]$NoGameWatch, [string]$GamePath = 'D:\Games\Roberts Space Industries\StarCitizen\LIVE')
$ErrorActionPreference = 'Stop'
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if ($Python -eq 'python' -and (Test-Path -LiteralPath $bundledPython)) { $Python = $bundledPython }
if (-not (Get-Command $Python -ErrorAction SilentlyContinue)) {
    $bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundledPython) { $Python = $bundledPython }
    else { throw 'Python 3.10+ is required. Pass -Python with the full path to python.exe.' }
}
if (-not $SkipGameUpdate) {
    & $Python (Join-Path $PSScriptRoot 'scripts\update_game_data.py') --game $GamePath
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Using the last good catalogue; see the updater error above.' }
}
$serverArguments = @((Join-Path $PSScriptRoot 'server.py'), '--host', $BindAddress, '--port', $Port, '--game', $GamePath)
if ($NoGameWatch) { $serverArguments += '--no-game-watch' }
& $Python @serverArguments
if ($LASTEXITCODE -ne 0) { throw "Application server exited with code $LASTEXITCODE" }
