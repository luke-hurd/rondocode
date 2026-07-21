import { describe, expect, it } from 'vitest'
import { isSpectatorParam, roomIdFromLocation, sanitizeRoomId } from '../src/jam/party-host'
import { colorForId, randomNickname } from '../src/jam/nicks'

describe('jam party-host', () => {
  it('sanitizes room ids', () => {
    expect(sanitizeRoomId('Hello World!')).toBe('HelloWorld')
    expect(sanitizeRoomId('a'.repeat(100)).length).toBe(64)
    expect(sanitizeRoomId('@@@')).toBe('lobby')
  })

  it('reads room from query', () => {
    expect(roomIdFromLocation('?room=jam-1', '')).toBe('jam-1')
    expect(roomIdFromLocation('?foo=1', '#room=alt')).toBe('alt')
    expect(roomIdFromLocation('', '')).toBe(null)
  })

  it('detects spectate flag', () => {
    expect(isSpectatorParam('?spectate=1')).toBe(true)
    expect(isSpectatorParam('?room=x')).toBe(false)
  })
})

describe('jam nicks', () => {
  it('makes stable colors and random nicks', () => {
    expect(colorForId('abc')).toBe(colorForId('abc'))
    expect(colorForId('abc')).not.toBe(colorForId('xyz'))
    expect(randomNickname().length).toBeGreaterThan(3)
  })
})
