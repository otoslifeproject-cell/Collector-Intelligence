import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueSaleLabel,provisionalCurrencyTotals} from '../src/lib/catalogueSaleState.ts';
test('legacy ready flags cannot establish final sale readiness',()=>assert.equal(catalogueSaleLabel({status:'READY_TO_SELL',sale_readiness:'SELL_NOW'}),'Final research decision required'));
test('different currencies remain separate and missing indications remain unknown',()=>{
 const r=provisionalCurrencyTotals([{status:'RESEARCH',currency:'EUR',quick_sale_value:100},{status:'RESEARCH',currency:'USD',quick_sale_value:100},{status:'RESEARCH',currency:null,quick_sale_value:500},{status:'RESEARCH',currency:'GBP',quick_sale_value:null}]);
 assert.equal(r.unknown,2);assert.match(r.text,/100.*100/);assert.ok(!r.text.includes('£200'));
});
