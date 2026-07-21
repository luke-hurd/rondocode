import type { AudioSession } from '../audio/AudioSession'

/** Fetch remote sample packs listed in the jam control plane and load into the engine. */
export async function loadRemoteSamples(
  audio: AudioSession,
  samples: { name: string; url: string }[],
): Promise<{ loaded: string[]; failed: string[] }> {
  const loaded: string[] = []
  const failed: string[] = []
  for (const s of samples) {
    const name = s.name?.trim()
    const url = s.url?.trim()
    if (!name || !url) continue
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      await audio.loadSample(name, buf)
      loaded.push(name)
    } catch (e) {
      console.warn(`[jam] sample CDN load failed: ${name}`, e)
      failed.push(name)
    }
  }
  return { loaded, failed }
}

/** Built-in demo CDN stubs — free CC0-ish short oneshots hosted on CDN if configured.
 *  Drivers can call jam.setSampleUrls([...DEFAULT_SAMPLE_CDN, ...]). */
export const DEFAULT_SAMPLE_CDN: { name: string; url: string }[] = []
