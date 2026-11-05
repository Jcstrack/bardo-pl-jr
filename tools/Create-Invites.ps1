$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot '.env'
$entry = Get-Content -LiteralPath $configPath | Where-Object { $_ -match '^LIBRARY_EDITOR_KEY_FILE=' } | Select-Object -Last 1
if (-not $entry) { throw 'Falta LIBRARY_EDITOR_KEY_FILE en .env.' }
$keyPath = ($entry -split '=', 2)[1]
$key = (Get-Content -LiteralPath $keyPath -Raw).Trim()
if ($key -notmatch '^[a-f0-9]{64}$') { throw 'La clave de invitación no es válida.' }

function Save-Shortcut([string]$name, [string]$baseUrl) {
  $shortcutPath = Join-Path $projectRoot $name
  [IO.File]::WriteAllText($shortcutPath, "[InternetShortcut]`r`nURL=$baseUrl#invite=$key`r`n")
  Write-Output "Creado: $shortcutPath"
}

Save-Shortcut 'Activar-Edicion-Local-8088.url' 'http://localhost:8088/'
Save-Shortcut 'Activar-Edicion-127-8088.url' 'http://127.0.0.1:8088/'
Save-Shortcut 'Activar-Edicion-Local-5173.url' 'http://localhost:5173/'
Save-Shortcut 'Activar-Edicion-127-5173.url' 'http://127.0.0.1:5173/'
