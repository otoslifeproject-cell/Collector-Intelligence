import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Preview must never silently use the live Collector Intelligence database.
// This verifies both supported frontend variable names at build time.
const isVercelPreview = process.env.VERCEL_ENV === 'preview'
const candidateBackendUrls = [
  process.env.VITE_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL
].filter((value): value is string => Boolean(value))

const expresslyApprovedOwnerTest = process.env.CI_OWNER_TEST_LIVE_DB === 'true' && process.env.VERCEL_GIT_COMMIT_REF === 'continuity/resolver-fixtures-20261020'

if (isVercelPreview && !expresslyApprovedOwnerTest && candidateBackendUrls.some(url => {
  try {
    return new URL(url).hostname.toLowerCase() === 'bwdafrwkimjvwfoqomot.supabase.co'
  } catch {
    // Invalid backend URLs must not be treated as proof of isolation.
    return true
  }
})) {
  throw new Error('Collector Intelligence: live backend in Preview requires explicit branch-bound owner-test authorisation.')
}

export default defineConfig({
  plugins: [react()],
  base: './',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_']
})
