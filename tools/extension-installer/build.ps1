$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = (Resolve-Path (Join-Path $projectDir '..\..')).Path
$extension = Join-Path $root 'frontend\extension'
$assets = Join-Path $projectDir 'Assets'
$destination = Join-Path (Split-Path -Parent $root) 'Bardo-Extension-Instalador'

New-Item -ItemType Directory -Force -Path $assets, $destination | Out-Null
$zip = Join-Path $assets 'extension.zip'
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip }
Compress-Archive -Path (Join-Path $extension '*') -DestinationPath $zip -CompressionLevel Optimal

dotnet publish (Join-Path $projectDir 'BardoInstaller.csproj') `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o $destination

if ($LASTEXITCODE -ne 0) { throw 'Falló dotnet publish.' }
Copy-Item -LiteralPath (Join-Path $projectDir 'LEEME-instalar.md') -Destination (Join-Path $destination 'LEEME.md') -Force
foreach ($obsolete in @('Bardo-Extension-0.2.3.zip', 'Instalar-Bardo.cmd', 'Instalar-Bardo-Extension.pdb')) {
  $path = Join-Path $destination $obsolete
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
}
Get-Item -LiteralPath (Join-Path $destination 'Instalar-Bardo-Extension.exe') |
  Select-Object FullName, Length, LastWriteTime
