$projectRoot = Split-Path -Parent $PSScriptRoot
$baseCompose = Join-Path $projectRoot 'compose.yaml'
$quickCompose = Join-Path $projectRoot 'compose.quick.yaml'
$composeArgs = @('-f', $baseCompose, '-f', $quickCompose)
$portEntry = Get-Content -LiteralPath (Join-Path $projectRoot '.env') | Where-Object { $_ -match '^BARDO_PORT=' } | Select-Object -Last 1
$port = if ($portEntry -and ($portEntry -split '=', 2)[1] -match '^\d+$') { ($portEntry -split '=', 2)[1] } else { '8088' }

docker compose @composeArgs up -d --build quick-tunnel
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el túnel de Cloudflare.' }

$publicUrl = $null
for ($attempt = 0; $attempt -lt 45; $attempt++) {
  try {
    $info = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/library/info" -TimeoutSec 3
    if ($info.publicUrl -match '^https://[a-z0-9-]+\.trycloudflare\.com/$') {
      $publicUrl = $info.publicUrl
      break
    }
  } catch { }
  Start-Sleep -Seconds 1
}
if (-not $publicUrl) { throw 'Cloudflare no entregó una URL. Revisa docker compose -f compose.yaml -f compose.quick.yaml logs quick-tunnel.' }

Write-Output "Dirección temporal de Bardo: $publicUrl"
Write-Output 'Abre Compartir biblioteca y pulsa Generar invitación para obtener el enlace de tu amigo.'
