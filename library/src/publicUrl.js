import { readFile } from 'node:fs/promises'

function normalize(value, quickTunnel = false) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return ''
    if (quickTunnel && !/^[a-z0-9-]+\.trycloudflare\.com$/.test(url.hostname)) return ''
    return url.origin + '/'
  } catch { return '' }
}

export async function readPublicUrl(tunnelFile = '', configuredUrl = '') {
  if (tunnelFile) {
    try { return normalize(await readFile(tunnelFile, 'utf8'), true) }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      return ''
    }
  }
  return normalize(configuredUrl)
}
