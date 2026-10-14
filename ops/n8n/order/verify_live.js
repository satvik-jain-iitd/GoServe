// Read-only check of the live GS workflows: GET each one from n8n and compare it with build(): active flag, node name, type and parameters (Code source, URLs, credential ids), positions, links, layout.
// Run: node ops/n8n/order/verify_live.js  (reads N8N_API_KEY from the vault; writes nothing)
const fs=require('fs'),os=require('os'),path=require('path');
const { build } = require('./build');
const { NAMES, ORDER } = require('./deploy');
const { checkLayout } = require('../lib/layout_checks');
const key=fs.readFileSync(path.join(os.homedir(),'Desktop/Secrets/04_integrations.env'),'utf8').match(/^N8N_API_KEY=(\S+)/m)[1];
// The User-Agent is the same one deploy.js sends. A plain Node fetch also answered 200 on 15 Oct 2026, so it may not be needed; it stays so the two scripts behave alike
// if the host ever starts to refuse the default Node agent. Remove it from both together, and run this script to prove it.
const call=async p=>(await fetch('https://n8n.linkright.in/api/v1'+p,{headers:{'X-N8N-API-KEY':key,'User-Agent':'curl/8.7.1'}})).json();
(async()=>{
  const list=(await call('/workflows?limit=250')).data;
  const ids={}; for(const k of ORDER) ids[k]=list.find(w=>w.name===NAMES[k]).id;
  // Build with the same deploy-time values as deploy.js (token, database address, credential ids, chat id), so only real drift shows. They stay in memory and are never printed.
  const vault=(file,k)=>{const m=fs.readFileSync(path.join(os.homedir(),'Desktop/Secrets',file),'utf8').match(new RegExp('^'+k+'=(\\S+)','m'));return m?m[1]:null;};
  const creds=(await call('/credentials?limit=250')).data;
  const cred=(name)=>{const c=creds.find(x=>x.name===name);return {id:c.id,name};};
  const b=build({ids,token:vault('04_integrations.env','GOSERVE_DEMO_TOKEN'),supabaseUrl:vault('02_databases.env','SUPABASE_GOSERVE_DEV_URL'),credential:cred('GoServe Supabase dev'),openrouterCredential:cred('GoServe OpenRouter'),chatId:vault('04_integrations.env','GOSERVE_TELEGRAM_CHAT_ID')});
  for(const k of ORDER){
    const live=await call('/workflows/'+ids[k]);
    const mine=b[k];
    const pos=(w)=>JSON.stringify(w.nodes.map(n=>[n.name,n.position]).sort());
    const par=(w)=>JSON.stringify(w.nodes.map(n=>[n.name,n.type,n.parameters,n.credentials||null]).sort((a,b)=>a[0]<b[0]?-1:1));
    const conn=(w)=>JSON.stringify(Object.keys(w.connections).sort().map(a=>[a,w.connections[a].main.map(o=>o.map(x=>x.node))]));
    const layout=checkLayout(live,mine.sections);
    console.log(NAMES[k].padEnd(30),'active='+live.active,'nodes='+live.nodes.length,'parameters='+(par(live)===par(mine)?'same':'DIFF'),'positions='+(pos(live)===pos(mine)?'same':'DIFF'),'links='+(conn(live)===conn(mine)?'same':'DIFF'),'layout='+(layout.length?JSON.stringify(layout).slice(0,120):'clean'));
  }
})();
