import {defineConfig} from '@playwright/test';
if(process.env.CI_PHOTO_DISPOSABLE_CONFIRMED!=='yes'||!process.env.CI_PHOTO_PUBLIC_KEY)throw Error('Photo application tests require the guarded disposable Storage harness.');
export default defineConfig({
 testDir:'.',testMatch:['photo-app.spec.mjs','catalogue-app.spec.mjs'],workers:1,retries:0,timeout:30000,
 use:{baseURL:'http://127.0.0.1:15174',browserName:'chromium',headless:true,locale:'en-GB',screenshot:'only-on-failure'},
 outputDir:'../test-artifacts/photo-app-results',
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 15174 --strictPort --mode ci-photo',
  cwd:process.cwd(),url:'http://127.0.0.1:15174',reuseExistingServer:false,timeout:30000,
  env:{VITE_SUPABASE_URL:'http://127.0.0.1:18000',VITE_SUPABASE_PUBLISHABLE_KEY:process.env.CI_PHOTO_PUBLIC_KEY}},
});
