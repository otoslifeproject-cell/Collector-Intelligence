import {defineConfig} from '@playwright/test';
if(process.env.CI_ARCHIVE_DISPOSABLE_CONFIRMED!=='yes')throw Error('Archive browser test requires the disposable HTTP harness.');
export default defineConfig({
  testDir:'.',testMatch:['canonical-archive.spec.mjs','sale-outcome.spec.mjs','ui-layout.spec.mjs'],workers:1,retries:0,timeout:30000,
  use:{baseURL:'http://127.0.0.1:15173',browserName:'chromium',headless:true,locale:'en-GB'},
  outputDir:'../test-artifacts/archive-results',
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 15173 --strictPort',
    cwd:process.cwd(),url:'http://127.0.0.1:15173/tests/fixtures/canonical-archive.html',reuseExistingServer:false,timeout:30000},
});
