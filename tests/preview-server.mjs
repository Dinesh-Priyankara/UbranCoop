// UI verification only. This server is never part of dist or Pages Functions.
// All records are fictional, held in memory and cleared when this process stops.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { calculateReceipt, calculateAccounts, today } from '../src/core.js';
const receipts=[],days=[], root=resolve('dist');
let signedIn=false;
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4174');
    if(url.pathname==='/api/portal'){
      let body='';for await(const part of req)body+=part;
      const {action,data={}}=JSON.parse(body);let result;
      if(action==='login'){signedIn=true;result={username:'preview.staff'}}
      else if(!signedIn){res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,code:'UNAUTHORIZED'}));return}
      else if(action==='logout'){signedIn=false;result=null}
      else if(action==='session')result={username:'preview.staff'};
      else if(action==='receipts.list')result=receipts.filter(r=>r.createdDate===data.date);
      else if(action==='accounts.get')result=days.find(d=>d.date===data.date)||null;
      else if(action==='receipts.create'){result={...calculateReceipt(data),createdDate:today(),receiptId:`UC-${today().replaceAll('-','')}-${String(receipts.length+1).padStart(3,'0')}`};receipts.push(result)}
      else if(action==='accounts.create'){if(days.some(d=>d.date===data.date)){res.writeHead(409,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,code:'LOCKED'}));return}result={...calculateAccounts(data),submitted:true};days.push(result)}
      else throw new Error('ACTION');
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({ok:true,data:result}));return;
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep))throw new Error('PATH');
    let content=await readFile(path);
    if(extname(path)==='.html')content=content.toString().replace('<body>','<body><aside style="background:#fff0cb;text-align:center;padding:8px;font:12px system-ui">LOCAL UI TEST · Fictional data · Nothing saved to Google Sheets</aside>');
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(content);
  }catch{res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,code:'ERROR'}))}
});
server.listen(4174,'127.0.0.1',()=>console.log('Fictional UI test: http://127.0.0.1:4174'));
