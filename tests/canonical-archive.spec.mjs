import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

mkdirSync('test-artifacts',{recursive:true});
async function visit(page,owner='a'){
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.abort('blockedbyclient');
    return route.continue();
  });
  await page.addInitScript(config=>{window.__CI_ARCHIVE_FIXTURE__=config;},{
    key:process.env.CI_ARCHIVE_PUBLIC_KEY,email:`collector-ci-${owner}@example.test`,password:'Ci-disposable-fixture-4826!',
  });
  await page.goto('/tests/fixtures/canonical-archive.html');
  await expect(page.locator('.ci-canonical-archive>summary')).toBeVisible();
}
async function openArchive(page){
  await page.locator('.ci-canonical-archive>summary').click();
  await expect(page.getByText('5 documents · 110 stored versions',{exact:true})).toBeVisible();
}
async function openGroup(page,key){
  const group=page.locator('.ci-archive-group').filter({has:page.locator('summary strong').filter({hasText:key})});
  await group.locator('summary').click();return group;
}
for(const width of [320,390,1100,1440])for(const theme of ['light','dark'])test(`genuine owner archive ${width}px ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const requests=[];page.on('request',request=>{if(request.url().includes('/rest/v1/canonical_documents'))requests.push(request.url());});
  await visit(page);await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  await expect(page.getByRole('heading',{name:'Source archive',exact:true})).not.toBeVisible();
  expect(requests.length).toBe(0);
  await openArchive(page);expect(requests.length).toBe(2);
  const group=await openGroup(page,'03_COMPARABLE_RESEARCH.md');await expect(group.getByText('105 stored versions')).toBeVisible();
  await expect(group.locator('tbody tr')).toHaveCount(105);
  await group.getByRole('button',{name:'Read 03_COMPARABLE_RESEARCH.md, version 4.0-aligned-draft-20261020',exact:true}).click();
  const document=page.getByRole('region',{name:'Stored source text'});
  await expect(document).toBeVisible();await expect(document).toBeFocused();
  await expect(document.getByRole('status')).toHaveText('SHA-256 matches stored text.');
  await expect(document.locator('pre')).toContainText('REVIEW CANDIDATE');
  await expect(document).toContainText('approval is not established here');
  await expect(document).toContainText('Imported');
  if(width<=620){
    const table=await group.locator('.tableWrap').evaluate(element=>({scroll:element.scrollWidth,width:element.clientWidth,left:element.scrollLeft}));
    expect(table.scroll).toBeLessThanOrEqual(table.width+1);expect(table.left).toBe(0);
    const version=await group.locator('tbody tr').first().locator('td').first().boundingBox();expect(version.x).toBeGreaterThanOrEqual(0);
  }
  const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);expect(errors).toEqual([]);
  await page.screenshot({path:`test-artifacts/archive-${width}-${theme}.png`,fullPage:true});
});
test('keyboard disclosure and close return focus to the chosen version',async({page})=>{
  await visit(page);await page.keyboard.press('Tab');await expect(page.locator('.ci-canonical-archive>summary')).toBeFocused();
  await page.keyboard.press('Enter');await expect(page.getByText('5 documents · 110 stored versions',{exact:true})).toBeVisible();
  const group=await openGroup(page,'02_MASTER_PROJECT_BRIEF.md'),button=group.getByRole('button',{name:'Read 02_MASTER_PROJECT_BRIEF.md, version 4.0',exact:true});
  await button.focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Stored source text'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Close document'})).toBeFocused();
  await page.keyboard.press('Enter');await expect(button).toBeFocused();
});
test('the second genuinely signed-in owner sees only their five versions',async({page})=>{
  await visit(page,'b');await page.locator('.ci-canonical-archive>summary').click();
  await expect(page.getByText('5 documents · 5 stored versions',{exact:true})).toBeVisible();
  const group=await openGroup(page,'03_COMPARABLE_RESEARCH.md');await expect(group.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('110 stored versions')).not.toBeVisible();
});
test('failed read shows no partial inventory and reload recovers against real services',async({page})=>{
  await visit(page);await page.route('**/rest/v1/canonical_documents?*',route=>route.fulfill({status:403,json:{message:'Test grant unavailable',code:'42501'}}));
  await page.locator('.ci-canonical-archive>summary').click();await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.locator('.ci-archive-group')).toHaveCount(0);
  await page.unroute('**/rest/v1/canonical_documents?*');await page.getByRole('button',{name:'Reload archive'}).click();
  await expect(page.getByText('5 documents · 110 stored versions',{exact:true})).toBeVisible();
});
test('placeholder remains readable without being presented as valid instructions',async({page})=>{
  await visit(page);await openArchive(page);const group=await openGroup(page,'06_PHOTO_EXAMINATION.md');
  await group.getByRole('button',{name:'Read 06_PHOTO_EXAMINATION.md, version placeholder-fixture',exact:true}).click();
  const document=page.getByRole('region',{name:'Stored source text'});
  await expect(document.getByRole('status')).toContainText('matches stored text');await expect(document.getByRole('alert')).toContainText('not usable as an instruction source');
  await expect(document.locator('pre')).toContainText('No readable content');
});
test('tampered HTTP body is visibly flagged; no database row is altered',async({page})=>{
  await visit(page);await openArchive(page);const group=await openGroup(page,'02_MASTER_PROJECT_BRIEF.md');
  await page.route('**/rest/v1/canonical_documents?*',async route=>{
    if(!new URL(route.request().url()).searchParams.get('select')?.split(',').includes('content'))return route.continue();
    const response=await route.fetch(),body=await response.json();body[0].content+='\nTampered test transport';
    return route.fulfill({response,json:body});
  });
  await group.getByRole('button',{name:'Read 02_MASTER_PROJECT_BRIEF.md, version 4.0',exact:true}).click();
  await expect(page.getByRole('region',{name:'Stored source text'}).getByRole('status')).toContainText('SHA-256 mismatch');
});
test('same-owner reauthentication preserves review; account switches and sign-out clear private state',async({page})=>{
  await visit(page);await openArchive(page);const group=await openGroup(page,'02_MASTER_PROJECT_BRIEF.md');
  await group.getByRole('button',{name:'Read 02_MASTER_PROJECT_BRIEF.md, version 4.0',exact:true}).click();
  await expect(page.getByRole('region',{name:'Stored source text'})).toBeVisible();
  const reauthenticate=async email=>page.evaluate(async email=>{
    const result=await window.__CI_ARCHIVE_CLIENT__.auth.signInWithPassword({email,password:'Ci-disposable-fixture-4826!'});
    if(result.error)throw Error('Disposable reauthentication failed');
  },email);
  await reauthenticate('collector-ci-a@example.test');
  await expect(page.getByRole('region',{name:'Stored source text'})).toBeVisible();
  await expect(page.getByText('5 documents · 110 stored versions',{exact:true})).toBeVisible();
  await reauthenticate('collector-ci-b@example.test');
  await expect(page.getByRole('region',{name:'Stored source text'})).toHaveCount(0);await expect(page.locator('.ci-archive-group')).toHaveCount(0);
  await page.getByRole('button',{name:'Reload archive'}).click();await expect(page.getByText('5 documents · 5 stored versions',{exact:true})).toBeVisible();
  const otherGroup=await openGroup(page,'02_MASTER_PROJECT_BRIEF.md');
  await otherGroup.getByRole('button',{name:'Read 02_MASTER_PROJECT_BRIEF.md, version 4.0',exact:true}).click();
  await expect(page.getByRole('region',{name:'Stored source text'})).toBeVisible();
  await page.evaluate(()=>window.__CI_ARCHIVE_CLIENT__.auth.signOut({scope:'local'}));
  await expect(page.getByRole('region',{name:'Stored source text'})).toHaveCount(0);await expect(page.locator('.ci-archive-group')).toHaveCount(0);
  await page.getByRole('button',{name:'Reload archive'}).click();await expect(page.getByRole('alert')).toContainText('Sign in again');
});
