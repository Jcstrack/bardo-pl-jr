import test from 'node:test';
import assert from 'node:assert/strict';
import { searchTracks } from '../src/lib/searchTracks.js';

const songs = [
  { id: 'one', title: 'Canción épica', artist: 'Bardo' },
  { id: 'two', title: 'Bleach Scar', artist: 'Banda' },
  { id: 'three', title: 'Scarlet Dawn', artist: 'Otra banda' },
];

test('busca por título o artista, tolera acentos y errores cercanos', () => {
  assert.equal(searchTracks(songs, 'cancion epica')[0].track.id, 'one');
  assert.equal(searchTracks(songs, 'blech scar')[0].track.id, 'two');
  assert.equal(searchTracks(songs, 'bardo')[0].track.id, 'one');
  assert.equal(searchTracks(songs, 'sin coincidencias').length, 0);
});

test('conserva el número original de la canción', () => {
  assert.equal(searchTracks(songs, 'bleach scar')[0].index, 1);
});
