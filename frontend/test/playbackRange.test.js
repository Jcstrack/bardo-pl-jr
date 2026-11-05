import test from 'node:test';
import assert from 'node:assert/strict';
import { repeatStart, repeatEnd } from '../src/lib/playbackRange.js';

test('repetir usa el tramo de repetición antes que la marca de siguiente', () => {
  assert.equal(repeatEnd(45, 30, null, 120), 45);
  assert.equal(repeatStart(12, 5), 12);
});

test('sin fin de repetición, la marca de siguiente o pausa cierra el ciclo', () => {
  assert.equal(repeatEnd(null, 30, 40, 120), 30);
  assert.equal(repeatEnd(null, null, 40, 120), 40);
  assert.equal(repeatEnd(null, null, null, 120), 120);
  assert.equal(repeatStart(null, 5), 5);
  assert.equal(repeatStart(null, null), 0);
  assert.equal(repeatEnd(null, 5, null, 120, 12), 120);
});
