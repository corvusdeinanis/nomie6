/**
 * File-backed storage engine for Nomie.
 *
 * Same interface as engine.localforage.ts, but instead of the browser's
 * IndexedDB it talks to nomie_sync.py, which keeps one plain JSON file per
 * key in a folder on disk.
 *
 * Place at: src/domains/storage/engines/file/engine.file.ts
 */
import type { IStorage } from '../../storage'

const SERVER = 'http://localhost:8765'
const API = `${SERVER}/api`

let listeners = []

const keyUrl = (path: string) => `${API}/data/${encodeURIComponent(path)}`

/** Visible, unmissable error. Silently falling back to browser storage would split your data. */
function showServerError(detail: string) {
  const div = document.createElement('div')
  div.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;' +
    'font:16px/1.5 sans-serif;white-space:pre-line'
  div.textContent =
    `Nomie data server not reachable at ${SERVER}\n\n` +
    `Start it with:  python3 nomie_sync.py\nthen reload this page.\n\n(${detail})`
  document.body.appendChild(div)
}

export const FileEngine: IStorage = {
  onReady(func) {
    if (listeners.indexOf(func) == -1) {
      listeners.push(func)
    }
  },
  basePath(path) {
    return path
  },
  fireReady() {
    listeners.forEach((func) => {
      func()
    })
    listeners = []
  },
  async init() {
    try {
      const res = await fetch(`${API}/ping`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      showServerError(e.message)
      throw e
    }
    return this.fireReady()
  },
  async getProfile() {
    return {
      username: 'Local User',
    }
  },
  async put(path, content) {
    const json = JSON.stringify(content)
    const res = await fetch(keyUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: json === undefined ? 'null' : json,
    })
    if (!res.ok) throw new Error(`Could not save "${path}" (HTTP ${res.status})`)
    return content
  },
  async get(path) {
    const res = await fetch(keyUrl(path), { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Could not read "${path}" (HTTP ${res.status})`)
    const text = await res.text()
    return text ? JSON.parse(text) : null
  },
  async list() {
    const res = await fetch(`${API}/keys`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Could not list keys (HTTP ${res.status})`)
    return res.json()
  },
  async delete(path) {
    const res = await fetch(keyUrl(path), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`Could not delete "${path}" (HTTP ${res.status})`)
  },
}
