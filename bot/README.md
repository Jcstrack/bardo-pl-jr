# Bardo Politanense JR

Servicio local de Discord para Bardo. El token se lee **solo** en Node desde un archivo local indicado por `DISCORD_TOKEN_FILE`; React consulta únicamente el estado a través del proxy Nginx.

## Preparar Discord

1. La aplicación **Bardo Politanense JR** ya está creada en [Discord Developer Portal](https://discord.com/developers/applications). Revisa que su usuario bot exista en la sección **Bot**.
2. En **Bot**, genera el token y guárdalo en el archivo indicado por `DISCORD_TOKEN_FILE` en `.env`. En WSL, la ruta `/home/<usuario>/.config/sonora/bot-token` queda fuera de este proyecto; usa permisos `600`. No pongas el valor en React, `vite.config.js`, un chat ni un repositorio.
3. Si deseas comprobar un servidor concreto, pon su ID numérico en `GUILD_ID`. Este valor es opcional. Invita el bot desde **Installation** del portal con los permisos mínimos que necesites.

El archivo `.env` guarda solo la ruta del token y está ignorado por Git. También puedes usar `DISCORD_TOKEN` como variable de entorno en un despliegue. **Restablecer token** invalida el anterior.

## Ejecutar

Desde la raíz del proyecto, `docker compose up -d --build` inicia el frontend, la biblioteca y el bot. Abre `http://localhost:8088/`; Nginx dirige `/api/bot` al contenedor del bot. Para comprobar el estado local usa `http://localhost:8088/api/bot/status`.
