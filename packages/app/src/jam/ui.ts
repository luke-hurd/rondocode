import type { JamHandle, JamPeer } from './types'

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Presence strip + nick / driver controls. Mounts into the topbar. */
export function mountJamUi(
  topbar: HTMLElement,
  jam: JamHandle,
  opts?: { onSpectateToggle?: (on: boolean) => void },
): () => void {
  const bar = el('div', 'jam-bar')
  bar.title = `jam room: ${jam.roomId}`

  const roomLabel = el('span', 'jam-room', `jam:${jam.roomId}`)
  const peersEl = el('div', 'jam-peers')
  const nickInput = el('input', 'jam-nick') as HTMLInputElement
  nickInput.type = 'text'
  nickInput.maxLength = 24
  nickInput.placeholder = 'nick'
  nickInput.title = 'your nickname in this room'
  nickInput.value = ''

  const driveBtn = el('button', 'btn jam-drive', 'drive')
  driveBtn.type = 'button'
  driveBtn.title = 'claim driver (Run + transport)'

  const copyBtn = el('button', 'btn jam-copy', 'link')
  copyBtn.type = 'button'
  copyBtn.title = 'copy jam URL'

  const spectateBtn = el('button', 'btn jam-spectate', 'spectate')
  spectateBtn.type = 'button'
  spectateBtn.title = 'open spectator view (projection)'

  bar.append(roomLabel, peersEl, nickInput, driveBtn, copyBtn, spectateBtn)
  // Insert after logo if present
  const logo = topbar.querySelector('.logo')
  if (logo?.nextSibling) topbar.insertBefore(bar, logo.nextSibling)
  else topbar.append(bar)

  const renderPeers = (peers: JamPeer[]): void => {
    peersEl.replaceChildren(
      ...peers.map((p) => {
        const chip = el('span', 'jam-peer')
        chip.style.setProperty('--jam-color', p.color)
        const role =
          p.role === 'driver' ? ' · drive' : p.role === 'spectator' ? ' · watch' : ''
        chip.textContent = `${p.name}${role}`
        chip.title = p.id === jam.peerId ? 'you' : p.id
        if (p.id === jam.peerId) chip.classList.add('me')
        if (p.role === 'driver') chip.classList.add('driver')
        return chip
      }),
    )
    driveBtn.disabled = jam.isSpectator() || jam.isDriver()
    driveBtn.textContent = jam.isDriver() ? 'driving' : 'drive'
  }

  const unsub = jam.onPeers(renderPeers)

  nickInput.addEventListener('change', () => {
    const v = nickInput.value.trim()
    if (v) jam.setNickname(v)
  })

  driveBtn.addEventListener('click', () => jam.claimDriver())

  copyBtn.addEventListener('click', async () => {
    const url = new URL(location.href)
    url.searchParams.set('room', jam.roomId)
    try {
      await navigator.clipboard.writeText(url.toString())
      copyBtn.textContent = 'copied'
      setTimeout(() => {
        copyBtn.textContent = 'link'
      }, 1200)
    } catch {
      prompt('copy jam URL', url.toString())
    }
  })

  spectateBtn.addEventListener('click', () => {
    const url = new URL(location.href)
    url.searchParams.set('room', jam.roomId)
    url.searchParams.set('spectate', '1')
    opts?.onSpectateToggle?.(true)
    window.open(url.toString(), '_blank', 'noopener')
  })

  return () => {
    unsub()
    bar.remove()
  }
}
