import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import { VoiceBridge } from '../src/voice.js';

test('un flujo WebM llega al reproductor como paquetes Opus tras el búfer inicial', async () => {
  const generated = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
    '-c:a', 'libopus', '-b:a', '96k', '-f', 'webm', 'pipe:1',
  ], { maxBuffer: 1024 * 1024 });
  assert.equal(generated.status, 0, generated.stderr.toString());
  assert.ok(generated.stdout.length > 0);

  let resolvePlayback;
  const playback = new Promise((resolve) => { resolvePlayback = resolve; });
  const player = {
    state: { status: AudioPlayerStatus.Idle },
    play(resource) {
      this.state = { status: AudioPlayerStatus.Playing, resource };
      resolvePlayback(resource);
    },
    stop() { this.state = { status: AudioPlayerStatus.Idle }; },
  };
  const bridge = new VoiceBridge();
  bridge.session = {
    connection: { state: { status: VoiceConnectionStatus.Ready } },
    player,
    code: 'ABCDEF123456',
    codeExpires: Date.now() + 30_000,
    channelName: 'Prueba',
    socket: null,
    transcoder: null,
    bufferMs: 1200,
  };
  const socket = { close() {} };
  let timeoutId;

  try {
    assert.equal(bridge.acceptCode('ABCDEF123456', socket), true);
    for (let offset = 0; offset < generated.stdout.length; offset += 4096) {
      assert.equal(bridge.writeAudio(socket, generated.stdout.subarray(offset, offset + 4096)), true);
    }
    const timeout = new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('No llegó audio Opus al reproductor')), 5000); });
    const resource = await Promise.race([playback, timeout]);
    const [packet] = await Promise.race([once(resource.playStream, 'data'), timeout]);
    assert.ok(packet.length > 0);
    assert.equal(bridge.status.bufferMs, 1200);
    assert.ok(bridge.status.audioChunks > 0);
  } finally {
    clearTimeout(timeoutId);
    bridge.stopStream();
  }
});
