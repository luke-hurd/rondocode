import type { SampleData, SampleBankRO } from './dsp/types'

/** The engine's sample store: name -> decoded PCM (mono or stereo). The
 *  realtime engine owns one and exposes it on DspContext.samples; SampleKernels
 *  hold a reference and resolve names against it each block, so a sample loaded
 *  after a synth was compiled becomes audible with no recompile. */
export class SampleBank implements SampleBankRO {
  private readonly map = new Map<string, SampleData>()

  /** Store (or replace) a buffer under `name`. Optional `dataR` makes it stereo
   *  (must match `data.length`). Non-finite samples are scrubbed to 0. */
  set(name: string, data: Float32Array, sampleRate: number, dataR?: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      if (!Number.isFinite(data[i]!)) data[i] = 0
    }
    if (dataR !== undefined) {
      if (dataR.length !== data.length) {
        // Mismatched lengths → treat as mono (defensive).
        this.map.set(name, { data, sampleRate })
        return
      }
      for (let i = 0; i < dataR.length; i++) {
        if (!Number.isFinite(dataR[i]!)) dataR[i] = 0
      }
      this.map.set(name, { data, dataR, sampleRate })
      return
    }
    this.map.set(name, { data, sampleRate })
  }

  get(name: string): SampleData | undefined {
    return this.map.get(name)
  }

  delete(name: string): void {
    this.map.delete(name)
  }

  has(name: string): boolean {
    return this.map.has(name)
  }

  /** Names currently loaded (for diagnostics/UI). */
  names(): string[] {
    return [...this.map.keys()]
  }
}
