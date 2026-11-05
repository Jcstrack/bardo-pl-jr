# Bardo Politanense JR

Reproductor flotante en React con álbumes compartidos y salida opcional a un bot de Discord. La música subida se guarda en este ordenador. [INFORME.md](INFORME.md) describe la arquitectura y sus límites.

| Carpeta | Función |
| --- | --- |
| `frontend/` | React, reproductor y extensión opcional para controlar pestañas |
| `library/` | API, base SQLite y almacenamiento de audios |
| `bot/` | Comandos y voz de Discord |
| `proxy/` | Nginx, caché y páginas de error |
| `tools/` | Scripts para activar la cuenta local e iniciar/detener el enlace temporal |

## Iniciar Bardo

Necesitas Docker Desktop en el ordenador anfitrión. `.env` contiene rutas a archivos secretos, no los secretos; en este equipo ya está configurado.

```powershell
cd C:\Users\juaul\OneDrive\Escritorio\PROYECTO\POLITANIA\bardo-politanense-jr
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Abre [http://localhost:8088/](http://localhost:8088/) en este ordenador. Los puertos de Bardo escuchan solo en `127.0.0.1`; otros dispositivos entran por el túnel HTTPS, sin ver tu IP doméstica.

## Compartir con tu amigo sin códigos adicionales

Inicia el enlace temporal:

```powershell
./tools/Start-QuickTunnel.ps1
```

En el reproductor abre **Canciones → Compartir biblioteca → Generar invitación → Copiar** y envía **ese enlace completo** a tu amigo. Al abrirlo, Bardo activa su acceso automáticamente, incluso si pega la invitación en una pestaña donde Bardo ya estaba abierto; no hay correo ni PIN. El catálogo se lee de la misma base de datos y ambos pueden agregar, editar y quitar canciones y álbumes. En Brave, la extensión solo hace falta para controlar otra pestaña: se entrega por separado.

El enlace completo es una credencial: quien lo reciba también podrá entrar. Guárdalo solo para tu amigo. Detén el túnel con `./tools/Stop-QuickTunnel.ps1`. Cuando lo reinicies, la dirección cambiará y deberás copiar una invitación nueva desde el botón. Cloudflare Quick Tunnels no ofrece URL fija ni garantía de disponibilidad; para una dirección permanente hará falta configurar un dominio. [Documentación de Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Importar las canciones que ya tenías

Los datos de `localStorage` pertenecen a la dirección exacta y al perfil de navegador donde se crearon. En este equipo, Bardo reconoce al propietario automáticamente al abrir `http://localhost:8088/` y ya importó **7 álbumes y 39 canciones** de Brave a la biblioteca del servidor. Si tenías canciones adicionales bajo `http://localhost:5173/`, abre esa dirección en el mismo perfil para importarlas también. Los atajos privados de activación quedan como respaldo; puedes regenerarlos con:

```powershell
./tools/Create-Invites.ps1
```

La base principal es `C:\Users\juaul\Documents\Codex\bardo-data\library.sqlite`. Los archivos subidos viven en `bardo-data\uploads`. El antiguo `library.json` se conserva como respaldo de migración. `localStorage` mantiene una copia rápida para la interfaz e IndexedDB conserva archivos pendientes. El servidor es la fuente compartida; haz copia de toda la carpeta `bardo-data` con Bardo detenido para respaldar también los archivos `-wal` de SQLite.

La API permite consultar, crear, actualizar y eliminar álbumes y canciones mediante `/api/library/albums`, `/api/library/albums/:id`, `/api/library/tracks` y `/api/library/tracks/:id`. Las operaciones necesitan una sesión de propietario o invitado. La interfaz conserva `/api/library/sync` para aplicar cambios y ordenaciones en un solo paso. Consulta [library/README.md](library/README.md) para los cuerpos JSON y las respuestas.

### Extensión de Brave

Entrega a tu amigo [Bardo-Extension-0.2.1.zip](../Bardo-Extension-Instalador/Bardo-Extension-0.2.1.zip) desde `C:\Users\juaul\OneDrive\Escritorio\PROYECTO\POLITANIA\Bardo-Extension-Instalador`. Debe extraer el ZIP y seguir `LEEME.md` para cargar la carpeta `extension` desde `brave://extensions/`. Brave requiere esa confirmación dentro del navegador. La extensión reconoce la dirección HTTPS temporal de Bardo y permite controlar la pestaña que el usuario conecte.

## Bot de Discord

1. Abre la [invitación del bot](https://discord.com/oauth2/authorize?client_id=1567243383431237793&scope=bot%20applications.commands&permissions=3146752) y autoriza Ver canal, Conectar y Hablar. En `ElFuturoesHoy` ya está instalado.
2. Entra a un canal de voz y ejecuta `/conectar` en Discord. El bot te entrega un código temporal de vinculación.
3. En el reproductor abre **Bot de Discord**, pega el código, activa **Modo Discord** y selecciona una pestaña con audio.
4. Consulta `/estado` o usa `/salir` para desconectarlo. Tras reiniciar el bot, ejecuta `/conectar` otra vez.

El bot conserva un búfer de **1200 ms** que evita cortes. Durante un salto, el punto principal indica el destino solicitado y una marca secundaria muestra la posición que aún sale por Discord; al terminar el búfer vuelven a coincidir. La captura de pestaña la solicita tu navegador al activar el modo; el enlace HTTPS permite usarla desde otro ordenador.

## Mantenimiento

```powershell
docker compose -f compose.yaml -f compose.quick.yaml ps
docker compose logs --tail=50 frontend library bot
./tools/Stop-QuickTunnel.ps1
docker compose down
```

El sitio incluye páginas 404 y 50x. Los archivos CSS y JS con hash se guardan en caché; el HTML se revalida. Las canciones subidas a Bardo se sirven con soporte de `Range` y requieren la sesión de invitado. Los enlaces de YouTube y Spotify siguen dependiendo de los permisos de inserción, inicio de sesión y reproducción de esos servicios; si YouTube falla, el reproductor ofrece mostrar el video o abrirlo en YouTube. La extensión de Brave es opcional para controlar medios de otra pestaña; no es necesaria para escuchar archivos subidos.
