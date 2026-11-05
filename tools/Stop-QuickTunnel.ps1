$projectRoot = Split-Path -Parent $PSScriptRoot
$baseCompose = Join-Path $projectRoot 'compose.yaml'
$quickCompose = Join-Path $projectRoot 'compose.quick.yaml'

docker compose -f $baseCompose -f $quickCompose stop quick-tunnel
if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener el túnel de Cloudflare.' }
Write-Output 'Enlace temporal desactivado. La biblioteca local sigue guardada.'
