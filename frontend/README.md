# Sonora · Reproductor flotante en React

## Estructura de `src`

- `App.jsx`: coordina reproducción, biblioteca, captura y ventana flotante.
- `components/player/`: controles, barra de tiempo, lista, álbumes, formularios y menús del reproductor.
- `components/media/`: adaptadores de YouTube y Spotify.
- `components/layout/` y `components/ui/`: cabecera e iconos/avisos compartidos.
- `hooks/`: consulta del estado del bot.
- `lib/`: enlaces, almacenamiento y funciones de tiempo.
- `styles/`: estilos base y del reproductor.

Ejemplo de reproductor de audio hecho con React y Vite. La primera vez solo aparece el botón de nota musical. Este abre una tarjeta adaptable y arrastrable con álbumes, lista, progreso, anterior/siguiente, pausa y repetición. El volumen aparece solo al pulsar su botón. Al volver, se recuerda si la tarjeta estaba cerrada, minimizada, flotante o maximizada.

La barra superior permite **minimizar**, **maximizar/restaurar** o **cerrar**. El modo maximizado ocupa la ventana del navegador y reordena la biblioteca bajo el reproductor cuando el ancho es reducido. El modo minimizado conserva el nombre, los controles básicos, repetición y una lista propia de álbumes y canciones. El botón de la barra superior lo devuelve al tamaño flotante. Cerrar pausa el audio.

## Ejecutar

```bash
pnpm install
pnpm dev
```

Abre la dirección local que muestra Vite, normalmente `http://localhost:5173`. Para verificar la versión de producción: `pnpm build`.

## Fuentes de audio

- **Álbumes:** crea un álbum con **＋** y añade allí tus canciones. Puedes cambiar de álbum con el selector, renombrarlo o eliminarlo con el botón de edición.
- **Enlace de YouTube:** pulsa **Añadir música** y pega un enlace de video. El iframe conserva un área de 256 × 200 píxeles para la API, pero el video se oculta con `scale(0)`. El navegador y YouTube eligen la calidad de transmisión; la API de inserción no permite forzar la resolución más baja. Algunos videos pueden prohibir la reproducción integrada.
- **Enlace de Spotify:** pega un enlace `open.spotify.com/track/...` o `open.spotify.com/episode/...`. Se abre el reproductor oficial de Spotify. La disponibilidad completa depende de Spotify, el inicio de sesión y el navegador; puede reproducirse solo una vista previa. El volumen de Spotify se ajusta en su reproductor o en el dispositivo.
- **Audio directo:** también puedes pegar la URL de un archivo MP3, WAV u OGG.
- **Archivo local:** pulsa **Subir archivos** o arrastra archivos de audio a la página. Al soltarlos se añaden y se reproduce el primero. Se guardan en el navegador y reaparecen al volver.
- **Arrastrar enlaces:** también puedes soltar un enlace de YouTube o de audio directo. Se añade y comienza a reproducirse. Si aún no existe un álbum, el primer arrastre crea **Mi música** automáticamente.
- **Editar:** haz clic derecho sobre una canción y elige **Editar canción**. Un clic normal reproduce esa pista. En la edición puedes modificar su nombre, URL y álbumes.
- **Ordenar:** arrastra una canción desde el icono de seis puntos. Su número y el orden de reproducción se actualizan y se guardan. Con el asa enfocada, también puedes usar `Alt` + flechas arriba/abajo.
- **Repetir:** pulsa el icono de repetición para activar el bucle. Con clic derecho sobre él puedes marcar inicio, fin o quitar ambas marcas. Las marcas se arrastran por la barra (o se ajustan con las flechas) y quedan guardadas por canción. Con solo inicio se repite desde ese punto hasta el final; con solo fin se repite desde el principio hasta ese punto. Mientras Repetir esté activo, tiene prioridad sobre el punto de pasar a la siguiente canción: al llegar a ese punto vuelve al inicio marcado o al comienzo de la pista.
- **Inicio y término de reproducción:** haz clic derecho en Play/Pausa para marcar dónde empezar y dónde pausar. Son marcas independientes de la repetición; también se pueden arrastrar o ajustar con las flechas. Se guardan en SQLite junto con la canción. Si el bot está transmitiendo, el punto principal muestra enseguida el destino del salto y una marca secundaria indica la posición anterior que aún sale por Discord. Tras la confirmación de la fuente y el búfer, ambas posiciones se reúnen.
- **Pestaña compartida:** pulsa **Compartir pestaña**, elige una pestaña y activa **Compartir audio de la pestaña**. Requiere `localhost` o HTTPS y un navegador que permita silenciar la reproducción local de la pestaña capturada. Si no lo permite, la captura se cancela para evitar que suene dos veces.

La barra de progreso lee la posición real del elemento de audio para archivos y enlaces directos, y las API de YouTube y Spotify para sus reproductores. Puedes moverla para saltar a otra parte cuando la fuente informa una duración. Las transmisiones en vivo muestran **EN VIVO** porque no tienen una línea de tiempo fiable.

**Teclado:** con el foco en el reproductor, `←` y `→` retroceden o avanzan un segundo; `Mayús` añade saltos de diez segundos. Con la barra enfocada también sirven `↑`, `↓`, `Re Pág`, `Av Pág`, `Inicio` y `Fin`. Dentro de la lista de canciones, `↑` y `↓` mueven el foco y `Enter` reproduce la seleccionada. En la búsqueda, escribe normalmente, usa `↑`/`↓` para destacar un resultado y `Enter` para reproducirlo. El selector de álbumes también admite flechas. Estos atajos solo actúan cuando su zona tiene el foco.

La captura de pestaña es una transmisión en vivo: primero debes iniciar el video en la pestaña original. `getDisplayMedia` solo entrega el audio, sin posición ni duración. La extensión Bardo puede conectar la pestaña original para sincronizar Play/Pausa, anterior/siguiente, repetición y la barra cuando el reproductor de esa pestaña expone esos controles. Sin la extensión, la captura no ofrece una línea de tiempo fiable. La captura no se conserva al cerrar la página.

## Persistencia

SQLite en el ordenador anfitrión guarda la biblioteca compartida. `localStorage` conserva una copia para mostrarla de inmediato y recuerda la pista, el volumen, la repetición, la posición y el estado de la ventana; las escrituras locales se agrupan durante 250 ms para evitar trabajo en cada movimiento. `IndexedDB` conserva archivos pendientes de subir. La reproducción no se inicia automáticamente al volver. YouTube, Spotify, el formulario de edición y el panel completo de biblioteca se descargan cuando se necesitan. Vite genera CSS y JS con nombres versionados; Nginx los comprime con gzip y los sirve con caché `immutable`, mientras el HTML se revalida.

## Bot de Discord

El bot es una opción secundaria dentro de la biblioteca del reproductor. El panel **Bot de Discord** permite activar el modo Discord después de ejecutar `/conectar` en un canal de voz y vincular el código de esa sesión. El audio capturado se transmite al bot a través de `/api/bot`; el token de Discord permanece en el backend. Vite usa un proxy para desarrollo y Nginx enruta la misma API en Docker. Consulta [el README del bot](../bot/README.md) para sus comandos y configuración.
