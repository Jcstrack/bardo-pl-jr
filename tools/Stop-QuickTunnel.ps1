$projectRoot = Split-Path -Parent $PSScriptRoot
$baseCompose = Join-Path $projectRoot 'compose.yaml'
$quickCompose = Join-Path $projectRoot 'compose.quick.yaml'
$configPath = Join-Path $projectRoot '.env'

docker compose -f $baseCompose -f $quickCompose stop quick-tunnel
$configText = [IO.File]::ReadAllText($configPath)
$configText = [regex]::Replace($configText, '(?m)^BARDO_PUBLIC_URL=.*$', 'BARDO_PUBLIC_URL=')
[IO.File]::WriteAllText($configPath, $configText)
docker compose -f $baseCompose up -d library
Write-Output 'Enlace temporal desactivado. La biblioteca local sigue guardada.'
