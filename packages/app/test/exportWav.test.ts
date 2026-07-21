import { describe, expect, it } from 'vitest'
import { exportProgramWav } from '../src/session/exportWav'

const SOURCE = `
const blip = synth(({ note, gate, adsr, sine }) =>
  sine(note.freq).mul(adsr(gate, { a: 0.005, d: 0.1, s: 0, r: 0.05 })))
p('lead', n('0 4 7').scale('c major').sound('blip'))
setCps(1)
`

describe('exportProgramWav', () => {
  it('renders a valid WAV for a tiny program', () => {
    const r = exportProgramWav(SOURCE, { cycles: 1, sampleRate: 48000 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cps).toBe(1)
    expect(r.durationSec).toBe(1)
    // RIFF/WAVE header
    expect(String.fromCharCode(...r.wav.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...r.wav.slice(8, 12))).toBe('WAVE')
    expect(r.wav.length).toBeGreaterThan(44)
  })

  it('fails clearly when there are no patterns', () => {
    const r = exportProgramWav('const x = 1', { cycles: 1 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/no patterns/i)
  })
})
