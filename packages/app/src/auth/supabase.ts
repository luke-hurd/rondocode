import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/** Returns a Supabase client when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  if (!url || !key) {
    client = null
    return null
  }
  client = createClient(url, key)
  return client
}

export function authConfigured(): boolean {
  return getSupabase() !== null
}

export async function getUser(): Promise<User | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getUser()
  return data.user ?? null
}

/** GitHub OAuth via Supabase. No-op (returns false) when auth isn't configured. */
export async function signInWithGitHub(): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const redirectTo = `${location.origin}${location.pathname}`
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo },
  })
  if (error) {
    console.warn('[auth] GitHub sign-in failed', error)
    return false
  }
  return true
}

export async function signOut(): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  await sb.auth.signOut()
}

export function onAuthChange(fn: (user: User | null) => void): () => void {
  const sb = getSupabase()
  if (!sb) {
    fn(null)
    return () => {}
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    fn(session?.user ?? null)
  })
  void sb.auth.getUser().then(({ data: u }) => fn(u.user ?? null))
  return () => data.subscription.unsubscribe()
}
