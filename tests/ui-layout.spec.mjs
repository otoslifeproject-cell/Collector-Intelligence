import {test,expect} from '@playwright/test'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {mkdirSync} from 'node:fs'

const fixture=pathToFileURL(resolve('tests/fixtures/appearance-layout.html')).href
const widths=[320,390,1100,1440]
const themes=['dark','light']
mkdirSync('test-artifacts',{recursive:true})

for(const width of widths){
 for(const theme of themes){
  test('Research panel '+width+'px '+theme+' mode does not overflow',async({page})=>{
   await page.setViewportSize({width,height:900})
   await page.goto(fixture)
   await page.evaluate(x=>{document.documentElement.dataset.theme=x},theme)
   const button=page.locator('#primary-action')
   await expect(button).toBeVisible()
   const geom=await page.evaluate(()=>{
    const panel=document.querySelector('.ci-workspace-action-panel')
    const btn=document.querySelector('#primary-action')
    if(!panel||!btn)throw new Error('Missing shared action layout')
    const p=panel.getBoundingClientRect(),b=btn.getBoundingClientRect()
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,
     pLeft:p.left,pRight:p.right,bLeft:b.left,bRight:b.right,bHeight:b.height,bWidth:b.width,
     display:getComputedStyle(panel).display,
     themeBg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()}
   })
   expect(geom.display).toBe('grid')
   expect(geom.scroll).toBeLessThanOrEqual(geom.width+1)
   expect(geom.pLeft).toBeGreaterThanOrEqual(-1)
   expect(geom.pRight).toBeLessThanOrEqual(geom.width+1)
   expect(geom.bLeft).toBeGreaterThanOrEqual(geom.pLeft)
   expect(geom.bRight).toBeLessThanOrEqual(geom.pRight)
   expect(geom.bWidth).toBeGreaterThanOrEqual(150)
   expect(geom.bHeight).toBeLessThanOrEqual(58)
   expect(geom.themeBg).toBe(theme==='light'?'#f5f7fa':'#111820')
   await page.screenshot({path:'test-artifacts/research-'+width+'-'+theme+'.png',fullPage:true})
  })
 }
}
test('appearance has visible affordance on both phone and desktop',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto(fixture)
 await expect(page.locator('.ci-appearance-mobile')).toBeVisible()
 await expect(page.locator('.sidebarBottom')).not.toBeVisible()
 await expect(page.locator('#ci-menu-toggle')).toBeVisible()
 await expect(page.locator('#ci-primary-navigation')).not.toBeVisible()
 await page.locator('#ci-menu-toggle').click()
 await expect(page.locator('#ci-menu-toggle')).toHaveAttribute('aria-expanded','true')
 await expect(page.locator('#ci-primary-navigation')).toBeVisible()
 await expect(page.locator('.sidebar nav .navItem').nth(1)).toBeInViewport()
 await expect(page.locator('.sidebar nav .ci-mobile-signout')).toBeVisible()
 await page.locator('#ci-menu-toggle').click()
 await expect(page.locator('#ci-primary-navigation')).not.toBeVisible()
 await page.setViewportSize({width:1440,height:900})
 await expect(page.locator('#ci-primary-navigation')).toBeVisible()
 await expect(page.locator('#ci-menu-toggle')).not.toBeVisible()
 await expect(page.locator('.sidebarBottom .ci-appearance-toggle')).toBeVisible()
})
test('focus visibility and detailed research disclosure',async({page})=>{
 await page.setViewportSize({width:1100,height:900})
 await page.goto(fixture)
 const details=page.locator('.ci-research-decision details')
 await expect(details.first()).not.toHaveAttribute('open')
 await details.first().locator('summary').click()
 await expect(details.first()).toHaveAttribute('open')
 await page.locator('#primary-action').focus()
 await page.keyboard.press('Tab')
 await page.keyboard.press('Shift+Tab')
 await expect(page.locator('#primary-action')).toBeFocused()
 const outline=await page.locator('#primary-action').evaluate(el=>getComputedStyle(el).outlineStyle)
 expect(outline).not.toBe('none')
})


test('dark and light have identical research component geometry with distinct, readable surfaces',async({page})=>{
 await page.setViewportSize({width:1100,height:900})
 await page.goto(fixture)
 const states=[]
 for(const mode of ['light','dark']){
  states.push(await page.evaluate((theme)=>{
   document.documentElement.dataset.theme=theme
   const el=(selector)=>document.querySelector(selector)
   const box=(selector)=>{
    const r=el(selector).getBoundingClientRect()
    return [r.x,r.y,r.width,r.height].map(n=>Math.round(n))
   }
   const color=(selector,prop='color')=>getComputedStyle(el(selector)).getPropertyValue(prop).trim()
   return {
    actionBox:box('.ci-workspace-action-panel'),
    buttonBox:box('#primary-action'),
    researchBox:box('.ci-research-decision'),
    firstCardBox:box('.ci-research-decision .researchMetricGrid>div'),
    titleBox:box('.ci-research-decision .panelHeader h2'),
    panelColor:color('.ci-research-decision','background-color'),
    cardColor:color('.ci-research-decision .researchMetricGrid>div','background-color'),
    cardText:color('.ci-research-decision .researchMetricGrid strong'),
    cardMuted:color('.ci-research-decision .researchMetricGrid span')
   }
  },mode))
 }
 for(const key of ['actionBox','buttonBox','researchBox','firstCardBox','titleBox']){
  expect(states[0][key],key+' must match across themes').toEqual(states[1][key])
 }
 for(const state of states){
  expect(state.cardColor,'cards must be visibly separated from the panel').not.toBe(state.panelColor)
 }
 const luminance=color=>{
  const rgb=color.match(/\d+/g).slice(0,3).map(v=>Number(v)/255)
  const c=rgb.map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4))
  return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722
 }
 const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(hi+0.05)/(lo+0.05)}
 for(const state of states){
  expect(contrast(state.cardText,state.cardColor),'primary text AA contrast').toBeGreaterThanOrEqual(4.5)
  expect(contrast(state.cardMuted,state.cardColor),'secondary text AA contrast').toBeGreaterThanOrEqual(4.5)
 }
})
