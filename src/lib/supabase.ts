import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL

const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Collector Intelligence: Supabase environment variables are missing. Expected VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY or the Vercel Supabase NEXT_PUBLIC equivalents.'
  )
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
