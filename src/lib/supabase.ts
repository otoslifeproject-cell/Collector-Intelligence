import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL

const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && key)

// A non-routable placeholder allows the shell to explain missing Preview configuration
// instead of crashing at import time. App blocks auth/data calls until configured.
export const supabase = createClient(
  supabaseConfigured ? url : 'https://preview-not-configured.invalid',
  supabaseConfigured ? key : 'preview-not-configured', {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
