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
 const card=page.locator('.itemCard').filter({hasText:item.title});await expect(card).toHaveCount(1);await expect(card).toContainText('Final research decision required');await expect(card.locator('.itemMeta')).not.toContainText('SELL NOW');expect(await card.locator('.itemMeta').evaluate(el=>{const s=getComputedStyle(el);return s.flexWrap==='wrap'&&parseFloat(s.columnGap)>=8})).toBe(true);
 await page.screenshot({path:`test-artifacts/qa-dashboard-${width}-${theme}.png`,fullPage:true});
 await card.click(); // one navigation click from Dashboard
 const badge=page.locator('.itemHero .pill.accent');await expect(badge).toContainText('FINAL RESEARCH DECISION REQUIRED');
 const badgeContrast=await badge.evaluate(el=>{const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);const style=getComputedStyle(el),a=lum(rgb(style.color)),b=lum(rgb(style.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});expect(badgeContrast).toBeGreaterThanOrEqual(4.5);
 const audit=page.getByRole('region',{name:'Research dashboard — '+item.item_code,exact:true});await expect(audit.getByRole('progressbar')).toHaveAttribute('max','7');await expect(audit.getByRole('listitem')).toHaveCount(7);await expect(audit.locator('.ci-research-next')).toContainText('Next action:');
 const disclosure=audit.getByText('Results, sources and unresolved issues',{exact:true}).first();await disclosure.focus();await expect(disclosure).toBeFocused();await page.keyboard.press('Enter');await expect(audit.getByText('Recorded category confidence: Not established',{exact:true}).first()).toBeVisible();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const contrast=await audit.evaluate(root=>{
  const rgb=s=>{const n=s.match(/[\d.]+/g)?.map(Number);return n&&n.length>=3?[...n.slice(0,3),n[3]??1]:[0,0,0,0]};
  const blend=(front,back)=>front.slice(0,3).map((n,i)=>n*front[3]+back[i]*(1-front[3]));
  const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
  return [...root.querySelectorAll('h2,.ci-audit-total strong,.ci-audit-total span,.ci-research-next,.ci-audit-category>strong,.ci-audit-category>p,.ci-audit-state')].map(el=>{const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);let bg=[255,255,255];for(const n of chain)bg=blend(rgb(getComputedStyle(n).backgroundColor),bg);const style=getComputedStyle(el),fg=blend(rgb(style.color),bg),a=lum(fg),b=lum(bg);return {text:el.textContent.slice(0,90),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum:parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.667&&parseInt(style.fontWeight)>=700)?3:4.5}});
 });
 expect(contrast).toHaveLength(25);expect(contrast.filter(c=>c.ratio+.001<c.minimum)).toEqual([]);await info.attach('rendered-audit-text-contrast',{body:JSON.stringify(contrast,null,2),contentType:'application/json'});
 await page.screenshot({path:`test-artifacts/qa-research-${width}-${theme}.png`,fullPage:true});
 await page.getByRole('button',{name:'Sell / route',exact:true}).click(); // second navigation click
 const sale=page.getByRole('region',{name:'Sell Fast plan and listing preparation',exact:true});await expect(sale).toContainText('DO NOT LIST YET');await sale.getByRole('button',{name:'Prepare review draft',exact:true}).click();await expect(sale.getByRole('region',{name:'Listing review draft',exact:true})).toContainText('Not published.');
 const rows=await client.from('listings').select('id').eq('item_id',item.id);expect(rows.error).toBeNull();expect(rows.data).toEqual([]);
 await page.screenshot({path:`test-artifacts/qa-selling-${width}-${theme}.png`,fullPage:true});expect(events.errors).toEqual([]);expect(events.paid).toEqual([]);
 await info.attach('qa-observation',{body:JSON.stringify({sha:process.env.GITHUB_SHA,fixtureOwner:owner,itemId:item.id,viewport:width,theme,navigationClicksToSelling:2,provider:'SYNTHETIC_OR_NONE',...events},null,2),contentType:'application/json'});
});
test('rendered200percent zoom and reduced motion preserve the core owner workflow',async({page})=>{
 await page.setViewportSize({width:1280,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const item=await seed(),events=await login(page,'/#/item/'+item.id);
 const audit=page.getByRole('region',{name:'Research dashboard — '+item.item_code,exact:true});await expect(audit.getByRole('listitem')).toHaveCount(7);await expect(audit.getByRole('progressbar')).toHaveAttribute('max','7');await page.evaluate(()=>document.documentElement.style.zoom='2');await expect(page.getByRole('button',{name:'Research & value',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sell / route',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);expect(await audit.locator('.ci-audit-category').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width>=n.closest('.ci-research-progress').getBoundingClientRect().width*.6))).toBe(true);expect(events.errors).toEqual([]);expect(events.paid).toEqual([]);await page.screenshot({path:'test-artifacts/QA-owner-200percent-reduced-motion.png',fullPage:true});
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
 const panel=page.getByRole('region',{name:'Owner hold decision — '+item.item_code,exact:true});await panel.getByText('Record a hold decision and guidance',{exact:true}).click();await panel.getByLabel('Decision',{exact:true}).selectOption('SPECIALIST_REVIEW');
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
test('unknown object currency stays unknown in detail and blocks monetary assumptions',async({page})=>{
 const item=await seed();expect((await client.from('items').update({currency:'',acquisition_currency:'',acquisition_price:10}).eq('id',item.id)).error).toBeNull();const events=await login(page,'/#/item/'+item.id);await expect(page.getByText('Currency unconfirmed',{exact:true}).first()).toBeVisible();await expect(page.locator('.valueSummary').first()).not.toContainText('£');
 await page.getByRole('button',{name:'Sell / route',exact:true}).click();const economics=page.locator('.ci-sale-economics').filter({has:page.getByRole('heading',{name:'Sale proceeds & profit scenarios',exact:true})});await expect(economics).toContainText('Currency unconfirmed');await expect(economics.getByRole('spinbutton',{name:'Expected gross sale',exact:true})).toBeDisabled();await expect(economics.locator('.ci-economics-results')).not.toContainText('£');expect(events.paid).toEqual([]);expect(events.errors).toEqual([]);
});


test('Inventory: denied saved-draft history never means zero drafts, and GET retry restores source',async({page})=>{
 const title='Owner draft source '+randomUUID();
 const saved=await client.from('ai_analysis_runs').insert({mode:'single',status:'DRAFT',model:'fixture-no-provider',input_photo_count:1,result:{analysis_stage:'COMPLETE',objects:[{working_title:title,object_type:'Vase',image_indices:[]}],image_manifest:[]}}).select('id').single();
 expect(saved.error).toBeNull();
 let denied=true;
 await page.route('**/rest/v1/ai_analysis_runs*',route=>route.request().method()==='GET'&&denied?route.fulfill({status:403,json:{message:'Synthetic draft denial'}}):route.fallback());
 const events=await login(page,'/#/inventory');
 await expect(page.getByRole('alert').filter({hasText:'Saved draft history unavailable'})).toBeVisible();
 await expect(page.locator('.inventorySummary')).toContainText('Saved draft count unavailable');
 await expect(page.locator('.inventorySummary')).not.toContainText('0 unfinished draft');
 denied=false;
 await page.getByRole('button',{name:'Reload inventory sources',exact:true}).click();
 await expect(page.getByText(title,{exact:true})).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Saved draft history unavailable'})).toHaveCount(0);
 expect(events.paid).toEqual([]);
});
test('Inventory: a denied photo-metadata read is not a missing-original verdict',async({page})=>{
 const item=await seed();
 let denied=true;
 await page.route('**/rest/v1/item_photos*',route=>route.request().method()==='GET'&&denied?route.fulfill({status:403,json:{message:'Synthetic photo denial'}}):route.fallback());
 const events=await login(page,'/#/inventory');
 const card=page.locator('.itemCard').filter({hasText:item.title});
 await expect(card).toContainText('Photo history unavailable');
 await expect(card).not.toContainText('Photo not linked');
 denied=false;
 await page.getByRole('button',{name:'Reload inventory sources',exact:true}).click();
 await expect(card).toContainText('No photograph linked');
 expect(events.paid).toEqual([]);
});
test('Inventory: denied owner corrections remain explicit unknown until read-only retry',async({page})=>{
 let denied=true;
 await page.route('**/rest/v1/ai_verdict_feedback*',route=>route.request().method()==='GET'&&denied?route.fulfill({status:403,json:{message:'Synthetic correction denial'}}):route.fallback());
 const events=await login(page,'/#/inventory');
 await expect(page.getByRole('alert').filter({hasText:'Owner correction history unavailable'})).toBeVisible();
 denied=false;
 await page.getByRole('button',{name:'Reload inventory sources',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Owner correction history unavailable'})).toHaveCount(0);
 expect(events.paid).toEqual([]);
});


test('Sales pipeline opens directly into its object selling workspace',async({page})=>{
 const item=await seed(),events=await login(page,'/#/sales');
 const row=page.getByRole('row').filter({hasText:item.title});
 await expect(row).toBeVisible();
 const link=row.getByRole('link',{name:new RegExp(item.item_code)});
 await expect(link).toHaveAttribute('href','#/item/'+item.id+'?tab=sales');
 await link.click();
 await expect(page).toHaveURL(new RegExp('/#/item/'+item.id+'\\?tab=sales$'));
 await expect(page.locator('.tabBar').getByRole('button',{name:'sales',exact:true})).toHaveClass(/active/);
 const sell=page.getByRole('region',{name:'Sell Fast plan and listing preparation',exact:true});
 await expect(sell).toBeVisible();
 const research=page.getByRole('region',{name:'Research dashboard — '+item.item_code,exact:true});
 await expect(research).toBeVisible();
 expect(await sell.evaluate((el,audit)=>Boolean(el.compareDocumentPosition(audit)&Node.DOCUMENT_POSITION_FOLLOWING),await research.elementHandle())).toBe(true);
 expect(events.paid).toEqual([]);
});
test('Dashboard reaches saved photo history with one navigation click',async({page})=>{
 const events=await login(page,'/#/');
 const link=page.getByRole('link',{name:'Resume saved photo sessions',exact:true});
 await expect(link).toHaveAttribute('href','#/uploads');
 await link.click();
 await expect(page).toHaveURL(/\/#\/uploads$/);
 await expect(page.getByRole('heading',{name:'Saved uploads',exact:true})).toBeVisible();
 expect(events.paid).toEqual([]);
});


test('Inventory saved batch object B deep-links to its own evidence scope, not object A',async({page})=>{
 const prefix='Batch boundary '+randomUUID();
 const second=prefix+' object B',first=prefix+' object A';
 const id=randomUUID();
 const result={analysis_stage:'COMPLETE',image_manifest:[
  {index:0,storage_path:owner+'/intake/'+id+'/00-a.png',file_name:'a.png',sha256:'a'.repeat(64),byte_count:77},
  {index:1,storage_path:owner+'/intake/'+id+'/01-b.png',file_name:'b.png',sha256:'b'.repeat(64),byte_count:77}
 ],objects:[
  {working_title:first,object_type:'Vase',material:'Glass',image_indices:[0],identification_confidence:25},
  {working_title:second,object_type:'Bowl',material:'Glass',image_indices:[1],identification_confidence:38}
 ]};
 const saved=await client.from('ai_analysis_runs').insert({id,owner_id:owner,mode:'batch',model:'FIXTURE_NO_PROVIDER',status:'DRAFT',input_photo_count:2,user_context:{user_notes:'Separate objects in synthetic owner acceptance'},result}).select('id').single();
 expect(saved.error).toBeNull();
 const events=await login(page,'/#/inventory');
 await page.getByRole('textbox',{name:'Search inventory'}).fill(prefix);
 const card=page.locator('.ci-record-card').filter({hasText:second});
 if(!(await card.isVisible()))await page.locator('details.ci-archive-section>summary').click();
 await expect(card).toBeVisible();
 const link=card.getByRole('link',{name:/View report/});
 await expect(link).toHaveAttribute('href','#/draft/'+id+'?object=1');
 await link.click();
 await expect(page).toHaveURL(new RegExp('/#/draft/'+id+'[?]object=1$'));
 const selector=page.getByLabel('Choose object to research');
 await expect(selector).toHaveValue('1');
 await expect(page.getByRole('region',{name:'Research dashboard — '+second,exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Research dashboard — '+first,exact:true})).toHaveCount(0);
 await page.reload();
 await expect(selector).toHaveValue('1');
 // A corrupt index cannot accidentally bind another object's data.
 await page.goto('/#/draft/'+id+'?object=9999');
 await expect(selector).toHaveValue('0');
 await selector.selectOption('1');
 await expect(page).toHaveURL(new RegExp('/#/draft/'+id+'[?]object=1$'));
 expect(events.paid).toEqual([]);
});


test('unfinished photo upload opens owner saved-session recovery, never incomplete report review',async({page})=>{
 const id=randomUUID();
 const save=await client.from('ai_analysis_runs').insert({id,owner_id:owner,mode:'single',model:'FIXTURE_NO_PROVIDER',status:'DRAFT',
  input_photo_count:1,user_context:{user_notes:'Synthetic incomplete upload link test'},
  result:{analysis_stage:'UPLOADED',image_manifest:[{index:0,file_name:'original.png',storage_path:owner+'/intake/'+id+'/00-original.png',sha256:'c'.repeat(64),byte_count:77}]}
 }).select('id').single();
 expect(save.error).toBeNull();
 const events=await login(page,'/#/inventory');
 const link=page.locator('a[href="#/uploads/'+id+'"]');
 await expect(link).toHaveCount(1);
 await expect(link).toHaveText('View saved session →');
 await link.click();
 await expect(page).toHaveURL(new RegExp('/#/uploads/'+id+'$'));
 await expect(page.getByRole('heading',{name:'Saved photo session',exact:true})).toBeVisible();
 await expect(page.getByText('Awaiting saved analysis',{exact:true})).toBeVisible();
 expect(events.paid).toEqual([]);
});


test('listing handoff copies exact review-draft text without publishing or paid requests',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
   writeText:async(value)=>{window.__ciCopiedText=value}
  }});
 });
 const item=await seed(),events=await login(page,'/#/item/'+item.id+'?tab=sales');
 const sale=page.getByRole('region',{name:'Sell Fast plan and listing preparation',exact:true});
 await sale.getByRole('button',{name:'Prepare review draft',exact:true}).click();
 const review=sale.getByRole('region',{name:'Listing review draft',exact:true});
 const title=await review.getByLabel('Draft title',{exact:true}).inputValue();
 const description=await review.getByLabel('Draft description',{exact:true}).inputValue();
 await review.getByRole('button',{name:'Copy draft title',exact:true}).click();
 await expect(review.getByRole('status')).toContainText('Not published.');
 expect(await page.evaluate(()=>window.__ciCopiedText)).toEqual(title);
 await review.getByRole('button',{name:'Copy draft description',exact:true}).click();
 expect(await page.evaluate(()=>window.__ciCopiedText)).toEqual(description);
 await expect(review.getByRole('status')).toContainText('Research or selling checks remain.');
 const stored=await client.from('listings').select('id').eq('item_id',item.id);
 expect(stored.error).toBeNull();expect(stored.data).toEqual([]);
 expect(events.paid).toEqual([]);
});
