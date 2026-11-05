import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { readPublicUrl } from '../src/publicUrl.js'

test('la invitación usa la URL actual del túnel y no una URL vieja configurada', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bardo-tunnel-url-'))
  const file = path.join(directory, 'public-url')
  try {
    assert.equal(await readPublicUrl(file, 'https://old.trycloudflare.com/'), '')
    await writeFile(file, 'https://first-link.trycloudflare.com/\n')
    assert.equal(await readPublicUrl(file, 'https://old.trycloudflare.com/'), 'https://first-link.trycloudflare.com/')
    await writeFile(file, 'https://second-link.trycloudflare.com/\n')
    assert.equal(await readPublicUrl(file, 'https://old.trycloudflare.com/'), 'https://second-link.trycloudflare.com/')
    await writeFile(file, '')
    assert.equal(await readPublicUrl(file, 'https://old.trycloudflare.com/'), '')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('solo admite una dirección HTTPS completa y esperada', async () => {
  assert.equal(await readPublicUrl('', 'https://bardo.example.com/'), 'https://bardo.example.com/')
  assert.equal(await readPublicUrl('', 'http://bardo.example.com/'), '')
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bardo-tunnel-url-'))
  const file = path.join(directory, 'public-url')
  try {
    await writeFile(file, 'https://fake.example.com/')
    assert.equal(await readPublicUrl(file), '')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
