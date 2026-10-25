// Deploys the GS order workflows to n8n. Default is a DRY RUN: it only reads and prints the plan.
//   node ops/n8n/order/deploy.js            plan only (reads the workflow list and the credential list)
//   node ops/n8n/order/deploy.js --apply    create missing workflows (inactive), then PUT the real content
//   --env prod                              the PROD copy (nine workflows, `PROD` in the name, own webhook path, prod address, credential and token)
// It never activates, deletes or touches any other workflow. Deploy order: ERR 00, SUB 11 to 17 and 91, then MAIN 01 and MAIN 90 (rulebook 95.16).
// Secrets come from ~/Desktop/Secrets (N8N_API_KEY, GOSERVE_TELEGRAM_CHAT_ID, SUPABASE_GOSERVE_DEV_URL, GOSERVE_DEMO_TOKEN) and are never written to the repo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { build } = require('./build');

const BASE = 'https://n8n.linkright.in/api/v1';
const NAMES = { alert: 'GS ERR 00 Alert', sub11: 'GS SUB 11 Place order', sub12: 'GS SUB 12 Change status', sub13: 'GS SUB 13 Decide', sub14: 'GS SUB 14 Write logs', sub15: 'GS SUB 15 Add event', sub16: 'GS SUB 16 Health', sub17: 'GS SUB 17 Feedback', sub18: 'GS SUB 18 Feedback side effects', sub19: 'GS SUB 19 Assign rider', sub20: 'GS SUB 20 Push', sub21: 'GS SUB 21 Dispatch riders', sub22: 'GS SUB 22 Dispatch', sub30: 'GS SUB 30 Simulator write', sub32: 'GS SUB 32 Engine call', main30: 'GS MAIN 30 Simulator', main31: 'GS MAIN 31 Simulator tick', main32: 'GS MAIN 32 Decision engine', sub91: 'GS SUB 91 Scorecard numbers', sub93: 'GS SUB 93 Watch numbers', sub94: 'GS SUB 94 Health and cost numbers', main01: 'GS MAIN 01 Order API', main90: 'GS MAIN 90 Daily scorecard', main92: 'GS MAIN 92 Pilot watch', main93: 'GS MAIN 93 Weekly and monthly report' };
const ORDER = ['alert', 'sub11', 'sub12', 'sub13', 'sub14', 'sub15', 'sub16', 'sub18', 'sub17', 'sub19', 'sub20', 'sub21', 'sub22', 'sub30', 'sub32', 'sub91', 'sub93', 'sub94', 'main01', 'main30', 'main31', 'main32', 'main90', 'main92', 'main93'];
// Dev and prod share nothing except the alert workflow and the Jev credential.
const ENVS = {
  dev: { driveVar: 'GOSERVE_UAT_DRIVE_FOLDER_DEV', urlVar: 'SUPABASE_GOSERVE_DEV_URL', credential: 'GoServe Supabase dev', tokenVar: 'GOSERVE_DEMO_TOKEN', simTokenVar: 'GOSERVE_SIM_TOKEN', anonVar: 'SUPABASE_GOSERVE_DEV_ANON_KEY', suffix: '' },
  prod: { driveVar: 'GOSERVE_UAT_DRIVE_FOLDER_PROD', urlVar: 'SUPABASE_GOSERVE_PROD_URL', credential: 'GoServe Supabase prod', tokenVar: 'GOSERVE_PROD_DEMO_TOKEN', simTokenVar: 'GOSERVE_PROD_SIM_TOKEN', anonVar: 'SUPABASE_GOSERVE_PROD_ANON_KEY', suffix: ' PROD' },
};
const orderFor = (env) => (env === 'prod' ? ORDER.filter((k) => k !== 'alert') : ORDER);
const namesFor = (env) => Object.fromEntries(orderFor(env).map((k) => [k, NAMES[k] + ENVS[env || 'dev'].suffix]));
const JEV_CREDENTIAL = 'GoServe OpenRouter';
const VAPID_CREDENTIAL = 'GoServe VAPID';   // JWT Auth (ES256) holding the VAPID private key; created by the owner's yes, never by this script

// PUT /workflows/{id} accepts only these keys (rulebook 113).
const payload = (w) => ({ name: w.name, nodes: w.nodes, connections: w.connections, settings: w.settings });

function vault(file, key) {
  const m = fs.readFileSync(path.join(os.homedir(), 'Desktop/Secrets', file), 'utf8').match(new RegExp('^' + key + '=(\\S+)', 'm'));
  return m ? m[1] : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const env = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'dev';
  if (!ENVS[env]) throw new Error('unknown --env ' + env + ' (dev or prod)');
  const E = ENVS[env], ORD = orderFor(env), NM = namesFor(env);
  const apiKey = vault('04_integrations.env', 'N8N_API_KEY');
  const call = async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json', 'User-Agent': 'curl/8.7.1' }, body: body && JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(method + ' ' + p + ' -> ' + res.status + ' ' + JSON.stringify(json).slice(0, 200));
    return json;
  };
  const wfs = (await call('GET', '/workflows?limit=250')).data;
  const creds = (await call('GET', '/credentials?limit=250')).data;
  const credential = creds.find((c) => c.name === E.credential);
  if (!credential) throw new Error('credential "' + E.credential + '" not found');
  const vapidCredential = creds.find((c) => c.name === VAPID_CREDENTIAL);
  const jevCredential = creds.find((c) => c.name === JEV_CREDENTIAL);   // needs the owner's yes; the apply refuses without it
  const ids = {};
  const wasActive = {};
  for (const k of ORD) {
    const found = wfs.filter((w) => w.name === NM[k]);
    if (found.length > 1) throw new Error('two workflows named "' + NM[k] + '": report to the owner, do not deploy');
    ids[k] = found[0] ? found[0].id : null;
    wasActive[k] = !!(found[0] && found[0].active);
  }
  if (env === 'prod') {   // the one alert workflow is shared with dev
    const alert = wfs.find((w) => w.name === NAMES.alert);
    if (!alert) throw new Error('GS ERR 00 Alert not found: deploy dev first');
    ids.alert = alert.id;
  }
  console.log('Plan (' + env + ', ' + (apply ? 'APPLY' : 'dry run') + '):');
  for (const k of ORD) console.log('  ' + NM[k].padEnd(30) + (ids[k] ? 'update ' + ids[k] : 'create'));
  console.log('  credential "' + E.credential + '" ' + credential.id + '; "' + JEV_CREDENTIAL + '" ' + (jevCredential ? jevCredential.id : 'MISSING (apply will refuse)') + '; "' + VAPID_CREDENTIAL + '" ' + (vapidCredential ? vapidCredential.id : 'MISSING (apply will refuse)') + '; nothing is activated.');
  if (!apply) return;

  if (!vapidCredential) throw new Error('credential "' + VAPID_CREDENTIAL + '" not found: ask the owner for "yes vapid"');
  if (!jevCredential) throw new Error('credential "' + JEV_CREDENTIAL + '" not found: ask the owner for a yes to create it');
  let token = vault('04_integrations.env', E.tokenVar);
  if (!token) {   // saved to the vault at once (rule A6)
    token = crypto.randomBytes(24).toString('hex');
    fs.appendFileSync(path.join(os.homedir(), 'Desktop/Secrets/04_integrations.env'),
      '\n# GoServe ' + env + ' demo token for the n8n order webhook, ' + new Date().toISOString() + '. Low value by design (ADR-009); rotate each release.\n' + E.tokenVar + '=' + token + '\n');
  }
  let simToken = vault('04_integrations.env', E.simTokenVar);   // H5: the simulator's own token, never the demo token
  if (!simToken) {
    simToken = crypto.randomBytes(24).toString('hex');
    fs.appendFileSync(path.join(os.homedir(), 'Desktop/Secrets/04_integrations.env'),
      '\n# GoServe ' + env + ' simulator token for the n8n gs-sim webhook (story H5), ' + new Date().toISOString() + '. Admin only; rotate each release.\n' + E.simTokenVar + '=' + simToken + '\n');
  }
  for (const k of ORD) {   // shells first, so every workflow knows the others' ids
    if (!ids[k]) ids[k] = (await call('POST', '/workflows', { name: NM[k], nodes: [{ id: 'shell', name: 'Shell', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [0, 0], parameters: {} }], connections: {}, settings: { executionOrder: 'v1' } })).id;
  }
  const n8nApiCredential = creds.find((c) => c.name === 'GoServe n8n API');   // made by the owner; without it the n8n error line of the report says "could not read"
  if (!n8nApiCredential) console.log('  note: credential "GoServe n8n API" not found; the report will say "n8n errors: could not read"');
  const built = build({ ids, token, simToken, anonKey: vault('02_databases.env', E.anonVar), env, n8nApiCredential: n8nApiCredential && { id: n8nApiCredential.id, name: n8nApiCredential.name }, uptimerobotKey: vault('04_integrations.env', 'UPTIMEROBOT_API_KEY') || undefined, driveFolderId: vault('04_integrations.env', E.driveVar), supabaseUrl: vault('02_databases.env', E.urlVar), credential: { id: credential.id, name: E.credential }, vapidCredential: { id: vapidCredential.id, name: VAPID_CREDENTIAL }, vapidPublicKey: vault('04_integrations.env', 'GOSERVE_VAPID_PUBLIC_KEY'), vapidSubject: vault('04_integrations.env', 'GOSERVE_VAPID_SUBJECT'), openrouterCredential: { id: jevCredential.id, name: JEV_CREDENTIAL }, chatId: vault('04_integrations.env', 'GOSERVE_TELEGRAM_CHAT_ID') });
  for (const k of ORD) {
    await call('PUT', '/workflows/' + ids[k], payload(built[k]));
    const back = await call('GET', '/workflows/' + ids[k]);
    // Never activates: a workflow may only be active if it already was (the owner activated it).
    if (back.nodes.length !== built[k].nodes.length || (back.active && !wasActive[k])) throw new Error(NM[k] + ': read-back differs or the workflow became active by itself');
    console.log('  deployed ' + NM[k] + ' ' + ids[k] + ' (' + back.nodes.length + ' nodes, ' + (back.active ? 'active' : 'inactive') + ')');
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { payload, NAMES, ORDER, ENVS, namesFor, orderFor };
