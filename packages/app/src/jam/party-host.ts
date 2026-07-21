/** PartyKit host for jam rooms. Override with VITE_PARTYKIT_HOST. */
export function partyKitHost(): string {
  const fromEnv = (import.meta.env.VITE_PARTYKIT_HOST as string | undefined)?.trim()
  if (fromEnv) return fromEnv
  if (typeof location !== 'undefined' && location.hostname === 'localhost') {
    return 'localhost:1999'
  }
  // Deployed PartyKit project (override via env in production builds).
  return 'rondocode-jam.luke-hurd.partykit.dev'
}

export function roomIdFromLocation(search = location.search, hash = location.hash): string | null {
  const q = new URLSearchParams(search)
  const fromQuery = q.get('room')?.trim()
  if (fromQuery) return sanitizeRoomId(fromQuery)
  // /j/:id path style when served under that route
  const path = typeof location !== 'undefined' ? location.pathname : ''
  const m = path.match(/\/j\/([a-zA-Z0-9_-]{2,64})/)
  if (m?.[1]) return sanitizeRoomId(m[1])
  // Also accept #room= for share-friendly URLs
  const hq = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const fromHash = hq.get('room')?.trim()
  if (fromHash) return sanitizeRoomId(fromHash)
  return null
}

export function sanitizeRoomId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'lobby'
}

export function isSpectatorParam(search = location.search): boolean {
  return new URLSearchParams(search).get('spectate') === '1'
}
