# Bardo Politanense · Bot de Discord

Servicio local de Discord para Bardo. El token se lee **solo** en Node desde un archivo local indicado por `DISCORD_TOKEN_FILE`; React consulta únicamente el estado a través del proxy Nginx.

## Preparar Discord

1. La aplicación **Bardo Politanense JR** ya está creada en [Discord Developer Portal](https://discord.com/developers/applications). Revisa que su usuario bot exista en la sección **Bot**.
2. En **Bot**, genera el token y guárdalo en el archivo indicado por `DISCORD_TOKEN_FILE` en `.env`. En WSL, una ruta como `/home/<usuario>/.config/bardo-politanense/bot-token` queda fuera de este proyecto; usa permisos `600`. No pongas el valor en React, `vite.config.js`, un chat ni un repositorio.
3. Para instalarlo en otros servidores usa la [invitación de servidor](https://discord.com/oauth2/authorize?client_id=1567243383431237793&scope=bot%20applications.commands&permissions=3146752&integration_type=0). El instalador debe tener permiso para administrar el servidor. Deja `GUILD_ID` sin definir si el bot atenderá varios servidores.

El archivo `.env` guarda solo la ruta del token y está ignorado por Git. También puedes usar `DISCORD_TOKEN` como variable de entorno en un despliegue. **Restablecer token** invalida el anterior.

## Ejecutar

Desde la raíz del proyecto, `docker compose up -d --build` inicia el frontend, la biblioteca y el bot. Abre `http://localhost:8088/`; Nginx dirige `/api/bot` al contenedor del bot. Para comprobar el estado local usa `http://localhost:8088/api/bot/status`.
