import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
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

  get status() {
    return {
      voiceConnected: this.session?.connection.state.status === VoiceConnectionStatus.Ready,
      channelName: this.session?.channelName ?? null,
      streaming: Boolean(this.session?.socket && this.session.audioChunks > 0 && this.session.player.state.status === AudioPlayerStatus.Playing),
      transportConnected: Boolean(this.session?.socket),
      audioChunks: this.session?.audioChunks ?? 0,
      audioBytes: this.session?.audioBytes ?? 0,
      playerState: this.session?.player.state.status ?? null,
      maxChunkGapMs: this.session?.maxChunkGapMs ?? 0,
      lastChunkGapMs: this.session?.lastChunkGapMs ?? 0,
      bufferMs: this.session?.bufferMs ?? 0,
      missedFrames: this.session?.player.state.status === AudioPlayerStatus.Playing ? this.session.player.state.missedFrames : 0,
      bufferedAudioBytes: this.session?.audioBuffer?.readableLength ?? 0,
    };
  }

  async join(channel) {
    this.leave();
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
      connection.destroy();
      throw error;
    }
    // MediaRecorder entrega paquetes en tandas; un flujo en vivo no debe terminar
    // por los cinco ciclos sin datos que usa por defecto @discordjs/voice.
    const player = createAudioPlayer({ behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
      maxMissedFrames: Number.POSITIVE_INFINITY,
    } });
    connection.subscribe(player);
    const session = {
      connection,
      player,
      guildId: channel.guild.id,
      channelName: channel.name,
      code: null,
      codeExpires: 0,
      socket: null,
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
    player.on(AudioPlayerStatus.Playing, () => console.log(`Decodificador de Discord reproduciendo en ${session.channelName}.`));
    player.on(AudioPlayerStatus.AutoPaused, () => console.warn(`Reproductor de Discord en pausa automática en ${session.channelName}.`));
    player.on('error', (error) => {
      console.error('Falló la transmisión de audio a Discord:', error.message);
      this.stopStream(session);
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (this.session === session) this.leave();
    });
    this.session = session;
    return session;
  }

  issueCode() {
    if (!this.session) throw new Error('El bot no está en un canal de voz.');
    this.session.code = randomBytes(6).toString('hex').toUpperCase();
    this.session.codeExpires = Date.now() + CODE_LIFETIME_MS;
    return this.session.code;
  }

  acceptCode(code, socket) {
    const session = this.session;
    if (!session || session.connection.state.status !== VoiceConnectionStatus.Ready || !code || code !== session.code || Date.now() > session.codeExpires) return false;
    session.code = null;
    session.codeExpires = 0;
    this.stopStream(session);
    // Chromium MediaRecorder suele codificar Opus en paquetes de 60 ms. Discord
    // despacha cada paquete a 20 ms, así que el flujo debe recodificarse.
    const transcoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'webm', '-probesize', '32768', '-analyzeduration', '0', '-i', 'pipe:0',
      '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '48000',
      '-c:a', 'libopus', '-application', 'audio', '-b:a', '128k', '-frame_duration', '20',
      '-f', 'ogg', '-page_duration', '20000', '-flush_packets', '1', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    // El pipe estándar retiene muy poco Opus. Este margen absorbe tandas
    // irregulares del navegador sin reducir la espera inicial de 1200 ms.
    const audioBuffer = new PassThrough({ highWaterMark: 64 * 1024 });
    transcoder.stdout.pipe(audioBuffer);
    session.transcoder = transcoder;
    session.audioBuffer = audioBuffer;
    session.socket = socket;
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
      if (session.socket) console.error('Falló la entrada de audio a FFmpeg:', error.message);
    });
    transcoder.on('error', (error) => {
      if (!session.socket) return;
      console.error('No se pudo iniciar FFmpeg:', error.message);
      socket.close(1011, 'No se pudo convertir el audio');
      this.stopStream(session);
    });
    transcoder.on('close', (code) => {
      if (!session.socket) return;
      console.error(`FFmpeg terminó antes que la transmisión (código ${code}).`);
      socket.close(1011, 'Terminó el convertidor de audio');
      this.stopStream(session);
    });
    audioBuffer.once('readable', () => {
      if (this.session !== session || session.socket !== socket) return;
      session.bufferTimer = setTimeout(() => {
        session.bufferTimer = null;
        if (this.session !== session || session.socket !== socket || session.transcoder !== transcoder) return;
        session.playbackStarted = true;
        session.player.play(createAudioResource(audioBuffer, {
          inputType: StreamType.OggOpus,
          silencePaddingFrames: 0,
        }));
      }, INITIAL_BUFFER_MS);
    });
    console.log(`Audio WebM Opus recibido para ${session.channelName}.`);
    return true;
  }

  writeAudio(socket, chunk) {
    const session = this.session;
    if (!session || session.socket !== socket || !session.transcoder?.stdin.writable) return false;
    if (session.transcoder.stdin.writableLength > 4 * 1024 * 1024) {
      socket.close(1013, 'Audio demasiado lento');
      this.stopStream(session);
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

  stopStream(session = this.session) {
    if (!session) return;
    clearTimeout(session.bufferTimer);
    session.bufferTimer = null;
    if (session.socket) console.log(`Terminó la transmisión de audio a ${session.channelName}: ${session.audioChunks} fragmentos, ${session.audioBytes} bytes.`);
    session.socket?.close();
    session.socket = null;
    if (session.player.state.status !== AudioPlayerStatus.Idle) session.player.stop(true);
    session.audioBuffer?.destroy();
    session.audioBuffer = null;
    session.transcoder?.stdin.end();
    session.transcoder?.kill('SIGTERM');
    session.transcoder = null;
  }

  leave() {
    const session = this.session;
    if (!session) return;
    this.session = null;
    this.stopStream(session);
    session.connection.destroy();
  }
}
