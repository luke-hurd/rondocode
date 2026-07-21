const NICK_KEY = 'rondocode.jam.nick'
const COLORS = [
  '#e85d4c',
  '#3d9b8f',
  '#c9a227',
  '#6b8cae',
  '#b87d4b',
  '#8a6bb5',
  '#5a9e6f',
  '#d47a9c',
]

const ADJECTIVES = [
  'Neon',
  'Cosmic',
  'Velvet',
  'Rusty',
  'Quiet',
  'Loud',
  'Fuzzy',
  'Sharp',
  'Drift',
  'Pulse',
]
const NOUNS = [
  'Fox',
  'Wave',
  'Drum',
  'Moth',
  'Kite',
  'Bass',
  'Spark',
  'Coil',
  'Ghost',
  'Moon',
]

export function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]!
  return `${a}${n}`
}

export function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]!
}

export function loadOrCreateNickname(): string {
  try {
    const saved = localStorage.getItem(NICK_KEY)?.trim()
    if (saved) return saved
  } catch {
    /* ignore */
  }
  const nick = randomNickname()
  try {
    localStorage.setItem(NICK_KEY, nick)
  } catch {
    /* ignore */
  }
  return nick
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem(NICK_KEY, name.trim() || randomNickname())
  } catch {
    /* ignore */
  }
}
