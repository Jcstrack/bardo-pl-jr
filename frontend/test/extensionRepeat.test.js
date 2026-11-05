import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../extension/controller.js', import.meta.url), 'utf8');

function controllerAt(position) {
  const audio = {
    currentTime: position,
    duration: 10,
    paused: false,
    ended: false,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
  };
  let command;
  let tick;
  const document = {
    querySelectorAll: () => [audio],
    addEventListener() {},
  };
  const chrome = {
    runtime: {
      onMessage: { addListener(listener) { command = listener; } },
      sendMessage() { return Promise.resolve(); },
    },
  };
  runInNewContext(source, {
    window: {}, document, chrome,
    location: { href: 'https://example.com/song', hostname: 'example.com' },
    setInterval(callback) { tick = callback; },
  });
  const send = (name, value) => command({ type: 'BARDO_COMMAND', command: name, value }, null, () => {});
  return { audio, send, tick: () => tick() };
}

test('la extensión repite antes del punto que pausaría o cambiaría de pista', () => {
  const { audio, send, tick } = controllerAt(2);
  send('range', { start: 0, end: 3 });
  send('loop', { start: 1, end: 3 });
  send('repeat', true);
  audio.currentTime = 2.8;
  tick();
  assert.equal(audio.currentTime, 1);
  assert.equal(audio.paused, false);
});

test('sin repetir, el punto de término pausa la pestaña', () => {
  const { audio, send, tick } = controllerAt(2);
  send('range', { start: 0, end: 3 });
  audio.currentTime = 3;
  tick();
  assert.equal(audio.paused, true);
});
