# Bardo Politanense JR

Servicio local de Discord para Sonora. El token se lee **solo** en Node desde un archivo local indicado por `DISCORD_TOKEN_FILE`; React consulta únicamente el estado a través del proxy de Vite.

## Preparar Discord

1. La aplicación **Bardo Politanense JR** ya está creada en [Discord Developer Portal](https://discord.com/developers/applications). Revisa que su usuario bot exista en la sección **Bot**.
2. En **Bot**, genera el token y guárdalo en el archivo indicado por `DISCORD_TOKEN_FILE` en `.env`. En WSL, la ruta `/home/<usuario>/.config/sonora/bot-token` queda fuera de este proyecto; usa permisos `600`. No pongas el valor en React, `vite.config.js`, un chat ni un repositorio.
3. Si deseas comprobar un servidor concreto, pon su ID numérico en `GUILD_ID`. Este valor es opcional. Invita el bot desde **Installation** del portal con los permisos mínimos que necesites.

El archivo `.env` guarda solo la ruta del token y está ignorado por Git. También puedes usar `DISCORD_TOKEN` como variable de entorno en un despliegue. **Restablecer token** invalida el anterior.

## Ejecutar

En WSL, desde `sonora-bot`:

```bash
pnpm install
pnpm start
```

En otra terminal, desde `sonora`:

```bash
pnpm dev
```

Vite envía `/api/bot/status` al servicio local en `127.0.0.1:3001`. Puedes comprobarlo con `http://127.0.0.1:5173/api/bot/status`. El proxy de Vite solo funciona en desarrollo; al publicar la aplicación configura el servidor web para enviar `/api/bot` al backend y protege cualquier futura ruta que ejecute acciones. El servicio actual solo expone el estado de conexión.
