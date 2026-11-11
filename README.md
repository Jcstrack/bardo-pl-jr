# Bardo Politanense

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

En el reproductor abre **Canciones → Compartir biblioteca → Crear invitación**. Ponle un nombre, elige duración y marca si esa persona puede agregar, editar o eliminar música; escuchar siempre está permitido. Copia **el enlace completo**. Al abrirlo, Bardo activa su acceso automáticamente, sin correo ni PIN. En **Mis enlaces** puedes copiarlo otra vez, cambiar vencimiento y permisos o darlo de baja. Solo el anfitrión ve esa lista. En Brave, la extensión solo hace falta para controlar otra pestaña: se entrega por separado.

El túnel escribe su dirección actual en un volumen privado de Docker y la API la lee al mostrar o generar la invitación. No hace falta copiar la URL a `.env` ni reiniciar la biblioteca cuando Cloudflare cambia la dirección. Si el túnel se detiene, el botón espera a que exista una dirección nueva.

El enlace completo es una credencial: quien lo reciba también podrá entrar. Guárdalo solo para tu amigo. Detén el túnel con `./tools/Stop-QuickTunnel.ps1`. Cuando lo reinicies, la dirección cambiará; abre **Mis enlaces** y copia la invitación con la dirección actual. Cloudflare Quick Tunnels no ofrece URL fija ni garantía de disponibilidad; para una dirección permanente hará falta configurar un dominio. [Documentación de Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Importar las canciones que ya tenías

Los datos de `localStorage` pertenecen a la dirección exacta y al perfil de navegador donde se crearon. En este equipo, Bardo reconoce al propietario automáticamente al abrir `http://localhost:8088/`. Esa es la única dirección local publicada para el frontend. Los atajos privados de activación quedan como respaldo; puedes regenerar el de `localhost:8088` con:

```powershell
./tools/Create-Invites.ps1
```

La base principal es `C:\Users\juaul\Documents\Codex\bardo-data\library.sqlite`. Los archivos subidos viven en `bardo-data\uploads`. El antiguo `library.json` se conserva como respaldo de migración. `localStorage` mantiene una copia rápida para la interfaz e IndexedDB conserva archivos pendientes. El servidor es la fuente compartida; haz copia de toda la carpeta `bardo-data` con Bardo detenido para respaldar también los archivos `-wal` de SQLite.

La API permite consultar, crear, actualizar y eliminar álbumes y canciones mediante `/api/library/albums`, `/api/library/albums/:id`, `/api/library/tracks` y `/api/library/tracks/:id`. Las operaciones necesitan una sesión de propietario o invitado. La interfaz conserva `/api/library/sync` para aplicar cambios y ordenaciones en un solo paso. Consulta [library/README.md](library/README.md) para los cuerpos JSON y las respuestas.

### Extensión del navegador

Entrega a tu amigo [Instalar-Bardo-Extension.exe](../Bardo-Extension-Instalador/Instalar-Bardo-Extension.exe) desde `C:\Users\juaul\OneDrive\Escritorio\PROYECTO\POLITANIA\Bardo-Extension-Instalador`. Abre el ejecutable, elige **Brave**, **Opera GX** u **Opera** (tercera opción) y pulsa **Instalar**: crea un perfil propio, carga la extensión automáticamente y deja un acceso directo en el escritorio. Para usarla después debe abrir Bardo desde ese acceso directo. No requiere Modo desarrollador. El perfil habitual no se modifica. La carga automática se probó en los tres navegadores con perfiles temporales. Consulta [LEEME.md](../Bardo-Extension-Instalador/LEEME.md).

## Bot de Discord

1. Abre la [invitación del bot para servidores](https://discord.com/oauth2/authorize?client_id=1567243383431237793&scope=bot%20applications.commands&permissions=3146752&integration_type=0) y autoriza Ver canal, Conectar y Hablar. Quien lo instala debe poder administrar ese servidor. En `ElFuturoesHoy` ya está instalado.
2. Entra a un canal de voz y ejecuta `/conectar` en Discord. El bot te entrega un código temporal de vinculación.
3. En el reproductor abre **Bot de Discord**, pega el código, activa **Modo Discord** y selecciona una pestaña con audio.
4. Consulta `/estado`. Usa `/salir` para sacarlo del canal sin perder la vinculación: al volver a reproducir música, regresa al mismo canal. Usa `/desconectar` para terminar la vinculación y salir. Tras reiniciar el bot o cerrar la página, ejecuta `/conectar` otra vez.

Para crear otro enlace, abre **Discord Developer Portal → Bardo Politanense JR → OAuth2 → URL Generator**, marca los ámbitos `bot` y `applications.commands`, selecciona **Guild Install / Instalación de servidor** y los permisos **View Channels / Ver canales**, **Connect / Conectar** y **Speak / Hablar**. Copia la URL generada. Si otra persona debe instalarlo, revisa que **Bot → Public Bot** esté activado y que **Installation → Guild Install** esté habilitado. La cifra `3146752` de la URL anterior representa esos tres permisos.

Para cambiar permisos de un bot ya instalado, abre en Discord **Ajustes del servidor → Roles → Bardo Politanense JR** y ajusta su rol. Revisa también los permisos específicos del canal de voz. Los permisos de los comandos `/conectar`, `/estado`, `/salir` y `/desconectar` se ajustan en **Ajustes del servidor → Integraciones → Bardo Politanense JR**. Si cambias los permisos solicitados por defecto en el Portal, genera y comparte una URL nueva para futuras instalaciones.

El bot conserva un búfer de **1200 ms** que evita cortes. Durante un salto, el punto principal indica el destino solicitado y una marca secundaria muestra la posición que aún sale por Discord; al terminar el búfer vuelven a coincidir. La captura de pestaña la solicita tu navegador al activar el modo; el enlace HTTPS permite usarla desde otro ordenador.

### Controles del reproductor

- **Anterior:** un clic vuelve al inicio de la canción actual; dos clics seguidos, dentro de 1,5 segundos, cambian a la canción anterior. Funciona también en el reproductor minimizado.
- **Clic derecho en Play o Repetir:** marca el inicio y un punto de término. El término aparece inicialmente 10 segundos por delante para que se vea el tramo; puedes arrastrarlo al segundo exacto. Las marcas se guardan con cada canción.
- **Buscar:** la lupa junto al selector de álbum abre un buscador flotante por título o artista en toda la biblioteca. Cada resultado indica sus álbumes y elegirlo reproduce la canción sin cambiar su orden.
- **Álbumes:** el botón de tres puntos abre las opciones para crear o administrar un álbum. En el modal puedes cambiar de álbum, renombrarlo, ordenar sus canciones arrastrando el icono o con Alt + flechas, editar una canción y eliminar el álbum.
- **Volumen:** un clic abre la barra; dentro de ella puedes silenciar y recuperar el nivel anterior. El clic derecho sobre el icono también alterna silencio.
- **Video:** **Mostrar video** amplía el iframe dentro del reproductor; al ocultarlo vuelve a escala cero sin reiniciar el audio. En la ventana flotante y minimizada se muestra solo el icono. Si se abre desde la vista minimizada, el reproductor se expande para darle espacio.
- **Teclas multimedia:** Play/Pausa, Pista anterior y Pista siguiente usan las teclas multimedia del navegador. En este teclado corresponden a Fn + Ñ, Fn + L y Fn + `{`; el sistema debe entregar esos eventos a Brave u Opera.

## Mantenimiento

```powershell
docker compose -f compose.yaml -f compose.quick.yaml ps
docker compose logs --tail=50 frontend library bot
./tools/Stop-QuickTunnel.ps1
docker compose down
```

El sitio incluye páginas 404 y 50x. Los archivos CSS y JS con hash se guardan en caché; el HTML se revalida. Las canciones subidas a Bardo se sirven con soporte de `Range` y requieren la sesión de invitado. Los enlaces de YouTube y Spotify siguen dependiendo de los permisos de inserción, inicio de sesión y reproducción de esos servicios; si YouTube falla, el reproductor ofrece mostrar el video o abrirlo en YouTube. La extensión de Brave es opcional para controlar medios de otra pestaña; no es necesaria para escuchar archivos subidos.
