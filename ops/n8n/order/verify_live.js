// Read-only check of the live GS workflows: GET each one from n8n and compare it with build(): active flag, node positions, links, layout.
// Run: node ops/n8n/order/verify_live.js  (reads N8N_API_KEY from the vault; writes nothing)
const fs=require('fs'),os=require('os'),path=require('path');
const { build } = require('./build');
const { NAMES, ORDER } = require('./deploy');
const { checkLayout } = require('../lib/layout_checks');
const key=fs.readFileSync(path.join(os.homedir(),'Desktop/Secrets/04_integrations.env'),'utf8').match(/^N8N_API_KEY=(\S+)/m)[1];
const call=async p=>(await fetch('https://n8n.linkright.in/api/v1'+p,{headers:{'X-N8N-API-KEY':key,'User-Agent':'curl/8.7.1'}})).json();
(async()=>{
  const list=(await call('/workflows?limit=250')).data;
  const ids={}; for(const k of ORDER) ids[k]=list.find(w=>w.name===NAMES[k]).id;
  const b=build({ids});
  for(const k of ORDER){
    const live=await call('/workflows/'+ids[k]);
    const mine=b[k];
    const pos=(w)=>JSON.stringify(w.nodes.map(n=>[n.name,n.position]).sort());
    const conn=(w)=>JSON.stringify(Object.keys(w.connections).sort().map(a=>[a,w.connections[a].main.map(o=>o.map(x=>x.node))]));
    const layout=checkLayout(live,mine.sections);
    console.log(NAMES[k].padEnd(30),'active='+live.active,'nodes='+live.nodes.length,'positions='+(pos(live)===pos(mine)?'same':'DIFF'),'links='+(conn(live)===conn(mine)?'same':'DIFF'),'layout='+(layout.length?JSON.stringify(layout).slice(0,120):'clean'));
  }
})();
