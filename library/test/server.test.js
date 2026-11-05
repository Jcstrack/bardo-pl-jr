import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import os from 'node:os'
import { openRepository } from '../src/repository.js'

test('biblioteca persistente, dos editores, archivos y permisos', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bardo-library-test-'))
  const keyFile = path.join(directory, 'key')
  const key = 'a'.repeat(64)
  await writeFile(keyFile, key)
  process.env.LIBRARY_DATA_DIR = directory
  process.env.BARDO_PUBLIC_URL = 'https://bardo-example.trycloudflare.com/'
  let server
  try {
    const { startServer } = await import(`../src/server.js?case=${Date.now()}`)
    server = await startServer({ port: 0, editorKeyFile: keyFile })
    const base = `http://127.0.0.1:${server.address().port}`
    const session = await fetch(`${base}/api/library/session`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } })
    assert.equal(session.status, 200)
    assert.equal((await session.json()).role, 'owner')
    const cookie = session.headers.get('set-cookie').split(';')[0]
    const get = () => fetch(`${base}/api/library`, { headers: { Cookie: cookie } }).then((res) => res.json())
    const sync = (changes, auth = key) => fetch(`${base}/api/library/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    })
    assert.equal((await get()).revision, 0)
    assert.equal((await fetch(`${base}/api/library`)).status, 401)
    assert.equal((await sync({ albums: { upsert: [{ id: 'album-one', name: 'Uno' }] } }, 'incorrect')).status, 401)
    assert.equal((await get()).albums.length, 0)

    const audio = Buffer.from('RIFF-example-audio')
    const uploaded = await fetch(`${base}/api/library/files/track-one`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'audio/wav', 'X-File-Name': 'prueba.wav' },
      body: audio,
    })
    assert.equal(uploaded.status, 201)
    const added = await sync({
      albums: { upsert: [{ id: 'album-one', name: 'Uno' }] },
      tracks: { upsert: [{ id: 'track-one', albumId: 'album-one', albumIds: ['album-one'], title: 'Prueba', kind: 'file', artist: 'Local' }] },
    })
    assert.equal(added.status, 200)
    const anotherEditor = await sync({
      albums: { upsert: [{ id: 'album-two', name: 'Dos' }] },
      tracks: { upsert: [{ id: 'track-two', albumId: 'album-two', albumIds: ['album-two'], title: 'Enlace', kind: 'url', src: 'https://example.com/song.mp3', playStart: 12, playEnd: 45 }] },
    })
    assert.equal(anotherEditor.status, 200)
    assert.equal((await get()).tracks.length, 2)
    assert.equal((await get()).tracks.find((track) => track.id === 'track-two').playEnd, 45)
    const partial = await fetch(`${base}/api/library/files/track-one`, { headers: { Range: 'bytes=0-3', Cookie: cookie } })
    assert.equal(partial.status, 206)
    assert.equal(await partial.text(), 'RIFF')
    assert.equal((await fetch(`${base}/api/library/files/track-one`)).status, 401)
    const invitation = await fetch(`${base}/api/library/invite`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } }).then((res) => res.json())
    assert.match(invitation.url, /^https:\/\/bardo-example\.trycloudflare\.com\/#invite=[a-f0-9]{64}$/)
    const friendToken = invitation.url.split('#invite=')[1]
    const friendSession = await fetch(`${base}/api/library/session`, { method: 'POST', headers: { Authorization: `Bearer ${friendToken}` } })
    assert.equal((await friendSession.json()).role, 'friend')
    assert.equal((await sync({ albums: { upsert: [{ id: 'album-three', name: 'Amigo' }] } }, friendToken)).status, 200)
    const sqlite = new DatabaseSync(path.join(directory, 'library.sqlite'))
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM tracks').get().total, 2)
    sqlite.close()

    await new Promise((resolve) => server.close(resolve))
    server = null
    const restarted = await import(`../src/server.js?restart=${Date.now()}`)
    server = await restarted.startServer({ port: 0, editorKeyFile: keyFile })
    const saved = await fetch(`http://127.0.0.1:${server.address().port}/api/library`, { headers: { Authorization: `Bearer ${key}` } }).then((res) => res.json())
    assert.equal(saved.tracks.length, 2)
    assert.equal(saved.tracks.find((track) => track.id === 'track-two').playStart, 12)
    assert.equal(saved.revision, 3)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})

test('importa el respaldo JSON y permite crear, editar y eliminar álbumes y canciones', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bardo-migration-test-'))
  const keyFile = path.join(directory, 'key')
  const key = 'b'.repeat(64)
  await writeFile(keyFile, key)
  const legacy = {
    revision: 8,
    albums: [{ id: 'legacy-album', name: 'Antiguo' }],
    tracks: [{ id: 'legacy-track', albumId: 'legacy-album', albumIds: ['legacy-album'], title: 'Conservada', artist: 'Prueba', kind: 'url', src: 'https://example.com/old.mp3', tone: 'violet' }],
  }
  await writeFile(path.join(directory, 'library.json'), JSON.stringify(legacy))
  process.env.LIBRARY_DATA_DIR = directory
  let server
  try {
    const { startServer } = await import(`../src/server.js?crud=${Date.now()}`)
    server = await startServer({ port: 0, editorKeyFile: keyFile })
    const base = `http://127.0.0.1:${server.address().port}`
    const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    const request = async (method, route, data) => fetch(`${base}/api/library${route}`, {
      method,
      headers: auth,
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
    assert.equal((await request('GET', '') .then((response) => response.json())).tracks[0].title, 'Conservada')
    const albumResponse = await request('POST', '/albums', { name: 'Nuevo' })
    assert.equal(albumResponse.status, 201)
    const album = (await albumResponse.json()).album
    const trackResponse = await request('POST', '/tracks', { albumId: album.id, title: 'Tema', kind: 'url', src: 'https://example.com/new.mp3' })
    assert.equal(trackResponse.status, 201)
    const track = (await trackResponse.json()).track
    const changedAlbum = await request('PATCH', `/albums/${album.id}`, { name: 'Renombrado' }).then((response) => response.json())
    assert.equal(changedAlbum.album.name, 'Renombrado')
    const changedTrack = await request('PATCH', `/tracks/${track.id}`, { title: 'Tema editado' }).then((response) => response.json())
    assert.equal(changedTrack.track.title, 'Tema editado')
    assert.equal((await request('GET', `/tracks?albumId=${album.id}`).then((response) => response.json())).tracks.length, 1)
    assert.equal((await request('DELETE', `/tracks/${track.id}`)).status, 200)
    assert.equal((await request('DELETE', `/albums/${album.id}`)).status, 200)
    const current = await request('GET', '').then((response) => response.json())
    assert.deepEqual(current.tracks.map((item) => item.id), ['legacy-track'])
    assert.deepEqual(current.albums.map((item) => item.id), ['legacy-album'])
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'library.json'), 'utf8')), legacy)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})

test('recupera los ID de YouTube perdidos en SQLite y los guarda en canciones nuevas', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bardo-youtube-test-'))
  const keyFile = path.join(directory, 'key')
  const key = 'c'.repeat(64)
  await writeFile(keyFile, key)
  const db = openRepository(path.join(directory, 'library.sqlite'))
  db.save({
    revision: 4,
    albums: [{ id: 'music', name: 'Música' }],
    tracks: [{ id: 'old', albumId: 'music', albumIds: ['music'], title: 'Anterior', kind: 'youtube', src: 'https://www.youtube.com/watch?v=wtX_lGSuD3M' }],
  })
  db.close()
  process.env.LIBRARY_DATA_DIR = directory
  let server
  try {
    const { startServer } = await import(`../src/server.js?youtube=${Date.now()}`)
    server = await startServer({ port: 0, editorKeyFile: keyFile })
    const base = `http://127.0.0.1:${server.address().port}`
    const headers = { Authorization: `Bearer ${key}` }
    const oldTrack = await fetch(`${base}/api/library/tracks/old`, { headers }).then((res) => res.json())
    assert.equal(oldTrack.track.videoId, 'wtX_lGSuD3M')
    const added = await fetch(`${base}/api/library/tracks`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nuevo', albumId: 'music', kind: 'youtube', src: 'https://youtu.be/N4uo8VAxawY' }),
    })
    assert.equal(added.status, 201)
    assert.equal((await added.json()).track.videoId, 'N4uo8VAxawY')
    const persisted = openRepository(path.join(directory, 'library.sqlite'))
    assert.equal(persisted.load().tracks[0].videoId, 'wtX_lGSuD3M')
    persisted.close()
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})
