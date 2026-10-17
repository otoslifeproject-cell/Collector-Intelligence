import {test,expect} from '@playwright/test'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {mkdirSync} from 'node:fs'

const fixture=pathToFileURL(resolve('tests/fixtures/appearance-layout.html')).href
const widths=[390,1100,1440]
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
   expect(geom.themeBg).toBe(theme==='light'?'#f5f7fa':'#0B0F14')
   await page.screenshot({path:'test-artifacts/research-'+width+'-'+theme+'.png',fullPage:true})
  })
 }
}
test('appearance has visible affordance on both phone and desktop',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await page.goto(fixture)
 await expect(page.locator('.ci-appearance-mobile')).toBeVisible()
 await expect(page.locator('.sidebarBottom')).not.toBeVisible()
 await expect(page.locator('.sidebar nav .navItem').nth(0)).toBeInViewport()
 await expect(page.locator('.sidebar nav .navItem').nth(1)).toBeInViewport()
 await page.setViewportSize({width:1440,height:900})
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
