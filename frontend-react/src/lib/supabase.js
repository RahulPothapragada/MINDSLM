import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase is only used for sign-in. The chat/data backend is the local
// Flask API, not Supabase. When no Supabase project is configured (local
// dev without an auth backend), fall back to a local "guest" so the app is
// usable without any external service. To restore real auth, set
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// A single in-memory guest user. Mimics the subset of the supabase-js auth
// API the app calls, so nothing hits the network and every call resolves.
function createGuestClient() {
  const guestUser = {
    id: 'local-guest',
    email: 'guest@localhost',
    user_metadata: { full_name: 'Guest' },
  }
  const guestSession = { user: guestUser }
  const ok = (extra = {}) => Promise.resolve({ data: extra, error: null })

  return {
    auth: {
      getSession: () => ok({ session: guestSession }),
      getUser: () => ok({ user: guestUser }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signInWithPassword: () => ok({ session: guestSession, user: guestUser }),
      signUp: () => ok({ session: guestSession, user: guestUser }),
      signInWithOAuth: () => ok(),
      signOut: () => ok(),
    },
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createGuestClient()
