import test from 'node:test';
import assert from 'node:assert/strict';
import { rateFor, calculateReceipt, calculateAccounts, nightsBetween, today } from '../src/core.js';
const cases = [
  ['dog',1,1,3000],['dog',1,3,3000],['dog',1,4,2500],['dog',1,6,2500],['dog',1,7,2000],['dog',1,29,2000],['dog',1,30,1850],
  ['dog',2,3,2500],['dog',2,4,2000],['dog',3,29,2000],['dog',3,30,1850],
  ['cat',1,3,2000],['cat',1,4,1500],['cat',2,4,1850],['cat',2,5,1500],['cat',3,30,1500]
];
for (const [type,count,nights,expected] of cases) test(`${count} ${type}, ${nights} nights: rate ${expected}`, () => assert.equal(rateFor(type,count,nights),expected));
const booking = { customerName: 'Kasun', contactNumber: '', pets: [{type:'dog',name:'Milo'},{type:'cat',name:'Luna'},{type:'cat',name:'Bella'}], checkInDate:'2026-09-01',pickupDate:'2026-09-05' };
test('mixed booking rates independently, ignoring forged totals', () => { const r = calculateReceipt({...booking,finalTotal:1}); assert.equal(r.finalTotal,24800); assert.deepEqual(r.lines.map(x=>x.rate),[2500,1850]); });
test('additional receipt charges are validated and included in the final total', () => { const r=calculateReceipt({...booking,additionalCharges:[{name:'Transport',amount:'500.50'},{name:'Medication',amount:'250'}]});assert.equal(r.standardTotal,24800);assert.equal(r.additionalChargesTotal,750.5);assert.equal(r.finalTotal,25550.5);assert.throws(()=>calculateReceipt({...booking,additionalCharges:[{name:'',amount:'100'}]}));assert.throws(()=>calculateReceipt({...booking,additionalCharges:[{name:'Transport',amount:'0'}]})) });
test('calendar nights across month and leap year', () => { assert.equal(nightsBetween('2024-02-28','2024-03-01'),2); assert.equal(nightsBetween('2026-09-30','2026-10-01'),1); });
test('invalid, zero and reversed stay rejected', () => { for(const pair of [['2026-02-30','2026-03-04'],['2026-09-01','2026-09-01'],['2026-09-02','2026-09-01']]) assert.throws(()=>nightsBetween(...pair)); });
test('Colombo midnight is independent of local timezone', () => { assert.equal(today(new Date('2026-09-14T18:29:59Z')),'2026-09-14'); assert.equal(today(new Date('2026-09-14T18:30:00Z')),'2026-09-15'); });
test('account cash calculation is exact in cents', () => { const a=calculateAccounts({date:'2026-09-01',openingCash:'0.10',transactions:[{type:'IN',description:'Payment',amount:'0.20'},{type:'OUT',description:'Food',amount:'0.10'}]},'2026-09-15'); assert.equal(a.expectedCash,0.20); assert.equal(a.totalCashIn,0.20); assert.equal(a.totalCashOut,0.10); });
test('accounts allow negative balance, reject negative entries, fractional cents and future dates', () => {
  const base={date:'2026-09-01',openingCash:'0',transactions:[{type:'OUT',description:'Food',amount:'10'}]};
  assert.equal(calculateAccounts(base,'2026-09-15').expectedCash,-10);
  for(const amount of ['-1','NaN','Infinity','1.001','1e3','']) assert.throws(()=>calculateAccounts({...base,openingCash:amount},'2026-09-15'));
  assert.throws(()=>calculateAccounts({...base,date:'2026-09-16'},'2026-09-15'));
  assert.throws(()=>calculateAccounts({...base,transactions:[{type:'IN',description:'',amount:1}]},'2026-09-15'));
});
test('invalid pets and missing customer rejected', () => { assert.throws(()=>calculateReceipt({...booking,customerName:''})); assert.throws(()=>calculateReceipt({...booking,pets:[{type:'bird',name:'A'}]})); assert.throws(()=>calculateReceipt({...booking,pets:[]})); });
