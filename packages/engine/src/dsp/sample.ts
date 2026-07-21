import type { DspContext, Kernel, SampleBankRO } from './types'

/** Must match compile.BLOCK — kept local to avoid a compile↔sample cycle. */
const BLOCK = 128

/** Sample playback voice. Inputs: 'gate' (a rising edge >0.5 retriggers),
 *  optional 'speed', optional 'begin'/'end' (0..1 fractions of the buffer —
 *  for chop/striate region play). Config: sample `name` and whether to `loop`.
 *
 *  Mono samples write mid to `out`. Stereo samples (bank entry with `dataR`)
 *  also fill {@link stereoL}/{@link stereoR}; Voice recovers imaging when the
 *  post-sample graph is gain-only (mul/adsr), using panIn/mid as a scale.
 *
 *  Pitch/quality:
 *  - Advances the read head by `speed * (sampleRate / engineRate)` per output
 *    sample, so a 44.1k sample plays at natural pitch through a 48k engine.
 *  - Linear interpolation between adjacent frames (v1 — cheap, slight HF loss
 *    when pitched up; good enough for drums, chops, risers).
 *
 *  Lifecycle:
 *  - Resolves `name` against the shared bank EACH BLOCK, so a sample loaded
 *    after this synth was compiled starts sounding with no recompile. Missing
 *    name -> silence.
 *  - One-shot (loop=false): plays begin->end once per gate edge, then silence
 *    until the next edge (drums don't need a held gate).
 *  - loop=true: wraps within [begin,end) while gated-or-triggered. */
export class SampleKernel implements Kernel {
  /** Fractional read position in source frames. */
  private pos = 0
  private playing = false
  private prevGate = 0
  /** Region endpoints in source frames, latched on each gate edge. */
  private regionStart = 0
  private regionEnd = 0

  /** Last block's left/right (stereo samples). Length BLOCK. */
  readonly stereoL = new Float32Array(BLOCK)
  readonly stereoR = new Float32Array(BLOCK)
  /** True when the last process() saw a stereo bank entry. */
  hadStereo = false

  constructor(
    private readonly name: string,
    private readonly loop: boolean,
    private readonly bank: SampleBankRO | undefined,
  ) {}

  process(n: number, inputs: Record<string, Float32Array>, out: Float32Array, ctx: DspContext): void {
    const gate = inputs['gate']!
    const speed = inputs['speed'] // may be absent -> natural rate (1)
    const beginIn = inputs['begin']
    const endIn = inputs['end']
    const s = this.bank?.get(this.name)
    if (s === undefined || s.data.length === 0) {
      for (let i = 0; i < n; i++) this.prevGate = gate[i]!
      out.fill(0, 0, n)
      this.stereoL.fill(0, 0, n)
      this.stereoR.fill(0, 0, n)
      this.hadStereo = false
      return
    }
    const dataL = s.data
    const dataR = s.dataR
    const stereo = dataR !== undefined && dataR.length === dataL.length
    this.hadStereo = stereo
    const len = dataL.length
    const rate = s.sampleRate / ctx.sampleRate

    for (let i = 0; i < n; i++) {
      const g = gate[i]!
      if (g > 0.5 && this.prevGate <= 0.5) {
        let b = beginIn !== undefined ? beginIn[i]! : 0
        let e = endIn !== undefined ? endIn[i]! : 1
        if (!(b < e)) {
          const t = b
          b = Math.min(b, e)
          e = Math.max(t, e)
        }
        b = Math.min(1, Math.max(0, b))
        e = Math.min(1, Math.max(0, e))
        if (!(b < e)) {
          b = 0
          e = 1
        }
        this.regionStart = b * len
        this.regionEnd = e * len
        this.pos = this.regionStart
        this.playing = true
      }
      this.prevGate = g

      if (!this.playing) {
        out[i] = 0
        this.stereoL[i] = 0
        this.stereoR[i] = 0
        continue
      }

      let p = this.pos
      const r0 = this.regionStart
      const r1 = this.regionEnd
      const rLen = r1 - r0
      if (p >= r1) {
        if (this.loop && rLen > 0) {
          p = r0 + (((p - r0) % rLen) + rLen) % rLen
          this.pos = p
        } else {
          this.playing = false
          out[i] = 0
          this.stereoL[i] = 0
          this.stereoR[i] = 0
          continue
        }
      }

      const i0 = p | 0
      const frac = p - i0
      const sampleAt = (data: Float32Array): number => {
        const a = data[Math.min(len - 1, Math.max(0, i0))]!
        const i1 = i0 + 1
        const bNext =
          i1 < r1 && i1 < len ? data[i1]! : this.loop && rLen > 0 ? data[r0 | 0]! : 0
        return a + frac * (bNext - a)
      }

      const l = sampleAt(dataL)
      if (stereo) {
        const r = sampleAt(dataR!)
        this.stereoL[i] = l
        this.stereoR[i] = r
        out[i] = 0.5 * (l + r) // mid for mono graph / scale recovery
      } else {
        this.stereoL[i] = l
        this.stereoR[i] = l
        out[i] = l
      }

      const sp = speed !== undefined ? speed[i]! : 1
      this.pos = p + sp * rate
    }
  }

  reset(): void {
    this.pos = 0
    this.playing = false
    this.prevGate = 0
    this.regionStart = 0
    this.regionEnd = 0
    this.hadStereo = false
  }
}
