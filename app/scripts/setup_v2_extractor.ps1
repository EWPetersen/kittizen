$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$archive=Join-Path $taskRoot '.devtools/starbreaker-v0.3.2.zip'
$target=Join-Path $taskRoot '.devtools/starbreaker-v0.3.2'
New-Item -ItemType Directory -Force -Path (Split-Path $archive -Parent) | Out-Null
Invoke-WebRequest 'https://github.com/diogotr7/StarBreaker/releases/download/v0.3.2/starbreaker-cli-v0.3.2-windows-x86_64.zip' -OutFile $archive
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() -ne 'fafd65ca002b9c3bb88ce32199b2345affcdb358655c68c41d0e93574a5d8a3d'){throw 'StarBreaker release checksum mismatch'}
Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
Write-Output 'Verified StarBreaker v0.3.2 installed locally. Run scripts/build_v2_catalog.py to extract the catalogue.'
