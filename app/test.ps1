param([string]$Python = 'python', [string]$Node = 'node')
$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$bundledPython = Join-Path $runtime 'python\python.exe'
$bundledNode = Join-Path $runtime 'node\bin\node.exe'
if ($Python -eq 'python' -and (Test-Path -LiteralPath $bundledPython)) { $Python = $bundledPython }
if ($Node -eq 'node' -and (Test-Path -LiteralPath $bundledNode)) { $Node = $bundledNode }
& $Python -m unittest discover -s (Join-Path $PSScriptRoot 'tests') -v
if ($LASTEXITCODE -ne 0) { throw 'Python checks failed.' }
& $Node --test (Join-Path $PSScriptRoot 'tests\map.test.mjs') (Join-Path $PSScriptRoot 'tests\geometry.test.mjs') (Join-Path $PSScriptRoot 'tests\heatmap.test.mjs')
if ($LASTEXITCODE -ne 0) { throw 'JavaScript checks failed.' }
