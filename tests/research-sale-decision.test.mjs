import assert from 'node:assert/strict'
import {auditResearch,recommendSaleRoutes} from '../src/lib/researchSaleDecision.ts'
const stages=['PHOTOGRAPH_EXAM','SIGNATURE_READING','MAKER_ARCHIVE','AUCTION_REALISED','MARKETPLACE_SOLD','CONDITION_REVIEW','SALES_ECONOMICS']
let count=0
function check(label,fn){fn();count++;console.log('PASS',label)}
const one=(type,status='DONE_EVIDENCED')=>({type,status,runId:'run-1',checkedAt:'2026-10-23',sourceRefs:['lot-1']})
const empty=auditResearch([])
check('unstarted is 0/7',()=>{assert.equal(empty.percent,0);assert.equal(empty.unresolved.length,7)})
check('invalid complete without run receipt does not count',()=>assert.equal(auditResearch([{type:'SIGNATURE_READING',status:'DONE_EVIDENCED',sourceRefs:['x'],checkedAt:'now'}]).complete,0))
check('complete without source never counts',()=>assert.equal(auditResearch([{type:'SIGNATURE_READING',status:'DONE_EVIDENCED',runId:'r',checkedAt:'now'}]).complete,0))
check('inconclusive not treated as verified',()=>assert.equal(auditResearch([one('SIGNATURE_READING','INCONCLUSIVE')]).complete,0))
check('evidenced run counts',()=>assert.equal(auditResearch([one('SIGNATURE_READING')]).complete,1))
check('duplicate research type does not count',()=>assert.equal(auditResearch([one('SIGNATURE_READING'),one('SIGNATURE_READING')]).complete,0))
const full=auditResearch(stages.map(x=>one(x)))
const route={venue:'eBay',mode:'BALANCED',grossLow:40,grossHigh:60,feeRate:0.15,fixedCosts:9,shippingRisk:'MEDIUM',daysToSaleLow:7,daysToSaleHigh:30,sourceRefs:['comp-1'],eligible:true}
check('all research evidenced',()=>{assert.equal(full.percent,100);assert.equal(full.unresolved.length,0)})
check('no comp, never pretend ready',()=>assert.equal(recommendSaleRoutes(empty,[route],false).status,'RESEARCH_FIRST'))
check('no eligible route, never pretend ready',()=>assert.equal(recommendSaleRoutes(full,[],true).status,'RESEARCH_FIRST'))
check('net low subtracts costs',()=>assert.equal(recommendSaleRoutes(full,[route],true).netLow,25))
check('net high subtracts costs',()=>assert.equal(recommendSaleRoutes(full,[route],true).netHigh,42))
check('sound comps and condition permit sell',()=>assert.equal(recommendSaleRoutes(full,[route],true).status,'SELL_NOW'))
check('signature caveat survives high completeness',()=>assert.match(recommendSaleRoutes(full,[route],false).warnings.join(' '),/does not confirm maker/))
check('missing condition prompts quick check',()=>assert.equal(recommendSaleRoutes(auditResearch(stages.filter(x=>x!=='CONDITION_REVIEW').map(x=>one(x))),[route],true).status,'ONE_QUICK_CHECK_THEN_SELL'))
check('asking only route not accepted without source',()=>assert.equal(recommendSaleRoutes(full,[{...route,sourceRefs:[]}],true).status,'RESEARCH_FIRST'))
check('NaN gross range must fail closed',()=>assert.equal(recommendSaleRoutes(full,[{...route,grossLow:NaN}],true).status,'RESEARCH_FIRST'))
check('Infinity fee must fail closed',()=>assert.equal(recommendSaleRoutes(full,[{...route,feeRate:Infinity}],true).status,'RESEARCH_FIRST'))
check('empty source token rejected',()=>assert.equal(recommendSaleRoutes(full,[{...route,sourceRefs:['  ']}],true).status,'RESEARCH_FIRST'))
check('empty venue rejected',()=>assert.equal(recommendSaleRoutes(full,[{...route,venue:' '}],true).status,'RESEARCH_FIRST'))
check('blank research source fails completed stage',()=>assert.equal(auditResearch([{...one('SIGNATURE_READING'),sourceRefs:['  ']}]).complete,0))
console.log(count+' research-sale checks passed')
