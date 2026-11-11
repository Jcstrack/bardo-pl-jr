import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlayerStatus, VoiceConnectionStatus } from '@discordjs/voice';
import { ChannelType } from 'discord.js';
import { VoiceBridge } from '../src/voice.js';

test('/salir conserva la vinculación y detiene el indicador de voz', () => {
  const messages = [];
  const speaking = [];
  let destroyed = false;
  let playerStopped = false;
  let socketClosed = false;
  const socket = {
    readyState: 1,
    send(value) { messages.push(JSON.parse(value)); },
    close() { socketClosed = true; },
  };
  const connection = {
    state: { status: VoiceConnectionStatus.Ready },
    setSpeaking(value) { speaking.push(value); },
    destroy() { destroyed = true; this.state.status = VoiceConnectionStatus.Destroyed; },
  };
  const player = {
    state: { status: AudioPlayerStatus.Playing },
    stop() { playerStopped = true; this.state.status = AudioPlayerStatus.Idle; },
  };
  const bridge = new VoiceBridge();
  bridge.session = {
    connection,
    player,
    socket,
    activity: true,
    audioChunks: 5,
    channelName: 'Guten-Morgen',
  };

  assert.equal(bridge.status.streaming, true);
  bridge.leaveVoice();
  assert.equal(bridge.status.voiceConnected, false);
  assert.equal(bridge.status.paired, true);
  assert.equal(bridge.status.streaming, false);
  assert.equal(socketClosed, false);
  assert.equal(destroyed, true);
  assert.equal(playerStopped, true);
  assert.deepEqual(speaking, [false]);
  assert.deepEqual(messages, [{ type: 'voice-lost' }]);

  bridge.leave();
  assert.equal(bridge.session, null);
  assert.equal(socketClosed, true);
});

test('al reanudar una canción vuelve al canal sin pedir otro código', async () => {
  const messages = [];
  let joinedChannelId = null;
  let subscribed = false;
  const connection = {
    state: { status: VoiceConnectionStatus.Ready },
    on() {},
    subscribe() { subscribed = true; },
    destroy() {},
  };
  const bridge = new VoiceBridge({
    joinChannel(config) {
      joinedChannelId = config.channelId;
      return connection;
    },
    async waitUntilReady() {},
  });
  const channel = {
    id: '123',
    name: 'Guten-Morgen',
    type: ChannelType.GuildVoice,
    guild: {
      id: '456',
      voiceAdapterCreator: {},
      channels: { async fetch() { return channel; } },
    },
  };
  const socket = {
    readyState: 1,
    send(value) { messages.push(JSON.parse(value)); },
  };
  bridge.session = {
    channel,
    channelName: channel.name,
    connection: null,
    rejoinPromise: null,
    socket,
    activity: false,
    player: { state: { status: AudioPlayerStatus.Idle } },
  };

  assert.equal(await bridge.resume(socket), true);
  assert.equal(joinedChannelId, '123');
  assert.equal(subscribed, true);
  assert.equal(bridge.status.voiceConnected, true);
  assert.deepEqual(messages, [{ type: 'voice-ready' }]);
});

test('el silencio apaga la voz sin cerrar la vinculación', async () => {
  const speaking = [];
  const socket = { readyState: 1 };
  const player = {
    state: { status: AudioPlayerStatus.Playing },
    stop() { this.state.status = AudioPlayerStatus.Idle; },
  };
  const bridge = new VoiceBridge();
  bridge.session = {
    connection: {
      state: { status: VoiceConnectionStatus.Ready },
      setSpeaking(value) { speaking.push(value); },
    },
    player,
    socket,
    activity: true,
    audioChunks: 3,
    channelName: 'Guten-Morgen',
  };

  await bridge.setActivity(socket, false);
  assert.equal(bridge.status.streaming, false);
  assert.equal(bridge.status.voiceConnected, true);
  assert.equal(bridge.status.paired, true);
  assert.equal(player.state.status, AudioPlayerStatus.Idle);
  assert.deepEqual(speaking, [false]);
});
