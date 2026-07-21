import type { Session } from '../session/Session'
import type { JamHandle } from './types'

/** Apply shared stem mute masks via channel gain (local audio only). */
export function applyStemMutes(session: Session, mutes: Record<string, boolean>): void {
  const state = session.getState()
  for (const synth of state.synths) {
    const muted = Boolean(mutes[synth])
    session.setChannel(synth, { gain: muted ? 0 : 1 })
  }
}

/** Mount a compact stem mute strip that writes into the jam control map. */
export function mountStemStrip(
  parent: HTMLElement,
  jam: JamHandle,
  session: Session,
): () => void {
  const strip = document.createElement('div')
  strip.className = 'jam-stems'
  strip.hidden = true
  parent.append(strip)

  const render = (): void => {
    const synths = session.getState().synths
    if (synths.length === 0) {
      strip.hidden = true
      return
    }
    strip.hidden = false
    let mutes: Record<string, boolean> = {}
    try {
      mutes = JSON.parse(jam.getControl().stemMutes ?? '{}') as Record<string, boolean>
    } catch {
      mutes = {}
    }
    strip.replaceChildren(
      ...synths.map((name) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'btn jam-stem'
        btn.textContent = name
        btn.classList.toggle('muted', Boolean(mutes[name]))
        btn.title = mutes[name] ? `unmute ${name}` : `mute ${name} for everyone`
        btn.addEventListener('click', () => {
          jam.setStemMute(name, !mutes[name])
        })
        return btn
      }),
    )
  }

  const timer = setInterval(render, 1000)
  render()

  return () => {
    clearInterval(timer)
    strip.remove()
  }
}

export function wireStemUpdates(jam: JamHandle, session: Session): () => void {
  return jam.onStemMutes((mutes) => applyStemMutes(session, mutes))
}
