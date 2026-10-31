$ErrorActionPreference='Stop'
$target=Join-Path $PSScriptRoot '../.devtools/cgf-converter-v2.0.0.exe'
$expected='75feca2813a6517cad9a8e5df28687860a3b0bab9dcbcfeef65e56850d53b0b7'
New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
if (-not (Test-Path -LiteralPath $target)) {
    Invoke-WebRequest 'https://github.com/Markemp/Cryengine-Converter/releases/download/v2.0.0/cgf-converter.exe' -OutFile $target
}
if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLower() -ne $expected) { throw 'Converter checksum mismatch; do not run this file.' }
Write-Output 'Verified Cryengine Converter v2.0.0. Game files remain unchanged.'
