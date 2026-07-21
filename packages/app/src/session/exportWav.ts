/* ------------------------------------------------------------------------- *
 * In-app / shared: turn a full rondocode program into a 16-bit stereo WAV.
 * Uses the same stage → schedule → mix path as the headless MCP/CLI tools.
 * ------------------------------------------------------------------------- */

import { encodeWav16 } from '@rondocode/engine'
import { stageCode, runPatterns, renderMix } from './render-runner'

export interface ExportWavOpts {
  /** Whole cycles to render. Default 8. */
  cycles?: number
  /** Override cps; otherwise uses setCps from the program (or 0.5). */
  cps?: number
  sampleRate?: number
}

export type ExportWavResult =
  | {
      ok: true
      wav: Uint8Array
      cycles: number
      cps: number
      durationSec: number
      sampleRate: number
      normalized: boolean
      warnings: string[]
    }
  | { ok: false; error: string }

/** Render `source` offline and encode a downloadable WAV. */
export function exportProgramWav(source: string, opts: ExportWavOpts = {}): ExportWavResult {
  const cycles = opts.cycles ?? 8
  if (!(cycles > 0) || !Number.isFinite(cycles)) {
    return { ok: false, error: 'cycles must be a positive number' }
  }
  const staged = stageCode(source)
  if (!staged.ok) {
    const msg = staged.diagnostics.map((d) => d.message).join('; ') || 'eval failed'
    return { ok: false, error: msg }
  }
  if (staged.patterns.size === 0) {
    return { ok: false, error: 'no patterns to render (add a p(...) call)' }
  }
  const cps = opts.cps ?? staged.cps ?? 0.5
  const durationSec = cycles / cps
  const events = runPatterns(staged.patterns, { cycles, cps })
  const mix = renderMix(staged.synths, events, durationSec, {
    sampleRate: opts.sampleRate ?? 48000,
    ...(staged.sidechain ? { sidechain: staged.sidechain } : {}),
    ...(staged.masterComp ? { masterComp: staged.masterComp } : {}),
  })
  const wav = encodeWav16(mix.left, mix.right, mix.sampleRate)
  return {
    ok: true,
    wav,
    cycles,
    cps,
    durationSec,
    sampleRate: mix.sampleRate,
    normalized: mix.normalized,
    warnings: staged.warnings.map((w) => w.message),
  }
}
