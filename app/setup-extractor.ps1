param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if ($Python -eq 'python' -and (Test-Path -LiteralPath $bundledPython)) { $Python = $bundledPython }
if (-not (Get-Command $Python -ErrorAction SilentlyContinue)) {
    $Python = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (-not (Test-Path -LiteralPath $Python)) { throw 'Python 3.10+ is required. Supply -Python with its full path.' }
}
& $Python -m pip install --upgrade --target (Join-Path $PSScriptRoot '.extractor') -r (Join-Path $PSScriptRoot 'scripts\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Extractor dependency installation failed.' }
