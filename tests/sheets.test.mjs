import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
function fixture() {
  const tables = {}, calls = [];
  const sheet = name => ({getSheetId:()=>Object.keys(tables).indexOf(name),getLastRow:()=>tables[name].length,getRange:(r,c,n,m)=>({getValues:()=>tables[name].slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m))})});
  const ss={getSheetByName:sheet,getId:()=> 'sheet-id'};
  let locked=false;
  const context=vm.createContext({console,Date,Intl,JSON,Number,String,Array,Object,Math,Error,
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(alg,value)=>[...createHash(alg).update(value).digest()],computeHmacSha256Signature:(value,secret)=>[...createHmac('sha256',secret).update(value).digest()],formatDate:()=> '2026-09-15'},
    SpreadsheetApp:{openById:()=>ss},PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='SHARED_SECRET'?'x'.repeat(40):'sheet-id'})},
    LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true},hasLock:()=>locked,releaseLock:()=>{locked=false}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
    Sheets:{Spreadsheets:{batchUpdate:body=>{assert.equal(locked,true);calls.push(body); for(const r of body.requests){const name=Object.keys(tables)[r.appendCells.sheetId]; tables[name].push(...r.appendCells.rows.map(row=>row.values.map(v=>Object.values(v.userEnteredValue)[0])));}}}}
  });
  vm.runInContext(readFileSync('src/core.js','utf8').replace(/^export /gm,'')+'\n'+readFileSync('server/sheets.gs','utf8'),context);
  const headers=vm.runInContext('HEADERS',context);
  Object.entries(headers).forEach(([name,columns])=>tables[name]=[[...columns]]);
  function send(action,data,overrides={}) { const payload=JSON.stringify({action,data,createdBy:'staff-id',username:'staff',timestamp:Date.now(),...overrides});const signature=createHmac('sha256','x'.repeat(40)).update(payload).digest('hex');return JSON.parse(context.doPost({postData:{contents:JSON.stringify({payload,signature})}})); }
  return {send,tables,calls,context};
}
const receipt=()=>({customerName:'=IMPORTXML("evil")',pets:[{name:'Milo',type:'dog'}],checkInDate:'2026-09-01',pickupDate:'2026-09-05',requestId:crypto.randomUUID()});
test('receipt IDs increment and retry returns the same canonical record',()=>{const f=fixture(),r=receipt();const one=f.send('receipts.create',r),retry=f.send('receipts.create',r),two=f.send('receipts.create',receipt());assert.equal(one.ok,true);assert.equal(one.data.receiptId,'UC-20260915-001');assert.deepEqual(retry,one);assert.equal(two.data.receiptId,'UC-20260915-002');assert.equal(f.tables.Receipts.length,3)});
test('untrusted spreadsheet text stays string, never a formula',()=>{const f=fixture();f.send('receipts.create',receipt());const v=f.calls[0].requests[0].appendCells.rows[0].values[5];assert.ok(v.userEnteredValue.stringValue.startsWith('='));assert.equal(v.userEnteredValue.formulaValue,undefined)});
test('receipt history reconstructs saved rates without recalculation',()=>{const f=fixture();const saved=f.send('receipts.create',receipt());const list=f.send('receipts.list',{date:'2026-09-15'});assert.deepEqual(list.data,[saved.data])});
test('account day and transactions commit in one batch, lock prevents a second day',()=>{const f=fixture(),a={date:'2026-09-15',openingCash:'100',transactions:[{type:'IN',description:'Payment',amount:'50'},{type:'OUT',description:'Food',amount:'10'}],requestId:crypto.randomUUID()};const saved=f.send('accounts.create',a);assert.equal(saved.ok,true);assert.equal(saved.data.expectedCash,140);assert.equal(f.calls.length,1);assert.equal(f.calls[0].requests.length,2);const retry=f.send('accounts.create',a);assert.deepEqual(retry.data,saved.data);const duplicate=f.send('accounts.create',{...a,requestId:crypto.randomUUID()});assert.equal(duplicate.code,'LOCKED');assert.equal(f.tables['Account Days'].length,2);assert.equal(f.tables['Account Transactions'].length,3);assert.deepEqual(f.send('accounts.get',{date:a.date}).data,saved.data)});
test('idempotency key cannot be reused with a changed payload',()=>{const f=fixture(),r=receipt();f.send('receipts.create',r);assert.equal(f.send('receipts.create',{...r,customerName:'Different'}).ok,false);assert.equal(f.tables.Receipts.length,2)});
test('expired signed requests and unsigned requests cannot access Sheets',()=>{const f=fixture();assert.equal(f.send('receipts.list',{date:'2026-09-15'},{timestamp:Date.now()-300000}).ok,false);const result=JSON.parse(f.context.doPost({postData:{contents:JSON.stringify({payload:'{}',signature:'bad'})}}));assert.equal(result.ok,false);assert.equal(f.calls.length,0)});
