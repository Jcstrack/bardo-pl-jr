import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { WebSocketServer } from "ws";
import { VoiceBridge } from "./voice.js";

const host = process.env.BOT_HOST || "127.0.0.1";
const port = Number(process.env.BOT_PORT || 3001);
function readBotToken() {
  if (!process.env.DISCORD_TOKEN_FILE)
    return process.env.DISCORD_TOKEN?.trim() || "";
  try {
    return readFileSync(process.env.DISCORD_TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

const token = readBotToken();
const guildId = process.env.GUILD_ID?.trim();
const hasToken =
  /^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}$/.test(
    token || "",
  );
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const voice = new VoiceBridge();
let connectionState = hasToken ? "connecting" : "needs-token";

const commands = [
  new SlashCommandBuilder()
    .setName("conectar")
    .setDescription(
      "Unir a Bardo a tu canal de voz y crear un código para Bardo Politanense",
    ),
  new SlashCommandBuilder()
    .setName("salir")
    .setDescription("Sacar a Bardo del canal sin perder la vinculación con el reproductor"),
  new SlashCommandBuilder()
    .setName("desconectar")
    .setDescription("Cerrar la vinculación con el reproductor y salir del canal"),
  new SlashCommandBuilder()
    .setName("estado")
    .setDescription("Ver el estado de Bardo"),
].map((command) => command.toJSON());

async function registerCommands(guild) {
  if (guildId && guild.id !== guildId) return;
  try {
    const current = await guild.commands.fetch();
    for (const command of commands) {
      const existing = current.find((item) => item.name === command.name);
      if (existing) await existing.edit(command);
      else await guild.commands.create(command);
    }
    console.log(
      `Comandos disponibles en ${guild.name}: /conectar, /salir, /desconectar, /estado.`,
    );
  } catch (error) {
    console.error(
      `No se pudieron registrar comandos en ${guild.name}: ${error.message}`,
    );
  }
}

client.on(Events.ClientReady, async () => {
  connectionState = "online";
  console.log(`Bot conectado como ${client.user.username}.`);
  for (const guild of client.guilds.cache.values())
    await registerCommands(guild);
});
client.on(Events.GuildCreate, registerCommands);
client.on(Events.ShardReconnecting, () => {
  connectionState = "connecting";
});
client.on(Events.ShardDisconnect, () => {
  connectionState = "disconnected";
});
client.on(Events.Error, () => {
  connectionState = "error";
});
client.on(Events.VoiceStateUpdate, (previous, next) => {
  if (next.id !== client.user?.id) return;
  const currentChannelId = voice.session?.connection?.joinConfig.channelId;
  if (currentChannelId && previous.channelId === currentChannelId && next.channelId !== currentChannelId) {
    console.log(`Bardo salió del canal ${voice.session.channelName}; la vinculación sigue activa.`);
    voice.leaveVoice();
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;
  if (guildId && interaction.guildId !== guildId) return;
  try {
    if (interaction.commandName === "estado") {
      const status = voice.status;
      await interaction.reply({
        content: status.voiceConnected
          ? `Estoy en **${status.channelName}**${status.streaming ? " y transmitiendo audio desde Bardo Politanense." : ", esperando audio de Bardo Politanense."}`
          : status.paired
            ? "Estoy fuera del canal, pero sigo vinculado al reproductor. Volveré al reproducir música. Usa /desconectar para terminar la vinculación."
            : "Estoy en línea. Entra a un canal de voz y usa /conectar.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const channel = member.voice.channel;
    if (interaction.commandName === "conectar") {
      console.log(`Comando /conectar recibido en ${interaction.guild.name}.`);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        await interaction.reply({
          content: "Primero entra a un canal de voz del servidor.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await voice.join(channel, interaction.user.id);
      console.log(`Bardo entró al canal ${channel.name}.`);
      const code = voice.issueCode();
      await interaction.editReply(
        `Ya estoy en **${channel.name}**. Activa **Modo Discord** en Bardo Politanense y escribe este código temporal: **${code}**. Caduca en 5 minutos.`,
      );
      return;
    }
    if (interaction.commandName === "salir") {
      console.log(`Comando /salir recibido en ${interaction.guild.name}.`);
      if (!voice.session || voice.session.guildId !== interaction.guildId) {
        await interaction.reply({ content: "No estoy vinculado a este servidor.", flags: MessageFlags.Ephemeral });
        return;
      }
      const currentVoiceChannelId = voice.session.connection?.joinConfig.channelId;
      if (interaction.user.id !== voice.session.ownerUserId && (!currentVoiceChannelId || channel?.id !== currentVoiceChannelId)) {
        await interaction.reply({
          content: "Entra al canal donde estoy o pide a quien me conectó que use /salir.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      voice.leaveVoice();
      await interaction.reply({
        content: "Salí del canal, pero el reproductor sigue vinculado. Volveré cuando reproduzcas música.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (interaction.commandName === "desconectar") {
      if (!voice.session || voice.session.guildId !== interaction.guildId) {
        await interaction.reply({ content: "No hay una vinculación activa en este servidor.", flags: MessageFlags.Ephemeral });
        return;
      }
      const currentVoiceChannelId = voice.session.connection?.joinConfig.channelId;
      if (interaction.user.id !== voice.session.ownerUserId && (!currentVoiceChannelId || channel?.id !== currentVoiceChannelId)) {
        await interaction.reply({ content: "Solo quien me conectó o alguien en mi canal puede cerrar esta vinculación.", flags: MessageFlags.Ephemeral });
        return;
      }
      voice.leave();
      await interaction.reply({ content: "Desconecté el reproductor y salí del canal. Usa /conectar para iniciar otra sesión.", flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error("Falló un comando del bot:", error.message);
    const content =
      "No pude completar esa acción. Comprueba mis permisos de voz e inténtalo otra vez.";
    if (interaction.deferred || interaction.replied)
      await interaction.editReply(content);
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
});

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method !== "GET" || request.url !== "/api/bot/status") {
    sendJson(response, 404, { error: "Ruta no encontrada" });
    return;
  }
  sendJson(response, 200, {
    state: connectionState,
    connected: client.isReady(),
    botName: client.isReady() ? client.user.username : null,
    guildCount: client.isReady() ? client.guilds.cache.size : 0,
    ...voice.status,
    guildConnected:
      client.isReady() && /^\d{17,20}$/.test(guildId || "")
        ? client.guilds.cache.has(guildId)
        : null,
  });
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  const hostName = request.headers.host?.split(":")[0];
  let validOrigin = false;
  try {
    validOrigin = new URL(origin).hostname === hostName;
  } catch {
    /* Falta Origin. */
  }
  if (request.url !== "/api/bot/stream" || !validOrigin) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => {
    let authenticated = false;
    const timeout = setTimeout(
      () => ws.close(1008, "Autenticación caducada"),
      10_000,
    );
    ws.on("message", (message, isBinary) => {
      if (!authenticated) {
        if (isBinary) return ws.close(1008, "Código requerido");
        let code;
        try {
          code = JSON.parse(message.toString()).code;
        } catch {
          /* Mensaje inválido. */
        }
        if (!voice.acceptCode(code, ws))
          return ws.close(1008, "Código inválido o caducado");
        authenticated = true;
        clearTimeout(timeout);
        ws.send(JSON.stringify({ type: "ready" }));
        return;
      }
      if (isBinary) {
        voice.writeAudio(ws, message);
        return;
      }
      let control;
      try {
        control = JSON.parse(message.toString());
      } catch {
        return;
      }
      if (control.type === "activity" && typeof control.active === "boolean") {
        voice.setActivity(ws, control.active).catch((error) => console.error('No se pudo actualizar el audio:', error.message));
      } else if (control.type === "resume") {
        voice.resume(ws, control.active === true).catch((error) => console.error('No se pudo volver al canal:', error.message));
      } else if (control.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });
    ws.on("close", () => {
      clearTimeout(timeout);
      voice.removeSocket(ws);
    });
  });
});

server.listen(port, host, () => {
  console.log(`API local del bot en http://${host}:${port}`);
  if (!hasToken) {
    console.log(
      "Falta un token válido del bot. La API seguirá disponible para mostrar el estado.",
    );
    return;
  }
  client.login(token).catch(() => {
    connectionState = "error";
    console.error(
      "No se pudo iniciar sesión en Discord. Revisa el archivo local del token.",
    );
  });
});

function shutdown() {
  voice.leave();
  sockets.close();
  client.destroy();
  server.close();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
