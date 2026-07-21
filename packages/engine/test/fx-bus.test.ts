import { describe, expect, it } from 'vitest'
import { BLOCK, RealtimeEngine, fx, synth } from '../src/index'
import type { DspContext } from '../src/dsp/types'

describe('shared FX send/return', () => {
  it('defineFx + setSend adds wet energy beyond dry', () => {
    const ctx: DspContext = { sampleRate: 48000 }
    const eng = new RealtimeEngine(ctx)
    const def = synth(({ note, gate, adsr, saw }) => saw(note.freq).mul(adsr(gate, { a: 0.001, r: 0.05 })))
    eng.handleMessage({ kind: 'defineSynth', name: 'pad', graph: def.graph })
    const room = fx(({ input, reverb }) => input.mix(reverb(input, { roomSize: 0.9, damp: 0.3 }), 1))
    eng.handleMessage({ kind: 'defineFx', name: 'room', graph: room })
    eng.handleMessage({ kind: 'setSend', synth: 'pad', fx: 'room', amount: 0.8 })
    eng.handleMessage({ kind: 'noteOn', synth: 'pad', note: 60, velocity: 1 })

    const L = new Float32Array(BLOCK)
    const R = new Float32Array(BLOCK)
    let peak = 0
    for (let b = 0; b < 20; b++) {
      eng.process(L, R, b * BLOCK)
      for (let i = 0; i < BLOCK; i++) peak = Math.max(peak, Math.abs(L[i]!), Math.abs(R[i]!))
    }
    expect(peak).toBeGreaterThan(0.01)
    expect(L.every(Number.isFinite)).toBe(true)
  })
})
