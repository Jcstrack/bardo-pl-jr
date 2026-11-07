# Instalador de la extensión Bardo Politanense JR

Envía **solo `Instalar-Bardo-Extension.exe`**. El archivo incluye la extensión y el runtime; la otra persona no necesita Node, pnpm ni .NET.

## Instalación

1. Abre el `.exe` en Windows, elige **Brave**, **Opera GX** u **Opera** (tercera opción) y pulsa **Instalar**. Si un navegador no está instalado, la opción lo indica.
2. El instalador crea un perfil propio, abre el navegador con la extensión activa y deja un acceso directo **Bardo Politanense JR (Brave)** en el escritorio (o el nombre del navegador elegido).
3. Para volver a usar la extensión, abre Bardo desde ese acceso directo. El enlace de invitación de la biblioteca se puede pegar allí.

No hay que activar Modo desarrollador ni cargar carpetas a mano. El perfil habitual del navegador, sus contraseñas y sus sesiones no se modifican. La extensión se carga automáticamente al abrir el acceso directo; cerrar el navegador también cierra el proceso auxiliar.

El programa es local y está sin firma de código. Windows puede mostrar una advertencia de SmartScreen al abrir un ejecutable compartido. Esa confirmación del sistema no puede eliminarse sin distribuir un instalador firmado y reconocido.

## Compatibilidad

- **Brave para Windows:** probado con una instalación temporal y verificación de la extensión habilitada.
- **Opera GX para Windows:** probado con una instalación temporal y una instalación local: Opera GX reportó la extensión habilitada y abrió el perfil propio.
- **Opera normal para Windows:** probado con una instalación temporal y una instalación local: Opera confirmó la extensión habilitada y se creó el acceso directo de su perfil propio.

La instalación automática en el perfil personal habitual de Brave u Opera no está disponible de forma soportada para extensiones locales fuera de sus tiendas. Por eso Bardo usa un perfil propio con acceso directo. Para instalar desde el perfil habitual mediante un botón del navegador, habría que publicar la extensión en Chrome Web Store u Opera Add-ons y pasar su revisión.

## Archivos y privacidad

Los archivos quedan en `%LOCALAPPDATA%\BardoPolitanenseExtension`, separados de los datos del bot. El instalador no incluye música, token del bot ni enlaces de invitación. El canal de depuración usado para cargar la extensión es una tubería privada del proceso; no abre un puerto TCP.
