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
test('QA-S02 saved catalogue facts can receive a confirmed hold without a page refresh',async({page})=>{
 const item=await seed(),events=await login(page,'/#/item/'+item.id);
 await page.getByText('Edit full item record, commercial details and values',{exact:true}).click();await page.getByLabel('Condition',{exact:true}).fill('Owner observed condition for the independent save/readback regression.');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Saved',{exact:true})).toBeVisible();
 const panel=page.getByRole('region',{name:'Final item decision — '+item.item_code,exact:true});await panel.getByText('Record a hold decision and guidance',{exact:true}).click();await panel.getByLabel('Decision',{exact:true}).selectOption('SPECIALIST_REVIEW');
 await panel.getByLabel('Decision rationale (at least 40 characters)',{exact:true}).fill('Both physical signatures and achieved-sale comparability need independent review before any listing.');await panel.getByLabel('Unresolved identification / value issues',{exact:true}).fill('Maker attribution and condition remain unresolved.');await panel.getByLabel('Next recommended action',{exact:true}).fill('Examine both bases and measure each piece.');await panel.getByLabel('Selling route guidance while research is incomplete',{exact:true}).fill('Hold all routes until the evidence and actual costs are reviewed.');
 await panel.getByRole('button',{name:'Save hold decision',exact:true}).click();await expect(panel).toContainText('Final hold decision confirmed by stored readback.');
 const facts=await client.from('item_assessment_context_v1').select('facts_sha256').eq('item_id',item.id).single();const decisions=await client.from('item_research_assessments').select('*').eq('item_id',item.id);expect(facts.error).toBeNull();expect(decisions.error).toBeNull();expect(decisions.data).toHaveLength(1);expect(decisions.data[0].facts_sha256).toBe(facts.data.facts_sha256);expect(decisions.data[0].decision).toBe('SPECIALIST_REVIEW');expect(events.paid).toEqual([]);expect(events.errors).toEqual([]);await page.screenshot({path:'test-artifacts/QA-S02-save-then-hold.png',fullPage:true});
});
test('listing review draft persists, restores after refresh and never creates publication evidence',async({page})=>{
 const item=await seed(),events=await login(page,'/#/item/'+item.id+'?tab=sales');const plan=page.getByRole('region',{name:'Sell Fast plan and listing preparation',exact:true});
 let inserts=0;await page.route('**/rest/v1/listings*',async route=>{if(route.request().method()!=='POST')return route.fallback();inserts++;const committed=await route.fetch();expect(committed.ok()).toBe(true);return route.fulfill({status:503,json:{message:'Synthetic lost acknowledgement after actual draft commit'}})});
 await plan.getByRole('button',{name:'Prepare review draft',exact:true}).click();const title=await plan.getByLabel('Draft title',{exact:true}).inputValue();await plan.getByRole('button',{name:'Save review draft',exact:true}).click();await expect(plan).toContainText('Review draft confirmed from stored readback.');expect(inserts).toBe(1);
 await page.reload();await expect(plan.getByRole('button',{name:'Restore saved review draft',exact:true})).toBeVisible();await plan.getByRole('button',{name:'Restore saved review draft',exact:true}).click();await expect(plan.getByLabel('Draft title',{exact:true})).toHaveValue(title);await expect(plan.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Not published.');
 const read=await client.from('listings').select('*').eq('item_id',item.id);expect(read.error).toBeNull();expect(read.data).toHaveLength(1);expect(read.data[0].listing_status).toBe('DRAFT');expect(read.data[0].listing_url).toBeNull();expect(read.data[0].listed_at).toBeNull();expect(read.data[0].asking_price).toBeNull();expect(read.data[0].item_specifics.collector_sale_review_v1.itemId).toBe(item.id);expect(events.paid).toEqual([]);expect(events.errors).toEqual([]);await page.screenshot({path:'test-artifacts/QA-listing-review-restored.png',fullPage:true});
});
