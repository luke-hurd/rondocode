/* Capture worklet: copies stereo input blocks to the main thread for
 * realtime master recording. Buffers are sliced — the process() views are
 * reused by the browser and must not be transferred. */

class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const chs = inputs[0]
    if (!chs || chs.length === 0 || !chs[0] || chs[0].length === 0) return true
    const l = chs[0]
    const r = chs[1] ?? chs[0]
    this.port.postMessage({ l: l.slice(), r: r.slice() })
    return true
  }
}

registerProcessor('rondocode-capture', CaptureProcessor)
