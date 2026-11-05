import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyboardSeekTarget } from './playerMath.js';

test('las flechas avanzan o retroceden y respetan los extremos', () => {
  assert.equal(keyboardSeekTarget('ArrowRight', 12, 90), 13);
  assert.equal(keyboardSeekTarget('ArrowLeft', 12, 90, true), 2);
  assert.equal(keyboardSeekTarget('ArrowLeft', 0, 90), 0);
  assert.equal(keyboardSeekTarget('ArrowRight', 90, 90), 90);
  assert.equal(keyboardSeekTarget('Home', 45, 90), 0);
  assert.equal(keyboardSeekTarget('End', 45, 90), 90);
});

test('solo las teclas de búsqueda admitidas mueven la reproducción', () => {
  assert.equal(keyboardSeekTarget('PageUp', 20, 90), 30);
  assert.equal(keyboardSeekTarget('PageDown', 20, 90), 10);
  assert.equal(keyboardSeekTarget('Enter', 20, 90), null);
});
