const STORAGE_KEY = 'sonora-library-v1';
const DB_NAME = 'sonora-audio-v1';
const STORE_NAME = 'files';
import { albumIdsOf } from './trackAlbums.js';

export function readLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.albums) || !Array.isArray(saved.tracks)) return null;
    return {
      ...saved,
      tracks: saved.tracks.map((track) => ({ ...track, albumIds: albumIdsOf(track) })),
    };
  } catch {
    return null;
  }
}

export function writeLibrary(state) {
  const albumIds = new Set(state.albums.map((album) => album.id));
  const tracks = state.tracks
    .filter((track) => track.kind !== 'capture' && albumIdsOf(track).some((id) => albumIds.has(id)))
    .map((track) => {
      const validIds = albumIdsOf(track).filter((id) => albumIds.has(id));
      const copy = {
        ...track,
        albumId: validIds.includes(track.albumId) ? track.albumId : validIds[0],
        albumIds: validIds,
      };
      return track.kind === 'file' ? { ...copy, src: track.serverSrc || null } : copy;
    });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, tracks }));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStore(mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const saveAudioFile = (id, file) => runStore('readwrite', (store) => store.put(file, id));
export const loadAudioFile = (id) => runStore('readonly', (store) => store.get(id));
export const deleteAudioFile = (id) => runStore('readwrite', (store) => store.delete(id));
