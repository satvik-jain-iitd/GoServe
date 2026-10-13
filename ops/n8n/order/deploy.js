// Deploys the four GS order workflows to n8n. Default is a DRY RUN: it only reads and prints the plan.
//   node ops/n8n/order/deploy.js            plan only (reads the workflow list and the credential list)
//   node ops/n8n/order/deploy.js --apply    create missing workflows (inactive), then PUT the real content
// It never activates, deletes or touches any other workflow. Deploy order: ERR 00, SUB 11, SUB 12, then MAIN 01 (rulebook 95.16).
// Secrets come from ~/Desktop/Secrets (N8N_API_KEY, GOSERVE_TELEGRAM_CHAT_ID, SUPABASE_GOSERVE_DEV_URL, GOSERVE_DEMO_TOKEN) and are never written to the repo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { build } = require('./build');

const BASE = 'https://n8n.linkright.in/api/v1';
const NAMES = { alert: 'GS ERR 00 Alert', sub11: 'GS SUB 11 Place order', sub12: 'GS SUB 12 Change status', main01: 'GS MAIN 01 Order API' };
const ORDER = ['alert', 'sub11', 'sub12', 'main01'];
const CREDENTIAL = 'GoServe Supabase dev';

// PUT /workflows/{id} accepts only these keys (rulebook 113).
const payload = (w) => ({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings });

function vault(file, key) {
  const m = fs.readFileSync(path.join(os.homedir(), 'Desktop/Secrets', file), 'utf8').match(new RegExp('^' + key + '=(\\S+)', 'm'));
  return m ? m[1] : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const apiKey = vault('04_integrations.env', 'N8N_API_KEY');
  const call = async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1' }, body: body && JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(method + ' ' + p + ' -> ' + res.status + ' ' + JSON.stringify(json).slice(0, 200));
    return json;
  };
  const wfs = (await call('GET', '/workflows?limit=250')).data;
  const creds = (await call('GET', '/credentials?limit=250')).data;
  const credential = creds.find((c) => c.name === CREDENTIAL);
  if (!credential) throw new Error('credential "' + CREDENTIAL + '" not found');
  const ids = {};
  for (const k of ORDER) {
    const found = wfs.filter((w) => w.name === NAMES[k]);
    if (found.length > 1) throw new Error('two workflows named "' + NAMES[k] + '": report to the owner, do not deploy');
    ids[k] = found[0] ? found[0].id : null;
  }
  console.log('Plan (' + (apply ? 'APPLY' : 'dry run') + '):');
  for (const k of ORDER) console.log('  ' + NAMES[k].padEnd(26) + (ids[k] ? 'update ' + ids[k] : 'create'));
  console.log('  credential "' + CREDENTIAL + '" ' + credential.id + '; nothing is activated.');
  if (!apply) return;

  let token = vault('04_integrations.env', 'GOSERVE_DEMO_TOKEN');
  if (!token) {   // saved to the vault at once (rule A6)
    token = crypto.randomBytes(24).toString('hex');
    fs.appendFileSync(path.join(os.homedir(), 'Desktop/Secrets/04_integrations.env'),
      '\n# GoServe demo token for the n8n gs-order webhook, ' + new Date().toISOString() + '. Low value by design (ADR-009); rotate each release.\nGOSERVE_DEMO_TOKEN=' + token + '\n');
  }
  for (const k of ORDER) {   // shells first, so every workflow knows the others' ids
    if (!ids[k]) ids[k] = (await call('POST', '/workflows', { name: NAMES[k], nodes: [{ id: 'shell', name: 'Shell', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} }], connections: {}, settings: { executionOrder: 'v1' } })).id;
  }
  const built = build({ ids, token, supabaseUrl: vault('02_databases.env', 'SUPABASE_GOSERVE_DEV_URL'), credential: { id: credential.id, name: CREDENTIAL }, chatId: vault('04_integrations.env', 'GOSERVE_TELEGRAM_CHAT_ID') });
  for (const k of ORDER) {
    await call('PUT', '/workflows/' + ids[k], payload(built[k]));
    const back = await call('GET', '/workflows/' + ids[k]);
    if (back.nodes.length !== built[k].nodes.length || back.active) throw new Error(NAMES[k] + ': read-back differs or workflow is active');
    console.log('  deployed ' + NAMES[k] + ' ' + ids[k] + ' (' + back.nodes.length + ' nodes, inactive)');
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { payload, NAMES, ORDER };
