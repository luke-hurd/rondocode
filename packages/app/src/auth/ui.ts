import type { User } from '@supabase/supabase-js'
import { authConfigured, onAuthChange, signInWithGitHub, signOut } from './supabase'
import { claimRoomOwnership, listCloudProjects, saveCloudProject } from '../cloud/projects'
import type { EditorHandle } from '../editor/editor'

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

/**
 * Auth + cloud library controls in the topbar.
 * When Supabase env vars are missing, shows a disabled "sign in" hint.
 */
export function mountAuthUi(editor: EditorHandle, opts?: { roomId?: string }): () => void {
  const wrap = el('div', 'auth-bar')
  const btn = el('button', 'btn auth-btn', authConfigured() ? 'sign in' : 'sign in*')
  btn.type = 'button'
  btn.title = authConfigured()
    ? 'Sign in with GitHub (cloud projects)'
    : 'Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable GitHub auth'
  if (!authConfigured()) btn.disabled = true

  const cloudBtn = el('button', 'btn auth-cloud', 'cloud')
  cloudBtn.type = 'button'
  cloudBtn.title = 'save / load cloud projects'
  cloudBtn.hidden = true

  const claimBtn = el('button', 'btn auth-claim', 'own room')
  claimBtn.type = 'button'
  claimBtn.title = 'claim ownership of this jam room'
  claimBtn.hidden = !opts?.roomId

  wrap.append(btn, cloudBtn, claimBtn)
  const controls = editor.topbar.querySelector('.hdr-controls')
  if (controls) editor.topbar.insertBefore(wrap, controls)
  else editor.topbar.append(wrap)

  let user: User | null = null

  const refresh = (): void => {
    if (!authConfigured()) {
      btn.textContent = 'sign in*'
      cloudBtn.hidden = true
      return
    }
    if (user) {
      const label = user.user_metadata?.user_name ?? user.email ?? 'account'
      btn.textContent = String(label).slice(0, 16)
      btn.title = 'sign out'
      cloudBtn.hidden = false
      claimBtn.hidden = !opts?.roomId
    } else {
      btn.textContent = 'sign in'
      btn.title = 'Sign in with GitHub'
      cloudBtn.hidden = true
    }
  }

  const unsub = onAuthChange((u) => {
    user = u
    refresh()
  })

  btn.addEventListener('click', () => {
    if (!authConfigured()) return
    if (user) void signOut()
    else void signInWithGitHub()
  })

  cloudBtn.addEventListener('click', () => {
    void openCloudSheet(editor)
  })

  claimBtn.addEventListener('click', () => {
    if (!opts?.roomId || !user) return
    void claimRoomOwnership(opts.roomId).then((ok) => {
      claimBtn.textContent = ok ? 'owned' : 'own room'
    })
  })

  return () => {
    unsub()
    wrap.remove()
  }
}

async function openCloudSheet(editor: EditorHandle): Promise<void> {
  const existing = document.querySelector('.cloud-sheet')
  if (existing) {
    existing.remove()
    return
  }
  const sheet = el('div', 'cloud-sheet')
  const head = el('div', 'cloud-head', 'cloud projects')
  const list = el('div', 'cloud-list')
  const saveBtn = el('button', 'btn', 'save current')
  saveBtn.type = 'button'
  sheet.append(head, saveBtn, list)
  document.body.append(sheet)

  const reload = async (): Promise<void> => {
    const projects = await listCloudProjects()
    list.replaceChildren(
      ...projects.map((p) => {
        const row = el('button', 'cloud-row')
        row.type = 'button'
        row.textContent = p.name
        row.addEventListener('click', () => {
          editor.loadCode(p.code)
          sheet.remove()
        })
        return row
      }),
    )
    if (projects.length === 0) {
      list.append(el('div', 'cloud-empty', 'no cloud projects yet'))
    }
  }

  saveBtn.addEventListener('click', () => {
    const name = prompt('project name', 'jam') ?? 'jam'
    void saveCloudProject({ name, code: editor.getDoc() }).then(() => reload())
  })

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.remove()
  })

  await reload()
}
