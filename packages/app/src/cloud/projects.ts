import { getSupabase, getUser } from '../auth/supabase'
import type { Project } from '../session/projects'

export type CloudProject = Project & {
  ownerId: string
  /** Optional jam room this project owns / is linked to. */
  roomId?: string
}

/**
 * Cloud project library (Supabase `projects` table).
 * Schema (SQL) lives in `supabase/schema.sql`. When auth isn't configured,
 * these helpers no-op / return empty so the app stays offline-first.
 */
export async function listCloudProjects(): Promise<CloudProject[]> {
  const sb = getSupabase()
  const user = await getUser()
  if (!sb || !user) return []
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) {
    console.warn('[cloud] list projects failed', error)
    return []
  }
  return (data ?? []).map(rowToProject)
}

export async function saveCloudProject(
  input: { id?: string; name: string; code: string; roomId?: string },
): Promise<CloudProject | null> {
  const sb = getSupabase()
  const user = await getUser()
  if (!sb || !user) return null
  const now = new Date().toISOString()
  const row = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: user.id,
    name: input.name,
    code: input.code,
    room_id: input.roomId ?? null,
    updated_at: now,
    created_at: now,
  }
  const { data, error } = await sb.from('projects').upsert(row).select().single()
  if (error) {
    console.warn('[cloud] save project failed', error)
    return null
  }
  return rowToProject(data)
}

export async function claimRoomOwnership(roomId: string, projectId?: string): Promise<boolean> {
  const sb = getSupabase()
  const user = await getUser()
  if (!sb || !user) return false
  const { error } = await sb.from('rooms').upsert({
    id: roomId,
    owner_id: user.id,
    project_id: projectId ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    console.warn('[cloud] claim room failed', error)
    return false
  }
  return true
}

function rowToProject(row: Record<string, unknown>): CloudProject {
  return {
    id: String(row.id),
    name: String(row.name ?? 'untitled'),
    code: String(row.code ?? ''),
    createdAt: Date.parse(String(row.created_at ?? '')) || Date.now(),
    updatedAt: Date.parse(String(row.updated_at ?? '')) || Date.now(),
    ownerId: String(row.owner_id ?? ''),
    roomId: row.room_id ? String(row.room_id) : undefined,
  }
}
