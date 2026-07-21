/* ------------------------------------------------------------------------- *
 * ITU-R BS.1770-4 style integrated loudness (LUFS). Used by analyze() for
 * program-level loudness feedback. Block metering + dual gating; not a full
 * broadcast meter (no momentary/short-term yet).
 * ------------------------------------------------------------------------- */

/** Absolute gate threshold (LUFS). */
const ABS_GATE = -70
/** Relative gate offset below absolute-gated loudness (LU). */
const REL_GATE_OFFSET = -10
/** Block length (seconds) and overlap for gating. */
const BLOCK_SEC = 0.4
const OVERLAP = 0.75

/** Biquad: Direct Form I, stereo-agnostic (process one channel). */
interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  z1: number
  z2: number
}

const biquad = (b0: number, b1: number, b2: number, a1: number, a2: number): Biquad => ({
  b0,
  b1,
  b2,
  a1,
  a2,
  z1: 0,
  z2: 0,
})

const processBiquad = (f: Biquad, x: number): number => {
  const y = f.b0 * x + f.z1
  f.z1 = f.b1 * x - f.a1 * y + f.z2
  f.z2 = f.b2 * x - f.a2 * y
  return y
}

/** K-weighting stage 1 (high shelf) + stage 2 (high-pass) at sampleRate.
 *  Coeffs from BS.1770-4 for 48 kHz, bilinear-scaled for other rates. */
const makeKWeight = (sr: number): [Biquad, Biquad] => {
  // Reference coeffs at 48 kHz (BS.1770-4).
  const ref = 48000
  const scale = (c: number): number => c // used at design; we recompute via bilinear
  void scale
  void ref
  // Pre-filter (high shelf ~4 dB @ ~1500 Hz) — bilinear transform of analog prototype.
  // Using the published digital coefficients at 48k and warping for other rates
  // via frequency scaling of tan().
  const f0 = 1681.974450955533
  const G = 3.999843853973347
  const Q = 0.7071752369554196
  const K = Math.tan((Math.PI * f0) / sr)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const a0_ = 1 + K / Q + K * K
  const shelf = biquad(
    (Vh + Vb * K / Q + K * K) / a0_,
    2 * (K * K - Vh) / a0_,
    (Vh - Vb * K / Q + K * K) / a0_,
    2 * (K * K - 1) / a0_,
    (1 - K / Q + K * K) / a0_,
  )
  // RLB high-pass ~38 Hz
  const f1 = 38.13547087602444
  const Q1 = 0.5003270373238773
  const K1 = Math.tan((Math.PI * f1) / sr)
  const a0h = 1 + K1 / Q1 + K1 * K1
  const hp = biquad(
    1 / a0h,
    -2 / a0h,
    1 / a0h,
    2 * (K1 * K1 - 1) / a0h,
    (1 - K1 / Q1 + K1 * K1) / a0h,
  )
  return [shelf, hp]
}

const kWeightChannel = (data: Float32Array, sr: number): Float32Array => {
  const [shelf, hp] = makeKWeight(sr)
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = processBiquad(hp, processBiquad(shelf, data[i]!))
  }
  return out
}

const blockMeanSquare = (data: Float32Array, start: number, len: number): number => {
  let s = 0
  const end = Math.min(start + len, data.length)
  const n = end - start
  if (n <= 0) return 0
  for (let i = start; i < end; i++) {
    const x = data[i]!
    s += x * x
  }
  return s / n
}

/** Integrated loudness in LUFS. Returns -120 for effectively silent input. */
export function integratedLufs(left: Float32Array, right: Float32Array, sampleRate: number): number {
  const n = left.length
  if (n === 0 || right.length !== n) return -120
  const lK = kWeightChannel(left, sampleRate)
  const rK = kWeightChannel(right, sampleRate)
  const blockLen = Math.max(1, Math.round(BLOCK_SEC * sampleRate))
  const hop = Math.max(1, Math.round(blockLen * (1 - OVERLAP)))
  const blocks: number[] = [] // mean square energy per block (stereo avg)
  for (let start = 0; start + blockLen <= n; start += hop) {
    const z = (blockMeanSquare(lK, start, blockLen) + blockMeanSquare(rK, start, blockLen)) / 2
    blocks.push(z)
  }
  if (blocks.length === 0) {
    // Shorter than one block: treat whole buffer as one block
    const z = (blockMeanSquare(lK, 0, n) + blockMeanSquare(rK, 0, n)) / 2
    blocks.push(z)
  }
  const toLufs = (z: number): number => (z > 0 ? -0.691 + 10 * Math.log10(z) : -120)
  // Absolute gate
  const absPassed = blocks.filter((z) => toLufs(z) > ABS_GATE)
  if (absPassed.length === 0) return -120
  const absMean = absPassed.reduce((a, b) => a + b, 0) / absPassed.length
  const relThresh = toLufs(absMean) + REL_GATE_OFFSET
  const relPassed = absPassed.filter((z) => toLufs(z) > relThresh)
  if (relPassed.length === 0) return -120
  const gated = relPassed.reduce((a, b) => a + b, 0) / relPassed.length
  return toLufs(gated)
}
