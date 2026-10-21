import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
mkdirSync('test-artifacts',{recursive:true});
const history='**/rest/v1/sale_outcomes?*',rpc='**/rest/v1/rpc/ci_record_actual_sale_v1';
async function visit(page,item={}){
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.fallback():route.abort('blockedbyclient'));
 await page.addInitScript(config=>{window.__CI_SALE_FIXTURE__=config;},{key:process.env.CI_ARCHIVE_PUBLIC_KEY,item});
 await page.goto('/tests/fixtures/sale-outcome.html');
 await expect(page.locator('.ci-sale-outcome')).toBeVisible();
}
async function open(page){
 await page.locator('.ci-sale-outcome summary').click();
 await expect(page.getByLabel('Actual sale date')).toBeVisible();
}
async function fill(page,extra={}){
 const date=await page.getByLabel('Actual sale date').getAttribute('max');
 await page.getByLabel('Actual sale date').fill(date);
 await page.getByLabel('Actual selling venue').fill('Synthetic private sale');
 await page.getByLabel('Gross amount received').fill('100.25');
 await page.getByLabel('Platform or auction seller fees').fill('1.05');
 for(const [label,value]of Object.entries(extra))await page.getByLabel(label).fill(value);
 await page.getByRole('checkbox').check();
}
const submit=page=>page.getByRole('button',{name:'Record actual sale and mark SOLD',exact:true});
async function saved(page){await expect(page.getByRole('status')).toContainText('recorded and read back');await expect(page.getByRole('status')).toBeFocused();}
async function rows(page){return page.evaluate(async()=>{
 const result=await window.__CI_SALE_CLIENT__.from('sale_outcomes').select('*').eq('item_id',window.__CI_SALE_ITEM__);
 if(result.error)throw Error(result.error.message);return result.data;
});}
async function switchAccount(page,letter){await page.evaluate(async letter=>{
 const result=await window.__CI_SALE_CLIENT__.auth.signInWithPassword({email:`collector-ci-${letter}@example.test`,password:'Ci-disposable-fixture-4826!'});
 if(result.error)throw Error(result.error.message);
},letter);}
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`actual sale form ${width}px ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await visit(page);await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
 await expect(page.getByLabel('Actual sale date')).not.toBeVisible();await open(page);await fill(page);
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
 const checkbox=await page.getByRole('checkbox').boundingBox();expect(checkbox.width).toBeGreaterThanOrEqual(20);
 expect((await page.locator('.ci-record-selection').boundingBox()).height).toBeGreaterThanOrEqual(44);
 await page.screenshot({path:`test-artifacts/sale-${width}-${theme}.png`,fullPage:true});
 await submit(page).click();await saved(page);
 await expect(page.getByLabel('Saved sale history')).toContainText('Gross £100.25 · Net £99.20 · Profit £78.70');
 expect((await rows(page)).length).toBe(1);expect(errors).toEqual([]);
 await page.screenshot({path:`test-artifacts/sale-saved-${width}-${theme}.png`,fullPage:true});
});
test('different acquisition currency requires an explicit cost; stored sale currency and pence survive remount',async({page})=>{
 await visit(page,{currency:'USD'});await open(page);await fill(page);await expect(submit(page)).toBeDisabled();
 await expect(page.getByText(/no automatic currency conversion/)).toBeVisible();
 await page.getByLabel('Acquisition cost in sale currency').fill('25.10');await submit(page).click();await saved(page);
 const outcome=(await rows(page))[0];expect(outcome.currency).toBe('USD');expect(outcome.acquisition_cost).toBe(25.10);expect(outcome.net_profit).toBe(74.10);
 // Remount the production component, preserving this genuine signed-in SDK and saved object.
 await page.evaluate(()=>window.__CI_SALE_SELECT__('00000000-0000-4000-8000-000000000001'));
 await expect(page.getByRole('alert')).toContainText('unavailable');
 await page.evaluate(()=>window.__CI_SALE_SELECT__(window.__CI_SALE_ITEM__));
 await expect(page.getByLabel('Saved sale history')).toContainText('US$100.25');await expect(page.getByLabel('Saved sale history')).toContainText('US$74.10');
 await expect(submit(page)).toHaveCount(0);
 await page.screenshot({path:'test-artifacts/sale-saved-usd.png',fullPage:true});
});
test('unknown acquisition stays unknown; a genuine loss remains negative',async({page})=>{
 await visit(page,{acquisition_price:null});await open(page);await fill(page,{'Out-of-pocket shipping':'110.25'});
 await submit(page).click();await saved(page);
 await expect(page.getByLabel('Saved sale history')).toContainText('Net -£11.05 · Profit Unknown');
 const outcome=(await rows(page))[0];expect(outcome.net_profit).toBeNull();expect(outcome.return_on_cash).toBeNull();
});
test('sub-penny, negative and nonnumeric amounts cannot be submitted',async({page})=>{
 await visit(page);await open(page);await fill(page);
 for(const value of ['0.001','-2','NaN','1e2','Infinity']){await page.getByLabel('Gross amount received').fill(value);await expect(submit(page)).toBeDisabled();}
 await page.getByLabel('Gross amount received').fill('0.01');await expect(submit(page)).toBeEnabled();
 await page.getByLabel('Payment fees').fill('1.001');await expect(submit(page)).toBeDisabled();expect(await rows(page)).toHaveLength(0);
});
test('failed and incomplete history block recording, with a real reload recovery',async({page})=>{
 await page.route(history,route=>route.fulfill({status:403,json:{code:'42501',message:'Synthetic denial'}}));
 await visit(page);await expect(page.getByRole('alert')).toContainText('Complete sale history could not be loaded');
 await expect(page.locator('summary')).toHaveCount(0);await page.unroute(history);
 await page.route(history,async route=>{const response=await route.fetch();return route.fulfill({response,headers:{...response.headers(),'content-range':'0-0/2'},json:[]});});
 await page.getByRole('button',{name:'Reload sale history'}).click();await expect(page.getByRole('alert')).toContainText('Complete sale history');
 await page.unroute(history);await page.getByRole('button',{name:'Reload sale history'}).click();await open(page);await fill(page);await submit(page).click();await saved(page);
});
test('lost acknowledgement is recovered by reading the real committed event, without a second POST',async({page})=>{
 await visit(page);await open(page);await fill(page);let posts=0;
 await page.route(rpc,async route=>{posts++;const response=await route.fetch();expect(response.ok()).toBe(true);await route.abort('connectionreset');});
 await submit(page).click();await saved(page);expect(posts).toBe(1);expect(await rows(page)).toHaveLength(1);
});
test('successful acknowledgement with unavailable readback stays unconfirmed until explicit reload',async({page})=>{
 await visit(page);await open(page);await fill(page);let posts=0;
 await page.route(rpc,async route=>{posts++;const response=await route.fetch();expect(response.ok()).toBe(true);
  await page.route(history,read=>read.fulfill({status:503,json:{message:'Synthetic read failure'}}));await route.fulfill({response});});
 await submit(page).click();await expect(page.getByRole('status')).toContainText('not yet confirmed',{timeout:15000});await expect(page.getByRole('status')).not.toContainText('recorded and read back');
 await expect(page.locator('summary')).toHaveCount(0);expect(posts).toBe(1);
 await page.unroute(history);await page.getByRole('button',{name:'Reload sale history'}).click();await saved(page);expect(posts).toBe(1);expect(await rows(page)).toHaveLength(1);
});
test('uncommitted interrupted request holds facts and reuses its event identity on deliberate retry',async({page})=>{
 await visit(page);await open(page);await fill(page);const requests=[];
 await page.route(rpc,route=>{requests.push(route.request().postDataJSON());return route.abort('connectionreset');});
 await submit(page).click();await expect(page.getByRole('status')).toContainText('not yet confirmed');
 await open(page);await expect(page.getByLabel('Gross amount received')).toBeDisabled();await expect(page.getByRole('button',{name:'Retry the same sale request'})).toBeEnabled();
 await page.unroute(rpc);await page.route(rpc,route=>{requests.push(route.request().postDataJSON());return route.continue();});
 await page.getByRole('button',{name:'Retry the same sale request'}).click();await saved(page);
 expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);expect(await rows(page)).toHaveLength(1);
});
test('same-owner reauthentication retains the draft; account switch and sign-out clear private state',async({page})=>{
 await visit(page);await open(page);await fill(page);await switchAccount(page,'a');await expect(page.getByLabel('Gross amount received')).toHaveValue('100.25');
 await switchAccount(page,'b');await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByLabel('Gross amount received')).toHaveCount(0);
 expect(await rows(page)).toHaveLength(0);
 await switchAccount(page,'a');await open(page);await expect(page.getByLabel('Gross amount received')).toHaveValue('');
 await page.evaluate(()=>window.__CI_SALE_CLIENT__.auth.signOut({scope:'local'}));await expect(page.getByRole('alert')).toContainText('Sign in again');await expect(page.locator('summary')).toHaveCount(0);
});
test('late private history response cannot appear after an account switch',async({page})=>{
 await visit(page);await open(page);await fill(page);await submit(page).click();await saved(page);
 let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
 await page.route(history,async route=>{const response=await route.fetch();started();await gate;try{await route.fulfill({response});}catch{}});
 // Remount to start a delayed real read for owner A.
 await page.evaluate(()=>window.__CI_SALE_SELECT__('00000000-0000-4000-8000-000000000001'));await expect(page.getByRole('alert')).toBeVisible();
 await page.evaluate(()=>window.__CI_SALE_SELECT__(window.__CI_SALE_ITEM__));await seen;await switchAccount(page,'b');release();
 await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByLabel('Saved sale history')).toHaveCount(0);
});
test('keyboard opens the form and reaches a labelled date input',async({page})=>{
 await visit(page);await page.locator('summary').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');await expect(page.getByLabel('Actual sale date')).toBeFocused();
});
test('late committed sale response stays hidden after the signed-in owner changes',async({page})=>{
 await visit(page);await open(page);await fill(page);
 let release,started;const gate=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
 await page.route(rpc,async route=>{const response=await route.fetch();expect(response.ok()).toBe(true);started();await gate;await route.fulfill({response});});
 await submit(page).click();await seen;await switchAccount(page,'b');release();
 await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByRole('status')).toHaveCount(0);await expect(page.getByLabel('Saved sale history')).toHaveCount(0);
 await switchAccount(page,'a');await expect(page.getByLabel('Saved sale history')).toContainText('£100.25');expect(await rows(page)).toHaveLength(1);
});
test('switching collection objects clears the draft and pending event before a new sale',async({page})=>{
 await visit(page);await open(page);await fill(page);let first;
 await page.route(rpc,route=>{first=route.request().postDataJSON();return route.abort('connectionreset');});
 await submit(page).click();await expect(page.getByRole('status')).toContainText('not yet confirmed');await page.unroute(rpc);
 await page.evaluate(async()=>{
  const client=window.__CI_SALE_CLIENT__,identity=await client.auth.getUser();
  const result=await client.from('items').insert({owner_id:identity.data.user.id,title:'Second synthetic object',currency:'GBP',acquisition_currency:'GBP',acquisition_price:0}).select('id').single();
  if(result.error)throw Error(result.error.message);window.__CI_SALE_ITEM__=result.data.id;window.__CI_SALE_SELECT__(result.data.id);
 });
 await open(page);await expect(page.getByLabel('Gross amount received')).toHaveValue('');await expect(page.getByRole('checkbox')).not.toBeChecked();
 await fill(page);let second;await page.route(rpc,route=>{second=route.request().postDataJSON();return route.continue();});
 await submit(page).click();await saved(page);expect(second.p_client_event_id).not.toBe(first.p_client_event_id);expect(second.p_item_id).not.toBe(first.p_item_id);
 const outcome=(await rows(page))[0];expect(outcome.net_profit).toBe(99.20);expect(outcome.return_on_cash).toBeNull();
});
