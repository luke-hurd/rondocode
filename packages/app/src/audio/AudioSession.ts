import type { EngineEvent, EngineMessage } from '@rondocode/engine'
import workletUrl from './worklet/processor?worker&url'

/* Main-thread side of the audio stack: owns the AudioContext and the
 * AudioWorkletNode hosting RealtimeEngine (see ./processor.ts), and speaks
 * the EngineMessage/EngineEvent wire protocol over the node's port.
 *
 * Worklet module loading (the Vite-specific part): the `?worker&url` import
 * above. Tried first: bare `new URL('./processor.ts', import.meta.url)` —
 * Vite 5 does NOT bundle that for .ts targets; it inlines the raw TypeScript
 * source as a base64 `data:video/mp2t` asset (broken: uncompiled, bare
 * imports unresolved). `?worker&url` works in both modes: dev serves the
 * transformed module (`/src/audio/processor.ts?worker_file&type=module`),
 * build emits a self-contained ES-module chunk (worker.format: 'es' in
 * vite.config.ts) whose URL lands here. AudioWorklet always loads modules,
 * so a Worker-flavored module URL is exactly what addModule needs. */

/** A sample loaded into the engine, as tracked on the main thread for the UI. */
export interface SampleInfo {
  name: string
  /** length in frames at `sampleRate` */ frames: number
  sampleRate: number
  /** true for the demo samples shipped by default (vox/riser/pad) */ builtIn: boolean
}

export class AudioSession {
  /** Engine → host events (errors, meters), forwarded from the node's port.
   *  Single-listener by design: the Session layer (Task 3.2) owns this and
   *  UI subscribes through it — assigning here is last-writer-wins. */
  onEvent?: (ev: EngineEvent) => void

  /** Visualizer tap (worklet → analyser → destination), or null when the
   *  tap could not be built — viz then simply has no data (see start()). */
  readonly analyser: AnalyserNode | null

  /** Main-thread mirror of the samples loaded into the worklet, in load order
   *  (built-ins first). The worklet is the source of truth for playback; this
   *  is just so the UI can list what is loadable by name. */
  private readonly _samples: SampleInfo[] = []
  private readonly sampleListeners = new Set<() => void>()
  /** main-thread copy of each sample's PCM, kept so the UI can preview it
   *  (the worklet's copy is transferred and not readable from here). */
  private readonly _pcm = new Map<string, { data: Float32Array; sampleRate: number }>()
  private _preview: AudioBufferSourceNode | null = null

  private constructor(
    private readonly context: AudioContext,
    private readonly node: AudioWorkletNode,
    analyser: AnalyserNode | null,
  ) {
    this.analyser = analyser
    node.port.onmessage = (e: MessageEvent) => this.onEvent?.(e.data as EngineEvent)
  }

  /** Create the context + worklet graph. Safe to call at page load: the
   *  AudioContext starts SUSPENDED (creating it and loading the worklet module
   *  need no user gesture) and produces no sound until resume(), which the
   *  first Run calls from its click/keypress gesture (the iOS requirement).
   *  Throws on failure; callers surface the message. */
  static async start(): Promise<AudioSession> {
    const context = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })
    try {
      await context.audioWorklet.addModule(workletUrl)
      const node = new AudioWorkletNode(context, 'rondocode-engine', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2], // ask for stereo; processor tolerates mono
      })
      // Visualizer tap: worklet → analyser → destination. FAIL-OPEN: if the
      // analyser can't be created or wired, fall back to a direct
      // worklet → destination connection — audio must NEVER break because a
      // visualizer couldn't attach. (analyser stays null; viz draws nothing.)
      let analyser: AnalyserNode | null = null
      try {
        const a = context.createAnalyser()
        a.fftSize = 2048
        a.smoothingTimeConstant = 0.8
        node.connect(a)
        a.connect(context.destination)
        analyser = a
      } catch (tapError) {
        console.warn('[audio] analyser tap failed; connecting direct', tapError)
        try {
          node.disconnect() // in case node → analyser landed before the throw
        } catch {
          // never connected: fine
        }
        node.connect(context.destination)
      }
      // Do NOT resume here: at page load there's no user gesture yet. The
      // context stays suspended (silent) until the first Run calls resume().
      return new AudioSession(context, node, analyser)
    } catch (e) {
      context.close().catch(() => {})
      throw e
    }
  }

  send(msg: EngineMessage): void {
    this.node.port.postMessage(msg)
  }

  /** Decode an audio file (any format the browser supports — WAV/MP3/etc.) and
   *  load it into the engine under `name`, downmixed to mono. The PCM buffer is
   *  TRANSFERRED to the worklet (zero-copy). Returns the frame count loaded.
   *  Throws if decoding fails (unsupported/corrupt file). */
  async loadSample(name: string, bytes: ArrayBuffer): Promise<number> {
    const buf = await this.context.decodeAudioData(bytes)
    const n = buf.length
    const mono = new Float32Array(n)
    const chans = buf.numberOfChannels
    for (let c = 0; c < chans; c++) {
      const ch = buf.getChannelData(c)
      for (let i = 0; i < n; i++) mono[i]! += ch[i]!
    }
    if (chans > 1) for (let i = 0; i < n; i++) mono[i]! /= chans
    const keep = mono.slice() // main-thread copy for preview (mono is transferred below)
    this.node.port.postMessage(
      { kind: 'loadSample', name, data: mono, sampleRate: buf.sampleRate } satisfies EngineMessage,
      [mono.buffer],
    )
    this._pcm.set(name, { data: keep, sampleRate: buf.sampleRate })
    this.recordSample(name, n, buf.sampleRate, false)
    return n
  }

  /** Load raw mono PCM directly (e.g. a procedurally generated buffer). Pass
   *  builtIn:true for the demo samples so the UI can label them. */
  loadSamplePcm(name: string, data: Float32Array, sampleRate: number, builtIn = false): void {
    const frames = data.length // read before postMessage transfers the buffer
    const keep = data.slice() // main-thread copy for preview (data is transferred below)
    this.node.port.postMessage(
      { kind: 'loadSample', name, data, sampleRate } satisfies EngineMessage,
      [data.buffer],
    )
    this._pcm.set(name, { data: keep, sampleRate })
    this.recordSample(name, frames, sampleRate, builtIn)
  }

  /** Preview a loaded sample through the AudioContext (independent of the
   *  engine graph). Interrupts any current preview. No-op for unknown names. */
  previewSample(name: string): void {
    const pcm = this._pcm.get(name)
    if (!pcm) return
    this.stopPreview()
    const buf = this.context.createBuffer(1, pcm.data.length, pcm.sampleRate)
    buf.getChannelData(0).set(pcm.data)
    const src = this.context.createBufferSource()
    src.buffer = buf
    const gain = this.context.createGain()
    gain.gain.value = 0.9
    src.connect(gain).connect(this.context.destination)
    src.onended = () => {
      if (this._preview === src) this._preview = null
    }
    void this.context.resume()
    src.start()
    this._preview = src
  }

  /** Stop the current preview, if any. */
  stopPreview(): void {
    if (!this._preview) return
    try {
      this._preview.stop()
    } catch {
      /* already stopped */
    }
    this._preview = null
  }

  /** The samples loaded so far (a copy), built-ins first, then user files. */
  getSamples(): SampleInfo[] {
    return [...this._samples]
  }

  /** Subscribe to sample-list changes (load/remove). Returns an unsubscribe. */
  onSamplesChanged(fn: () => void): () => void {
    this.sampleListeners.add(fn)
    return () => this.sampleListeners.delete(fn)
  }

  /** Drop a loaded sample; synths referencing it fall back to silence. */
  removeSample(name: string): void {
    const i = this._samples.findIndex((s) => s.name === name)
    if (i === -1) return
    this.node.port.postMessage({ kind: 'clearSample', name } satisfies EngineMessage)
    this._samples.splice(i, 1)
    this._pcm.delete(name)
    this.notifySamples()
  }

  private recordSample(name: string, frames: number, sampleRate: number, builtIn: boolean): void {
    const info: SampleInfo = { name, frames, sampleRate, builtIn }
    const i = this._samples.findIndex((s) => s.name === name)
    if (i === -1) this._samples.push(info) // built-ins load first, so stay first
    else this._samples[i] = info // re-loading a name overwrites in place
    this.notifySamples()
  }

  private notifySamples(): void {
    for (const fn of this.sampleListeners) fn()
  }

  get sampleRate(): number {
    return this.context.sampleRate
  }

  /** Approximate host-side "now" in the engine's frame timeline (the worklet
   *  advances the authoritative clock; meters events carry its exact frame). */
  get currentTimeFrames(): number {
    return this.context.currentTime * this.context.sampleRate
  }

  suspend(): Promise<void> {
    return this.context.suspend()
  }

  resume(): Promise<void> {
    return this.context.resume()
  }
}
