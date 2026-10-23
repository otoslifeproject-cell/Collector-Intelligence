// QA reproductions derive from separate journey/design/accessibility/commercial
// reviews. Existing disposable Auth/REST/Storage harness; never a live provider.
import {test,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
let client,owner;
test.beforeAll(async()=>{client=createClient('http://127.0.0.1:18000',process.env.CI_PHOTO_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await client.auth.signInWithPassword({email:'photo-ci-a@example.test',password:'Ci-disposable-photo-4826!'});expect(r.error).toBeNull();owner=r.data.user.id;});
async function seed(){const r=await client.from('items').insert({title:'QA owner object '+randomUUID(),owner_id:owner,currency:'GBP',sale_readiness:'SELL_NOW',status:'READY_TO_SELL',quick_sale_value:100,expected_net:999,maker:'Unverified fixture attribution'}).select('*').single();expect(r.error).toBeNull();return r.data;}
async function login(page,path='/#/',theme='light'){
 const events={errors:[],paid:[],failed:[]};page.on('pageerror',e=>events.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)events.failed.push({path:new URL(r.url()).pathname,status:r.status()})});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort('blockedbyclient');if(u.pathname.startsWith('/api/')){events.paid.push(u.pathname);return route.abort('blockedbyclient')}return route.fallback()});
 await page.addInitScript(t=>localStorage.setItem('ci-appearance-v1',t),theme);await page.goto(path);await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Ci-disposable-photo-4826!');await page.getByRole('button',{name:'Sign in',exact:true}).click();return events;
}
for(const width of [320,390,768,1440])for(const theme of ['light','dark'])test(`owner QA journey and core audit ${width}px ${theme}`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});const item=await seed(),events=await login(page,'/#/',theme);
 const card=page.locator('.itemCard').filter({hasText:item.title});await expect(card).toHaveCount(1);await expect(card).toContainText('Final research decision required');await expect(card.locator('.itemMeta')).not.toContainText('SELL NOW');
 await page.screenshot({path:`test-artifacts/qa-dashboard-${width}-${theme}.png`,fullPage:true});
 await card.click(); // one navigation click from Dashboard
 const audit=page.getByRole('region',{name:'Research dashboard — '+item.item_code,exact:true});await expect(audit.getByRole('progressbar')).toHaveAttribute('max','7');await expect(audit.getByRole('listitem')).toHaveCount(7);await expect(audit.locator('.ci-research-next')).toContainText('Next action:');
 const disclosure=audit.getByText('Results, sources and unresolved issues',{exact:true}).first();await disclosure.focus();await expect(disclosure).toBeFocused();await page.keyboard.press('Enter');await expect(audit.getByText('Recorded category confidence: Not established',{exact:true}).first()).toBeVisible();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-artifacts/qa-research-${width}-${theme}.png`,fullPage:true});
 await page.getByRole('button',{name:'Sell / route',exact:true}).click(); // second navigation click
 const sale=page.getByRole('region',{name:'Sell Fast plan and listing preparation',exact:true});await expect(sale).toContainText('DO NOT LIST YET');await sale.getByRole('button',{name:'Prepare review draft',exact:true}).click();await expect(sale.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Not published.');
 const rows=await client.from('listings').select('id').eq('item_id',item.id);expect(rows.error).toBeNull();expect(rows.data).toEqual([]);
 await page.screenshot({path:`test-artifacts/qa-selling-${width}-${theme}.png`,fullPage:true});expect(events.errors).toEqual([]);expect(events.paid).toEqual([]);
 await info.attach('qa-observation',{body:JSON.stringify({sha:process.env.GITHUB_SHA,fixtureOwner:owner,itemId:item.id,viewport:width,theme,navigationClicksToSelling:2,provider:'SYNTHETIC_OR_NONE',...events},null,2),contentType:'application/json'});
});
test('QA-J02 unavailable collection recovers by GET rather than claiming empty data',async({page})=>{
 const item=await seed();let denied=true,writes=0;await page.route('**/rest/v1/items*',route=>{if(route.request().method()!=='GET'){writes++;return route.fallback()}return denied?route.fulfill({status:403,json:{message:'Synthetic QA denial'}}):route.fallback()});const events=await login(page);
 await expect(page.getByRole('alert')).toContainText('Collection unavailable');await expect(page.getByText('No items yet',{exact:true})).toHaveCount(0);await page.screenshot({path:'test-artifacts/QA-J02-denied.png',fullPage:true});
 denied=false;await page.getByRole('button',{name:'Reload collection',exact:true}).click();await expect(page.locator('.itemCard').filter({hasText:item.title})).toBeVisible();expect(writes).toBe(0);expect(events.paid).toEqual([]);await page.screenshot({path:'test-artifacts/QA-J02-recovered.png',fullPage:true});
});
test('QA-A01 real bad-password error is announced',async({page})=>{
 await page.goto('/#/');await page.getByLabel('Email',{exact:true}).fill('photo-ci-a@example.test');await page.getByLabel('Password',{exact:true}).fill('Not-the-disposable-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/invalid|credential|password/i);await page.screenshot({path:'test-artifacts/QA-A01-login-error.png',fullPage:true});
});
