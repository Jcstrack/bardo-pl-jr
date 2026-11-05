import { albumIdsOf } from './trackAlbums.js'

const EDITOR_KEY = 'bardo-library-editor-v1'
const SYNCED_KEY = 'bardo-library-imported-v1'
const OFFLINE_KEY = 'bardo-library-offline-changes-v1'
const trackFields = ['id', 'albumId', 'albumIds', 'title', 'artist', 'src', 'kind', 'videoId', 'tone', 'fallbackTitle', 'loopStart', 'loopEnd', 'playStart', 'playEnd', 'playNext', 'serverSrc', 'stored']

export function editorKeyFromBrowser() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const invited = hash.get('invite')
  if (invited && /^[a-f0-9]{64}$/i.test(invited)) {
    localStorage.setItem(EDITOR_KEY, invited)
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return invited
  }
  return localStorage.getItem(EDITOR_KEY) || ''
}

export function acceptInvite(value) {
  let key = value.trim()
  if (key.includes('#')) key = new URLSearchParams(key.split('#')[1]).get('invite') || ''
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('La invitación no es válida.')
  localStorage.setItem(EDITOR_KEY, key)
  return key
}

export async function localOwnerKey() {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return ''
  try {
    const response = await fetch(`http://${window.location.hostname}:3003/api/owner`, { cache: 'no-store' })
    if (!response.ok) return ''
    const { key } = await response.json()
    return /^[a-f0-9]{64}$/i.test(key) ? key : ''
  } catch { return '' }
}

export const importedHere = () => localStorage.getItem(SYNCED_KEY) === 'yes'
export const markImported = () => localStorage.setItem(SYNCED_KEY, 'yes')
export const offlineChanges = () => localStorage.getItem(OFFLINE_KEY) === 'yes'
export const markOfflineChanges = () => localStorage.setItem(OFFLINE_KEY, 'yes')
export const clearOfflineChanges = () => localStorage.removeItem(OFFLINE_KEY)

export function sharedSnapshot(albums, tracks) {
  const valid = new Set(albums.map((album) => album.id))
  return {
    albums: albums.map(({ id, name }) => ({ id, name })),
    tracks: tracks
      .filter((track) => track.kind !== 'capture' && albumIdsOf(track).some((id) => valid.has(id)) && (track.kind !== 'file' || Boolean(track.serverSrc)))
      .map((track) => {
        const item = Object.fromEntries(trackFields.filter((key) => track[key] !== undefined).map((key) => [key, track[key]]))
        item.albumIds = albumIdsOf(track).filter((id) => valid.has(id))
        item.albumId = item.albumIds.includes(item.albumId) ? item.albumId : item.albumIds[0]
        if (track.kind === 'file') {
          item.src = track.serverSrc
          item.stored = true
        }
        return item
      }),
  }
}

export function libraryChanges(before, after) {
  const diff = (oldItems, newItems) => {
    const old = new Map(oldItems.map((item) => [item.id, item]))
    const current = new Map(newItems.map((item) => [item.id, item]))
    return {
      upsert: newItems.filter((item) => JSON.stringify(old.get(item.id)) !== JSON.stringify(item)),
      remove: oldItems.filter((item) => !current.has(item.id)).map((item) => item.id),
    }
  }
  const albumsDiff = diff(before.albums, after.albums)
  const tracksDiff = diff(before.tracks, after.tracks)
  const reordered = before.tracks.map((item) => item.id).join('|') !== after.tracks.map((item) => item.id).join('|')
  if (!albumsDiff.upsert.length && !albumsDiff.remove.length && !tracksDiff.upsert.length && !tracksDiff.remove.length && !reordered) return null
  return { albums: albumsDiff, tracks: tracksDiff, ...(reordered ? { order: after.tracks.map((item) => item.id) } : {}) }
}

async function checked(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error || `La biblioteca respondió ${response.status}.`)
    error.status = response.status
    throw error
  }
  return body
}

export async function establishLibrarySession(key) {
  return checked(await fetch('/api/library/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    credentials: 'same-origin',
  }))
}

export async function fetchSharedLibrary(key = '') {
  let response = await fetch('/api/library', { cache: 'no-store', credentials: 'same-origin' })
  if (response.status === 401 && key) {
    await establishLibrarySession(key)
    response = await fetch('/api/library', { cache: 'no-store', credentials: 'same-origin' })
  }
  return checked(response)
}

export async function createFriendInvite(key) {
  return checked(await fetch('/api/library/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    credentials: 'same-origin',
  }))
}

export async function sendLibraryChanges(key, changes) {
  return checked(await fetch('/api/library/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    credentials: 'same-origin',
    body: JSON.stringify({ changes }),
  }))
}

export async function uploadSharedFile(key, id, file) {
  return checked(await fetch(`/api/library/files/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    credentials: 'same-origin',
    body: file,
  }))
}
