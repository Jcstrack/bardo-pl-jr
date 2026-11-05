$projectRoot = Split-Path -Parent $PSScriptRoot
$baseCompose = Join-Path $projectRoot 'compose.yaml'
$quickCompose = Join-Path $projectRoot 'compose.quick.yaml'
$configPath = Join-Path $projectRoot '.env'
$composeArgs = @('-f', $baseCompose, '-f', $quickCompose)

docker compose @composeArgs up -d --force-recreate quick-tunnel
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el túnel de Cloudflare.' }

$publicUrl = $null
for ($attempt = 0; $attempt -lt 45; $attempt++) {
  Start-Sleep -Seconds 1
  $logs = (docker compose @composeArgs logs --no-color --no-log-prefix quick-tunnel 2>&1) -join "`n"
  $match = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { $publicUrl = $match.Value.TrimEnd('/') + '/'; break }
}
if (-not $publicUrl) { throw 'Cloudflare no entregó una URL. Revisa docker compose -f compose.yaml -f compose.quick.yaml logs quick-tunnel.' }

$configText = [IO.File]::ReadAllText($configPath)
if ($configText -match '(?m)^BARDO_PUBLIC_URL=') {
  $configText = [regex]::Replace($configText, '(?m)^BARDO_PUBLIC_URL=.*$', "BARDO_PUBLIC_URL=$publicUrl")
} else {
  $configText += "`nBARDO_PUBLIC_URL=$publicUrl`n"
}
[IO.File]::WriteAllText($configPath, $configText)
docker compose -f $baseCompose up -d library
if ($LASTEXITCODE -ne 0) { throw 'El túnel está activo, pero la biblioteca no pudo publicar la URL en el reproductor.' }
Write-Output "Dirección temporal de Bardo: $publicUrl"
Write-Output 'Abre Compartir biblioteca y pulsa Generar invitación para obtener el enlace de tu amigo.'
