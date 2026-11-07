import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyboardSeekTarget, seekTarget } from './playerMath.js';

test('las flechas avanzan o retroceden y respetan los extremos', () => {
  assert.equal(keyboardSeekTarget('ArrowRight', 12, 90), 13);
  assert.equal(keyboardSeekTarget('ArrowLeft', 12, 90, true), 2);
  assert.equal(keyboardSeekTarget('ArrowLeft', 0, 90), 0);
  assert.equal(keyboardSeekTarget('ArrowRight', 90, 90), 90);
  assert.equal(keyboardSeekTarget('Home', 45, 90), 0);
  assert.equal(keyboardSeekTarget('End', 45, 90), 90);
  assert.equal(keyboardSeekTarget('Home', 45, 90, false, 25), 25);
  assert.equal(keyboardSeekTarget('ArrowLeft', 26, 90, true, 25), 25);
  assert.equal(keyboardSeekTarget('ArrowRight', 25, 90, false, 25), 26);
});

test('solo las teclas de búsqueda admitidas mueven la reproducción', () => {
  assert.equal(keyboardSeekTarget('PageUp', 20, 90), 30);
  assert.equal(keyboardSeekTarget('PageDown', 20, 90), 10);
  assert.equal(keyboardSeekTarget('Enter', 20, 90), null);
});

test('mover el inicio permite saltar a una marca anterior, pero la barra no cruza la marca guardada', () => {
  assert.equal(seekTarget(30, 180, 80), 80);
  assert.equal(seekTarget(30, 180, 80, true), 30);
  assert.equal(seekTarget(200, 180, 80, true), 180);
});
