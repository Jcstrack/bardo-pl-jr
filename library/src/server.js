import http from 'node:http'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openRepository } from './repository.js'

const root = process.env.LIBRARY_DATA_DIR || '/data'
const uploads = path.join(root, 'uploads')
const legacyDatabase = path.join(root, 'library.json')
const sqliteDatabase = path.join(root, 'library.sqlite')
const invitationFile = path.join(root, 'friend-invitation.json')
const maxAudioBytes = 100 * 1024 * 1024
const maxJsonBytes = 2 * 1024 * 1024
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/
const audioNamePattern = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i
const allowedKinds = new Set(['file', 'url', 'youtube', 'spotify'])
const allowedTrackKeys = ['id', 'albumId', 'albumIds', 'title', 'artist', 'src', 'kind', 'tone', 'fallbackTitle', 'loopStart', 'loopEnd', 'playStart', 'playEnd', 'serverSrc', 'stored']

function youtubeVideoId(source) {
  try {
    const url = new URL(source)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)
        ? url.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : '')
        : ''
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null
  } catch { return null }
}

let state = { revision: 0, albums: [], tracks: [] }
let mutation = Promise.resolve()
let friendKey = ''
let repository

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(value))
}

function error(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function equalSecret(supplied, key) {
  if (!key) return false
  const actual = Buffer.from(key)
  const given = Buffer.from(supplied)
  return given.length === actual.length && timingSafeEqual(given, actual)
}

function accessRole(req, ownerKey) {
  const auth = req.headers.authorization?.replace(/^Bearer /i, '') || ''
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('bardo_access='))?.slice('bardo_access='.length) || ''
  const supplied = auth || cookie
  if (equalSecret(supplied, ownerKey)) return 'owner'
  if (equalSecret(supplied, friendKey)) return 'friend'
  return null
}

async function readJson(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxJsonBytes) throw error(413, 'La solicitud es demasiado grande.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw error(400, 'JSON inválido.') }
}

function cleanAlbum(value) {
  if (!value || !idPattern.test(value.id) || typeof value.name !== 'string') throw error(400, 'Álbum inválido.')
  const name = value.name.trim().slice(0, 120)
  if (!name) throw error(400, 'El álbum necesita nombre.')
  return { id: value.id, name }
}

function cleanTrack(value, albumIds) {
  if (!value || !idPattern.test(value.id) || !allowedKinds.has(value.kind)) throw error(400, 'Canción inválida.')
  const track = Object.fromEntries(allowedTrackKeys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]))
  track.title = String(track.title || '').trim().slice(0, 200)
  track.artist = String(track.artist || '').trim().slice(0, 200)
  track.albumIds = [...new Set((Array.isArray(track.albumIds) ? track.albumIds : [track.albumId]).filter((id) => albumIds.has(id)))].slice(0, 100)
  if (!track.title || !track.albumIds.length) throw error(400, 'La canción necesita título y álbum.')
  track.albumId = track.albumIds.includes(track.albumId) ? track.albumId : track.albumIds[0]
  if (track.kind === 'file') {
    track.src = `/api/library/files/${track.id}`
    track.serverSrc = track.src
    track.stored = true
  } else if (typeof track.src !== 'string' || (!/^https?:\/\//i.test(track.src) && !/^\/audio\/[a-zA-Z0-9._-]+$/.test(track.src)) || track.src.length > 4000) {
    throw error(400, 'Enlace inválido.')
  }
  if (track.kind === 'youtube') {
    track.videoId = youtubeVideoId(track.src)
    if (!track.videoId) throw error(400, 'El enlace de YouTube no contiene un video válido.')
  }
  for (const key of ['loopStart', 'loopEnd', 'playStart', 'playEnd']) {
    if (!Number.isFinite(track[key]) || track[key] < 0) delete track[key]
  }
  track.tone = ['green', 'orange', 'violet'].includes(track.tone) ? track.tone : 'violet'
  if (track.fallbackTitle !== undefined) track.fallbackTitle = String(track.fallbackTitle).slice(0, 200)
  return track
}

async function persist(next) {
  repository.save(next)
  state = next
}

function serial(task) {
  const next = mutation.then(task)
  mutation = next.catch(() => {})
  return next
}

async function applyChanges(changes) {
  if (!changes || typeof changes !== 'object') throw error(400, 'Cambios inválidos.')
  const next = structuredClone(state)
  const albumChanges = changes.albums || {}
  const trackChanges = changes.tracks || {}
  for (const id of albumChanges.remove || []) {
    if (!idPattern.test(id)) throw error(400, 'ID de álbum inválido.')
    next.albums = next.albums.filter((album) => album.id !== id)
  }
  for (const raw of albumChanges.upsert || []) {
    const album = cleanAlbum(raw)
    const index = next.albums.findIndex((item) => item.id === album.id)
    if (index < 0) next.albums.push(album)
    else next.albums[index] = album
  }
  const albumIds = new Set(next.albums.map((album) => album.id))
  next.tracks = next.tracks.flatMap((track) => {
    const ids = track.albumIds.filter((id) => albumIds.has(id))
    return ids.length ? [{ ...track, albumIds: ids, albumId: ids.includes(track.albumId) ? track.albumId : ids[0] }] : []
  })
  for (const id of trackChanges.remove || []) {
    if (!idPattern.test(id)) throw error(400, 'ID de canción inválido.')
    next.tracks = next.tracks.filter((track) => track.id !== id)
  }
  for (const raw of trackChanges.upsert || []) {
    const track = cleanTrack(raw, albumIds)
    if (track.kind === 'file') {
      try { await stat(path.join(uploads, `${track.id}.audio`)) }
      catch { throw error(400, 'Primero sube el archivo de audio.') }
    }
    const index = next.tracks.findIndex((item) => item.id === track.id)
    if (index < 0) next.tracks.push(track)
    else next.tracks[index] = track
  }
  if (Array.isArray(changes.order)) {
    const positions = new Map(changes.order.map((id, index) => [id, index]))
    next.tracks.sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity))
  }
  if (next.albums.length > 500 || next.tracks.length > 5000) throw error(413, 'Biblioteca demasiado grande.')
  if (JSON.stringify(next) === JSON.stringify(state)) return state
  const formerFiles = state.tracks.filter((track) => track.kind === 'file')
  next.revision += 1
  await persist(next)
  const remaining = new Set(next.tracks.filter((track) => track.kind === 'file').map((track) => track.id))
  for (const track of formerFiles.filter((item) => !remaining.has(item.id))) {
    await rm(path.join(uploads, `${track.id}.audio`), { force: true }).catch(console.error)
    await rm(path.join(uploads, `${track.id}.json`), { force: true }).catch(console.error)
  }
  return next
}

async function upload(req, res, id) {
  const name = decodeURIComponent(String(req.headers['x-file-name'] || 'audio'))
  const type = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0]
  if (!audioNamePattern.test(name) || name.length > 255 || (!type.startsWith('audio/') && type !== 'application/octet-stream')) throw error(400, 'Solo se admiten archivos de audio.')
  if (Number(req.headers['content-length']) > maxAudioBytes) throw error(413, 'Máximo 100 MB por archivo.')
  const temporary = path.join(uploads, `${id}.${process.pid}.tmp`)
  let size = 0
  try {
    await pipeline(req, new Transform({ transform(chunk, _encoding, callback) {
      size += chunk.length
      callback(size > maxAudioBytes ? error(413, 'Máximo 100 MB por archivo.') : null, chunk)
    } }), createWriteStream(temporary, { mode: 0o600 }))
    if (!size) throw error(400, 'Archivo vacío.')
    await rename(temporary, path.join(uploads, `${id}.audio`))
    await writeFile(path.join(uploads, `${id}.json`), JSON.stringify({ name, type, size }), { mode: 0o600 })
    json(res, 201, { src: `/api/library/files/${id}`, size })
  } finally { await rm(temporary, { force: true }) }
}

async function serveAudio(req, res, id) {
  const file = path.join(uploads, `${id}.audio`)
  const [info, meta] = await Promise.all([
    stat(file).catch(() => { throw error(404, 'Archivo no encontrado.') }),
    readFile(path.join(uploads, `${id}.json`), 'utf8').then(JSON.parse).catch(() => ({ type: 'application/octet-stream' })),
  ])
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  let start = 0; let end = info.size - 1
  if (range) {
    start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
    end = range[1] && range[2] ? Math.min(info.size - 1, Number(range[2])) : end
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= info.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return
    }
  }
  res.writeHead(range ? 206 : 200, {
    'Content-Type': meta.type,
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}),
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file, { start, end }).pipe(res)
}

export async function startServer({ port = Number(process.env.LIBRARY_PORT || 3002), editorKeyFile = process.env.LIBRARY_EDITOR_KEY_FILE } = {}) {
  await mkdir(uploads, { recursive: true })
  repository = openRepository(sqliteDatabase)
  if (!repository.hasData()) {
    let legacy = { revision: 0, albums: [], tracks: [] }
    try {
      const saved = JSON.parse(await readFile(legacyDatabase, 'utf8'))
      if (Array.isArray(saved.albums) && Array.isArray(saved.tracks)) legacy = saved
    } catch (err) { if (err.code !== 'ENOENT') throw err }
    repository.save(legacy)
  }
  state = repository.load()
  const recovered = state.tracks.map((track) => track.kind === 'youtube'
    ? { ...track, videoId: youtubeVideoId(track.src) || track.videoId }
    : track)
  if (recovered.some((track, index) => track.videoId !== state.tracks[index].videoId)) {
    state = { ...state, tracks: recovered }
    repository.save(state)
  }
  try { friendKey = JSON.parse(await readFile(invitationFile, 'utf8')).token || '' }
  catch (err) { if (err.code !== 'ENOENT') throw err }
  const key = editorKeyFile ? (await readFile(editorKeyFile, 'utf8')).trim() : ''
  if (!key) throw new Error('Falta LIBRARY_EDITOR_KEY_FILE con la clave de invitación.')
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/health') return json(res, 200, { ok: true })
      if (url.pathname === '/api/library/info' && req.method === 'GET') {
        return json(res, 200, { publicUrl: process.env.BARDO_PUBLIC_URL || '' })
      }
      if (url.pathname === '/api/library/session' && req.method === 'POST') {
        const token = req.headers.authorization?.replace(/^Bearer /i, '') || ''
        const role = equalSecret(token, key) ? 'owner' : equalSecret(token, friendKey) ? 'friend' : null
        if (!role) throw error(401, 'Invitación inválida.')
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
        res.setHeader('Set-Cookie', `bardo_access=${token}; HttpOnly; SameSite=Strict; Path=/api/library; Max-Age=2592000${secure}`)
        return json(res, 200, { role })
      }
      if (url.pathname === '/api/library/invite' && req.method === 'POST') {
        if (accessRole(req, key) !== 'owner') throw error(403, 'Solo el propietario puede crear la invitación.')
        if (!process.env.BARDO_PUBLIC_URL) throw error(503, 'La dirección privada aún no está lista.')
        if (!friendKey) {
          friendKey = randomBytes(32).toString('hex')
          await writeFile(invitationFile, JSON.stringify({ token: friendKey }), { mode: 0o600 })
        }
        return json(res, 200, { url: `${process.env.BARDO_PUBLIC_URL}#invite=${friendKey}` })
      }
      if (url.pathname === '/api/library') {
        if (req.method !== 'GET') throw error(405, 'Método no permitido.')
        if (!accessRole(req, key)) throw error(401, 'Abre una invitación para ver la biblioteca.')
        return json(res, 200, state)
      }
      if (url.pathname === '/api/library/sync') {
        if (req.method !== 'POST') throw error(405, 'Método no permitido.')
        if (!accessRole(req, key)) throw error(401, 'Se necesita un enlace de invitación para editar.')
        const body = await readJson(req)
        return json(res, 200, await serial(() => applyChanges(body.changes)))
      }
      const resource = /^\/api\/library\/(albums|tracks)(?:\/([a-zA-Z0-9_-]{1,80}))?$/.exec(url.pathname)
      if (resource) {
        if (!accessRole(req, key)) throw error(401, 'Se necesita una invitación para acceder a la biblioteca.')
        const [, collection, id] = resource
        const singular = collection === 'albums' ? 'album' : 'track'
        const items = state[collection]
        const existing = id ? items.find((item) => item.id === id) : null
        if (req.method === 'GET') {
          if (id && !existing) throw error(404, 'Elemento no encontrado.')
          const selected = id ? existing : collection === 'tracks' && url.searchParams.has('albumId')
            ? items.filter((item) => item.albumIds.includes(url.searchParams.get('albumId')))
            : items
          return json(res, 200, id ? { [singular]: selected, revision: state.revision } : { [collection]: selected, revision: state.revision })
        }
        if (req.method === 'POST' && !id) {
          const body = await readJson(req)
          const raw = body[singular] || body
          const item = { ...raw, id: raw.id || randomUUID() }
          const result = await serial(() => {
            if (state[collection].some((old) => old.id === item.id)) throw error(409, 'Ese ID ya existe.')
            return applyChanges({ [collection]: { upsert: [item] } })
          })
          return json(res, 201, { [singular]: result[collection].find((saved) => saved.id === item.id), revision: result.revision })
        }
        if (req.method === 'PATCH' && id) {
          const body = await readJson(req)
          const result = await serial(() => {
            const current = state[collection].find((old) => old.id === id)
            if (!current) throw error(404, 'Elemento no encontrado.')
            const item = { ...current, ...(body[singular] || body), id }
            return applyChanges({ [collection]: { upsert: [item] } })
          })
          return json(res, 200, { [singular]: result[collection].find((saved) => saved.id === id), revision: result.revision })
        }
        if (req.method === 'DELETE' && id) {
          const result = await serial(() => {
            if (!state[collection].some((old) => old.id === id)) throw error(404, 'Elemento no encontrado.')
            return applyChanges({ [collection]: { remove: [id] } })
          })
          return json(res, 200, { revision: result.revision })
        }
        throw error(405, 'Método no permitido.')
      }
      const match = /^\/api\/library\/files\/([a-zA-Z0-9_-]{1,80})$/.exec(url.pathname)
      if (!match) throw error(404, 'Ruta no encontrada.')
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!accessRole(req, key)) throw error(401, 'Se necesita una invitación para escuchar este archivo.')
        return await serveAudio(req, res, match[1])
      }
      if (req.method === 'PUT') {
        if (!accessRole(req, key)) throw error(401, 'Se necesita un enlace de invitación para subir audio.')
        return await upload(req, res, match[1])
      }
      throw error(405, 'Método no permitido.')
    } catch (err) {
      if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'Error interno de la biblioteca.' })
      else res.destroy()
      if (!err.status) console.error(err)
    }
  })
  await new Promise((resolve) => server.listen(port, '0.0.0.0', resolve))
  server.on('close', () => repository.close())
  const ownerPort = Number(process.env.LIBRARY_OWNER_PORT || 0)
  if (ownerPort) {
    const allowedOrigins = new Set([
      'http://localhost:8088', 'http://localhost:5173',
      'http://127.0.0.1:8088', 'http://127.0.0.1:5173',
    ])
    const ownerServer = http.createServer((req, res) => {
      const origin = req.headers.origin || ''
      const host = req.headers.host || ''
      if (req.method !== 'GET' || req.url !== '/api/owner' || !allowedOrigins.has(origin) || !['localhost', '127.0.0.1'].includes(host.split(':')[0])) {
        return json(res, 403, { error: 'Acceso local no autorizado.' })
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
      })
      res.end(JSON.stringify({ key }))
    })
    await new Promise((resolve) => ownerServer.listen(ownerPort, '0.0.0.0', resolve))
    server.on('close', () => ownerServer.close())
  }
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(() => console.log('Biblioteca lista')).catch((err) => { console.error(err); process.exit(1) })
}
