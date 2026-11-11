import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { ChannelType } from 'discord.js';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const INITIAL_BUFFER_MS = 1200;

export class VoiceBridge {
  session = null;

  constructor({ joinChannel = joinVoiceChannel, waitUntilReady = entersState } = {}) {
    this.joinChannel = joinChannel;
    this.waitUntilReady = waitUntilReady;
  }

  get status() {
    const session = this.session;
    const voiceConnected = session?.connection?.state.status === VoiceConnectionStatus.Ready;
    return {
      voiceConnected,
      channelName: voiceConnected ? session.channelName : null,
      lastChannelName: session?.channelName ?? null,
      paired: Boolean(session?.socket),
      streaming: Boolean(voiceConnected && session?.activity && session.audioChunks > 0 && session.player.state.status === AudioPlayerStatus.Playing),
      transportConnected: Boolean(session?.socket),
      audioChunks: session?.audioChunks ?? 0,
      audioBytes: session?.audioBytes ?? 0,
      playerState: session?.player.state.status ?? null,
      maxChunkGapMs: session?.maxChunkGapMs ?? 0,
      lastChunkGapMs: session?.lastChunkGapMs ?? 0,
      bufferMs: session?.bufferMs ?? 0,
      missedFrames: session?.player.state.status === AudioPlayerStatus.Playing ? session.player.state.missedFrames : 0,
      bufferedAudioBytes: session?.audioBuffer?.readableLength ?? 0,
    };
  }

  notify(session, value) {
    if (session.socket?.readyState === 1) session.socket.send(JSON.stringify(value));
  }

  async connectVoice(session) {
    if (session.connection?.state.status === VoiceConnectionStatus.Ready) return;
    if (session.rejoinPromise) return session.rejoinPromise;
    session.rejoinPromise = (async () => {
      const channel = await session.channel.guild.channels.fetch(session.channel.id);
      if (channel?.type !== ChannelType.GuildVoice) throw new Error('El canal de voz ya no está disponible.');
      if (this.session !== session) return;
      if (session.connection) {
        const old = session.connection;
        session.connection = null;
        old.destroy();
      }
      const connection = this.joinChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      session.connection = connection;
      connection.on(VoiceConnectionStatus.Destroyed, () => {
        if (this.session === session && session.connection === connection) this.leaveVoice();
      });
      try {
        await this.waitUntilReady(connection, VoiceConnectionStatus.Ready, 30_000);
      } catch (error) {
        if (session.connection === connection) session.connection = null;
        connection.destroy();
        throw error;
      }
      if (this.session !== session || session.connection !== connection) {
        connection.destroy();
        return;
      }
      session.channel = channel;
      session.channelName = channel.name;
      connection.subscribe(session.player);
      console.log(`Bardo entró al canal ${channel.name}.`);
    })();
    try {
      await session.rejoinPromise;
    } finally {
      session.rejoinPromise = null;
    }
  }

  async join(channel, ownerUserId) {
    this.leave();
    // MediaRecorder entrega paquetes en tandas; un flujo en vivo no debe terminar
    // por los cinco ciclos sin datos que usa por defecto @discordjs/voice.
    const player = createAudioPlayer({ behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
      maxMissedFrames: Number.POSITIVE_INFINITY,
    } });
    const session = {
      channel,
      channelName: channel.name,
      guildId: channel.guild.id,
      ownerUserId,
      connection: null,
      rejoinPromise: null,
      player,
      code: null,
      codeExpires: 0,
      resumeToken: null,
      socket: null,
      activity: false,
      transcoder: null,
      audioBuffer: null,
      audioChunks: 0,
      audioBytes: 0,
      bufferTimer: null,
      bufferMs: INITIAL_BUFFER_MS,
      playbackStarted: false,
      lastChunkAt: 0,
      maxChunkGapMs: 0,
      lastChunkGapMs: 0,
    };
    this.session = session;
    player.on(AudioPlayerStatus.Playing, () => console.log(`Decodificador de Discord reproduciendo en ${session.channelName}.`));
    player.on(AudioPlayerStatus.AutoPaused, () => console.warn(`Reproductor de Discord en pausa automática en ${session.channelName}.`));
    player.on('error', (error) => {
      console.error('Falló la transmisión de audio a Discord:', error.message);
      this.stopAudio(session);
    });
    try {
      await this.connectVoice(session);
    } catch (error) {
      if (this.session === session) this.leave();
      throw error;
    }
    return session;
  }

  issueCode() {
    if (!this.status.voiceConnected) throw new Error('El bot no está en un canal de voz.');
    this.session.code = randomBytes(6).toString('hex').toUpperCase();
    this.session.codeExpires = Date.now() + CODE_LIFETIME_MS;
    return this.session.code;
  }

  acceptCode(code, socket) {
    const session = this.session;
    if (!this.status.voiceConnected || !code || code !== session.code || Date.now() > session.codeExpires) return false;
    session.code = null;
    session.codeExpires = 0;
    session.resumeToken = randomBytes(32).toString('base64url');
    if (session.socket && session.socket !== socket) session.socket.close(1000, 'Nueva conexión');
    this.stopAudio(session);
    session.socket = socket;
    session.activity = false;
    return true;
  }

  acceptResumeToken(token, socket) {
    const session = this.session;
    if (!session?.resumeToken || !token || token !== session.resumeToken) return false;
    if (session.socket && session.socket !== socket) session.socket.close(1000, 'Nueva conexión');
    this.stopAudio(session);
    session.socket = socket;
    session.activity = false;
    return true;
  }

  async resume(socket, active = false) {
    const session = this.session;
    if (!session || session.socket !== socket) return false;
    if (active) session.activity = true;
    try {
      await this.connectVoice(session);
      if (this.session !== session || session.socket !== socket) return false;
      this.notify(session, { type: 'voice-ready' });
      if (session.activity) this.startAudio(session);
      return true;
    } catch (error) {
      console.error('No se pudo volver al canal de voz:', error.message);
      this.notify(session, { type: 'voice-error', message: 'No pude volver al canal. Comprueba mis permisos o usa /conectar.' });
      return false;
    }
  }

  async setActivity(socket, active) {
    const session = this.session;
    if (!session || session.socket !== socket) return;
    session.activity = Boolean(active);
    if (!active) {
      this.stopAudio(session);
      return;
    }
    if (!this.status.voiceConnected) {
      await this.resume(socket, true);
      return;
    }
    this.startAudio(session);
  }

  startAudio(session) {
    if (this.session !== session || !this.status.voiceConnected || !session.activity || session.transcoder) return;
    // Cada arranque de MediaRecorder produce una nueva cabecera WebM; FFmpeg
    // debe comenzar a leer precisamente desde esa cabecera.
    const transcoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'webm', '-probesize', '32768', '-analyzeduration', '0', '-i', 'pipe:0',
      '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '48000',
      '-c:a', 'libopus', '-application', 'audio', '-b:a', '128k', '-frame_duration', '20',
      '-f', 'ogg', '-page_duration', '20000', '-flush_packets', '1', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const audioBuffer = new PassThrough({ highWaterMark: 64 * 1024 });
    transcoder.stdout.pipe(audioBuffer);
    session.transcoder = transcoder;
    session.audioBuffer = audioBuffer;
    session.audioChunks = 0;
    session.audioBytes = 0;
    session.playbackStarted = false;
    session.lastChunkAt = 0;
    session.maxChunkGapMs = 0;
    session.lastChunkGapMs = 0;
    transcoder.stderr.on('data', (chunk) => {
      const detail = chunk.toString().trim();
      if (detail) console.warn(`FFmpeg: ${detail.slice(0, 300)}`);
    });
    transcoder.stdin.on('error', (error) => {
      if (session.transcoder === transcoder) console.error('Falló la entrada de audio a FFmpeg:', error.message);
    });
    transcoder.on('error', (error) => {
      if (session.transcoder !== transcoder) return;
      console.error('No se pudo iniciar FFmpeg:', error.message);
      this.notify(session, { type: 'audio-error', message: 'No se pudo convertir el audio.' });
      this.stopAudio(session);
    });
    transcoder.on('close', (code) => {
      if (session.transcoder !== transcoder) return;
      console.error(`FFmpeg terminó antes que la transmisión (código ${code}).`);
      this.notify(session, { type: 'audio-error', message: 'Terminó el convertidor de audio.' });
      this.stopAudio(session);
    });
    audioBuffer.once('readable', () => {
      if (this.session !== session || session.transcoder !== transcoder) return;
      session.bufferTimer = setTimeout(() => {
        session.bufferTimer = null;
        if (this.session !== session || session.transcoder !== transcoder || !this.status.voiceConnected) return;
        session.playbackStarted = true;
        session.player.play(createAudioResource(audioBuffer, {
          inputType: StreamType.OggOpus,
          silencePaddingFrames: 0,
        }));
      }, INITIAL_BUFFER_MS);
    });
    this.notify(session, { type: 'record' });
    console.log(`Audio WebM Opus preparado para ${session.channelName}.`);
  }

  writeAudio(socket, chunk) {
    const session = this.session;
    if (!session || session.socket !== socket || !session.transcoder?.stdin.writable) return false;
    if (session.transcoder.stdin.writableLength > 4 * 1024 * 1024) {
      this.notify(session, { type: 'audio-error', message: 'El audio se acumuló demasiado.' });
      this.stopAudio(session);
      return false;
    }
    const now = Date.now();
    if (session.lastChunkAt) {
      session.lastChunkGapMs = now - session.lastChunkAt;
      session.maxChunkGapMs = Math.max(session.maxChunkGapMs, session.lastChunkGapMs);
    }
    session.lastChunkAt = now;
    session.transcoder.stdin.write(chunk);
    session.audioChunks += 1;
    session.audioBytes += chunk.length;
    return true;
  }

  stopAudio(session = this.session) {
    if (!session) return;
    clearTimeout(session.bufferTimer);
    session.bufferTimer = null;
    if (session.transcoder) console.log(`Terminó la transmisión de audio a ${session.channelName}: ${session.audioChunks} fragmentos, ${session.audioBytes} bytes.`);
    const transcoder = session.transcoder;
    session.transcoder = null;
    if (session.player.state.status !== AudioPlayerStatus.Idle) session.player.stop(true);
    if (session.connection?.state.status === VoiceConnectionStatus.Ready) session.connection.setSpeaking(false);
    session.audioBuffer?.destroy();
    session.audioBuffer = null;
    transcoder?.stdin.end();
    transcoder?.kill('SIGTERM');
  }

  removeSocket(socket) {
    const session = this.session;
    if (!session || session.socket !== socket) return;
    session.socket = null;
    session.activity = false;
    this.stopAudio(session);
  }

  leaveVoice() {
    const session = this.session;
    if (!session) return;
    session.activity = false;
    this.stopAudio(session);
    const connection = session.connection;
    session.connection = null;
    connection?.destroy();
    this.notify(session, { type: 'voice-lost' });
  }

  leave() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    this.stopAudio(session);
    const connection = session.connection;
    session.connection = null;
    connection?.destroy();
    session.socket?.close(1000, 'Conexión desconectada');
    session.socket = null;
  }
}
