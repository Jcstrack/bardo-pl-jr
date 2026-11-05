import { DatabaseSync } from 'node:sqlite'

export function openRepository(file) {
  const db = new DatabaseSync(file, { timeout: 5000 })
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      album_id TEXT NOT NULL REFERENCES albums(id),
      position INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS track_albums (
      track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (track_id, album_id)
    );
    CREATE INDEX IF NOT EXISTS track_albums_by_album ON track_albums(album_id, position);
  `)

  const revision = db.prepare("SELECT value FROM metadata WHERE key = 'revision'")
  const insertAlbum = db.prepare('INSERT INTO albums(id, name, position) VALUES (?, ?, ?)')
  const insertTrack = db.prepare('INSERT INTO tracks(id, album_id, position, data) VALUES (?, ?, ?, ?)')
  const insertMembership = db.prepare('INSERT INTO track_albums(track_id, album_id, position) VALUES (?, ?, ?)')
  const setRevision = db.prepare("INSERT INTO metadata(key, value) VALUES ('revision', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")

  function save(next) {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec('DELETE FROM track_albums; DELETE FROM tracks; DELETE FROM albums;')
      next.albums.forEach((album, position) => insertAlbum.run(album.id, album.name, position))
      next.tracks.forEach((track, position) => {
        const { id, albumId, albumIds, ...data } = track
        insertTrack.run(id, albumId, position, JSON.stringify(data))
        albumIds.forEach((album, albumPosition) => insertMembership.run(id, album, albumPosition))
      })
      setRevision.run(String(next.revision))
      db.exec('COMMIT')
    } catch (cause) {
      db.exec('ROLLBACK')
      throw cause
    }
  }

  function load() {
    const albumRows = db.prepare('SELECT id, name FROM albums ORDER BY position').all()
    const membershipRows = db.prepare('SELECT track_id, album_id FROM track_albums ORDER BY track_id, position').all()
    const memberships = new Map()
    for (const row of membershipRows) {
      if (!memberships.has(row.track_id)) memberships.set(row.track_id, [])
      memberships.get(row.track_id).push(row.album_id)
    }
    const tracks = db.prepare('SELECT id, album_id, data FROM tracks ORDER BY position').all().map((row) => ({
      ...JSON.parse(row.data),
      id: row.id,
      albumId: row.album_id,
      albumIds: memberships.get(row.id) || [],
    }))
    return { revision: Number(revision.get()?.value || 0), albums: albumRows, tracks }
  }

  return {
    hasData: () => Boolean(revision.get()),
    load,
    save,
    close: () => db.close(),
  }
}
