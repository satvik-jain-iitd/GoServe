// Builds the three order workflows (story #45) as n8n JSON. Positions and sticky notes come from lib/layout.js only (rulebook B12).
//   GS SUB 11 Place order, GS SUB 12 Change status, GS MAIN 01 Order API.
// build({ ids, token, supabaseUrl, credential }) -> { sub11, sub12, main01 }, each { name, nodes, connections, settings, sections }.
// Secrets: the demo token is passed in at deploy time and is never written to a file in the repo (default is a placeholder).
const fs = require('fs');
const path = require('path');
const { layout } = require('../lib/layout');

const code = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8').trim();
const STATUS_ROLES = ['customer', 'kitchen', 'rider', 'ops'];
const PLACEHOLDER = 'REPLACE_AT_DEPLOY';
const KITCHEN = '11111111-1111-1111-1111-111111111111';   // the seeded Delhi kitchen (migration 0002)

const node = (id, name, type, typeVersion, parameters, extra) => Object.assign({ id, name, type, typeVersion, parameters }, extra);
const codeNode = (id, name, jsCode) => node(id, name, 'n8n-nodes-base.code', 2, { mode: 'runOnceForAllItems', language: 'javaScript', jsCode });
const ifNode = (id, name, expr, op) => node(id, name, 'n8n-nodes-base.if', 2.2, {
  conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
    conditions: [{ id: id + '-c', leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: op, singleValue: true } }], combinator: 'and' },
  options: {} });
const schemaOf = (fields) => fields.map(([id, type]) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type, removed: false }));

function connect(edges) {   // edges: [from, to, outputIndex?]
  const c = {};
  for (const [a, b, out] of edges) {
    const i = out || 0;
    c[a] = c[a] || { main: [] };
    while (c[a].main.length <= i) c[a].main.push([]);
    c[a].main[i].push({ node: b, type: 'main', index: 0 });
  }
  return c;
}

const baseSettings = { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' };

// ---- SUB: Execute Workflow Trigger -> Guard -> Allowed? -> database call -> Shape result (or Return refusal) ----
function sub({ name, n, trigger, fields, guardFile, shapeFile, rpc, callerIds, what, credential, settings }) {
  const p = `gs-sub${n}`;
  const nodes = [
    node(`${p}-01`, 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, { inputSource: 'workflowInputs', workflowInputs: { values: fields.map(([name, type]) => ({ name, type })) } }),
    codeNode(`${p}-02`, 'Guard', code(guardFile)),
    ifNode(`${p}-03`, 'Allowed?', '={{ $json.ok }}', 'true'),
    rpc.userJwt   // the caller's own sign-in token goes on to the database; no stored credential (story #263)
      ? node(`${p}-04`, rpc.label, 'n8n-nodes-base.httpRequest', 4.2, {
        method: 'POST', url: '={{ $json.supabase_url }}/rest/v1/rpc/{{ $json.rpc_fn }}', authentication: 'none',
        sendHeaders: true, specifyHeaders: 'keypair', headerParameters: { parameters: [{ name: 'Authorization', value: '={{ $json.auth }}' }, { name: 'apikey', value: '={{ $json.anon_key }}' }] },
        sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.rpc_body }}',
        options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } })
      : node(`${p}-04`, rpc.label, 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: rpc.dynamic ? '={{ $json.supabase_url }}/rest/v1/rpc/{{ $json.rpc_fn }}' : `={{ $json.supabase_url }}/rest/v1/rpc/${rpc.fn}`,
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.rpc_body }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
      { credentials: { httpCustomAuth: credential } }),
    codeNode(`${p}-05`, 'Shape result', code(shapeFile || 'shape.js')),
    node(`${p}-06`, 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const edges = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', rpc.label, 0], ['Allowed?', 'Return refusal', 1], [rpc.label, 'Shape result']];
  const sections = [
    { name: 'RECEIVE', what: `The MAIN workflow calls this with the fields below. ${what}`, needs: 'Input: ' + fields.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse at once if the kill switch is on or a field is missing. Nothing is written here.', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'WRITE', what: `One database call (${rpc.fn}) does the check and the write together. The database decides, not this workflow.`, needs: rpc.userJwt ? 'No stored credential: the caller\'s own sign-in token is forwarded. Input: supabase_url, auth, anon_key.' : 'Credential "GoServe Supabase dev". Input: supabase_url.', nodes: [rpc.label], color: 6 },
    { name: 'ANSWER', what: 'Turn the database answer into a short result with a status code. Raw database text is never returned.', needs: 'The database answer.', nodes: ['Shape result'], color: 5 },
    { name: 'REFUSE', what: 'Hand the refusal back unchanged.', needs: 'The refusal from CHECK.', nodes: ['Return refusal'], color: 1 },
  ];
  return finish(name, nodes, edges, sections, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds }));
}

function finish(name, nodes, edges, sections, setts) {
  const laid = layout({ nodes, sections, edges: edges.map((e) => [e[0], e[1]]), loops: [] });   // the lib's 3rd edge field means "ai link", so the output index is dropped
  return { name, nodes: laid.nodes, connections: connect(edges), settings: setts, sections, edges };
}

// env 'prod' builds the PROD copy (story #78): a `PROD` name mark and its own webhook path. Everything else, including the canvas, is the same code.
function build({ ids, token, simToken, anonKey, supabaseUrl, credential, openrouterCredential, n8nApiCredential, uptimerobotKey, vapidCredential, vapidPublicKey, vapidSubject, chatId, driveFolderId, env }) {
  const prod = env === 'prod';
  const settings = ids.alert ? Object.assign({}, baseSettings, { errorWorkflow: ids.alert }) : baseSettings;
  const cred = credential || { id: 'REPLACE_CREDENTIAL_ID', name: 'GoServe Supabase dev' };
  const url = supabaseUrl || 'https://REPLACE_PROJECT.supabase.co';
  const main = ids.main01;
  const jevCred = openrouterCredential || { id: 'REPLACE_OPENROUTER_CRED_ID', name: 'GoServe OpenRouter' };

  const sub11 = sub({ name: 'GS SUB 11 Place order', n: 11, callerIds: main, credential: cred, settings,
    fields: [['session_id', 'string'], ['client_order_key', 'string'], ['items', 'array'], ['address', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_place.js', rpc: { fn: 'place_order', label: 'Place order' },
    what: 'It checks the dishes and prices and writes the order and its first event.' });
  const sub12 = sub({ name: 'GS SUB 12 Change status', n: 12, callerIds: main, credential: cred, settings,
    fields: [['session_id', 'string'], ['order_id', 'string'], ['to_status', 'string'], ['actor', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_status.js', rpc: { fn: 'change_status', label: 'Change status', dynamic: true },
    what: 'It moves the order one step and writes the event. For the customer\'s Yes it calls confirm_delivery instead.' });

  const rpcPost = (id, name, fn, extra) => node(id, name, 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: `={{ $json.supabase_url }}/rest/v1/${fn}`, authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.log_row }}',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } });
  const inputs = (fields) => ({ inputSource: 'workflowInputs', workflowInputs: { values: fields.map(([name, type]) => ({ name, type })) } });
  const refuseSection = { name: 'REFUSE', what: 'Hand the refusal back unchanged.', needs: 'The refusal from CHECK.', nodes: ['Return refusal'], color: 1 };
  const subSettings = Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: main });

  // ---- SUB 13 Decide: rule first, Jev second (advice only), one decision_log row ----
  const f13 = [['session_id', 'string'], ['kitchen_id', 'string'], ['order_id', 'string'], ['riders', 'array'], ['params_version', 'number'], ['jev_enabled', 'boolean'],
    ['jev_model', 'string'], ['jev_cost_cap', 'number'], ['kill_switch', 'boolean'], ['supabase_url', 'string']];
  const n13 = [
    node('gs-sub13-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f13)),
    codeNode('gs-sub13-02', 'Guard', code('decide_guard.js')),
    ifNode('gs-sub13-03', 'Allowed?', '={{ $json.ok }}', 'true'),
    // Story #263: the engine is read on every call. Unreadable or unknown means Rules; this read never stops an order.
    node('gs-sub13-10', 'Read engine', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET',
      url: "={{ $json.supabase_url }}/rest/v1/params?select=value,version&session_id=eq.global&key=eq.decision_engine&order=version.desc&limit=1",
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 3000 } },
      { credentials: { httpCustomAuth: cred }, onError: 'continueRegularOutput' }),
    codeNode('gs-sub13-11', 'Pick engine', code('decide_engine.js')),
    ifNode('gs-sub13-04', 'Ask Jev?', '={{ $json.use_jev }}', 'true'),
    // Jev is advice. If it fails, the rule decision still goes through, so this one node continues on error. It is not a write path.
    node('gs-sub13-05', 'Ask Jev', 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: 'https://openrouter.ai/api/alpha/decisions',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.jev_body }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 1500 } },
      { credentials: { httpHeaderAuth: jevCred }, onError: 'continueRegularOutput' }),
    codeNode('gs-sub13-06', 'Decide', code('decide_result.js')),
    rpcPost('gs-sub13-07', 'Write decision', 'decision_log'),
    codeNode('gs-sub13-08', 'Decision stored', code('decide_done.js')),
    node('gs-sub13-09', 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const e13 = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', 'Read engine', 0], ['Allowed?', 'Return refusal', 1], ['Read engine', 'Pick engine'], ['Pick engine', 'Ask Jev?'], ['Ask Jev?', 'Ask Jev', 0], ['Ask Jev?', 'Decide', 1],
    ['Ask Jev', 'Decide'], ['Decide', 'Write decision'], ['Write decision', 'Decision stored']];
  const s13 = [
    { name: 'RECEIVE', what: 'The MAIN workflow calls this with a ready order and the riders.', needs: 'Input: ' + f13.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse if the kill switch is on or input is bad. Work out the rule pick and build the Jev question (no names or addresses).', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'ENGINE', what: 'Read which engine the admin picked (Rules, Jev or Laya). Rules means no Jev call at all. Laya is not deployed, so the rule decides. If the read fails, Rules.', needs: 'Credential "GoServe Supabase dev". Table: params (decision_engine).', nodes: ['Read engine', 'Pick engine'], color: 6 },
    { name: 'JEV', what: 'Ask Jev for a suggestion within 1500 ms, only when the engine is Jev. If Jev fails, go on without it.', needs: 'Credential "GoServe OpenRouter". Config: jev_enabled, jev_model.', nodes: ['Ask Jev?', 'Ask Jev'], color: 3 },
    { name: 'DECIDE', what: 'The rule decides. Jev is kept in the record with its confidence, or the reason it was not used.', needs: 'Guard and Jev results. Config: jev_cost_cap.', nodes: ['Decide'], color: 5 },
    { name: 'WRITE', what: 'Write one decision_log row with the rule pick, the Jev pick and the pick used.', needs: 'Credential "GoServe Supabase dev". Table: decision_log.', nodes: ['Write decision'], color: 6 },
    { name: 'ANSWER', what: 'Return the decision if the row was stored, else a short error.', needs: 'The database answer.', nodes: ['Decision stored'], color: 5 },
    refuseSection,
  ];
  const sub13 = finish('GS SUB 13 Decide', n13, e13, s13, Object.assign({}, subSettings, { callerIds: main + ',' + ids.sub22 }));   // MAIN 01 (the demo decide) and SUB 22 (dispatch)

  // ---- SUB 14 Write logs: one run_log row ----
  const f14 = [['session_id', 'string'], ['kitchen_id', 'string'], ['workflow', 'string'], ['params_version', 'number'], ['duration_ms', 'number'], ['cost', 'number'], ['error', 'string'], ['supabase_url', 'string']];
  const n14 = [
    node('gs-sub14-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f14)),
    codeNode('gs-sub14-02', 'Guard', code('guard_log.js')),
    ifNode('gs-sub14-03', 'Allowed?', '={{ $json.ok }}', 'true'),
    rpcPost('gs-sub14-04', 'Write run log', 'run_log'),
    codeNode('gs-sub14-05', 'Log written', code('log_done.js')),
    node('gs-sub14-06', 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const e14 = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', 'Write run log', 0], ['Allowed?', 'Return refusal', 1], ['Write run log', 'Log written']];
  const s14 = [
    { name: 'RECEIVE', what: 'The MAIN workflow calls this after it has answered, with one run.', needs: 'Input: ' + f14.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Check the fields and build the run_log row. The kill switch does not block a log write.', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'WRITE', what: 'Write one run_log row: workflow, time taken, settings version, cost, error.', needs: 'Credential "GoServe Supabase dev". Table: run_log.', nodes: ['Write run log'], color: 6 },
    { name: 'ANSWER', what: 'Say if the row was stored.', needs: 'The database answer.', nodes: ['Log written'], color: 5 },
    refuseSection,
  ];
  const sub14 = finish('GS SUB 14 Write logs', n14, e14, s14, subSettings);

  const sub15 = sub({ name: 'GS SUB 15 Add event', n: 15, callerIds: main, credential: cred, settings,
    fields: [['session_id', 'string'], ['order_id', 'string'], ['event', 'string'], ['actor', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_event.js', rpc: { fn: 'rider_event', label: 'Add event' },
    what: 'It writes the rider\'s arriving event. The status does not change.' });

  // ---- SUB 16 Health: one tiny Jev call (story #54). Writes nothing. ----
  const f16 = [['jev_enabled', 'boolean'], ['jev_model', 'string']];
  const n16 = [
    node('gs-sub16-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f16)),
    codeNode('gs-sub16-02', 'Prepare', code('health_prepare.js')),
    ifNode('gs-sub16-03', 'Ask Jev?', '={{ $json.use_jev }}', 'true'),
    // Jev is the thing being checked, so a failure is a result and not an error: this one node continues on error. It writes nothing.
    node('gs-sub16-04', 'Ask Jev', 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: 'https://openrouter.ai/api/alpha/decisions',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.jev_body }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 3000 } },
      { credentials: { httpHeaderAuth: jevCred }, onError: 'continueRegularOutput' }),
    codeNode('gs-sub16-05', 'Health result', code('health_result.js')),
  ];
  const e16 = [['Start', 'Prepare'], ['Prepare', 'Ask Jev?'], ['Ask Jev?', 'Ask Jev', 0], ['Ask Jev?', 'Health result', 1], ['Ask Jev', 'Health result']];
  const s16 = [
    { name: 'RECEIVE', what: 'The MAIN workflow calls this when the health page asks.', needs: 'Input: ' + f16.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'PREPARE', what: 'Make one tiny question for Jev. Nothing from an order goes in it.', needs: 'Input fields. No credential.', nodes: ['Prepare', 'Ask Jev?'], color: 5 },
    { name: 'JEV', what: 'Ask Jev within 3 seconds. If Jev fails, go on and report it.', needs: 'Credential "GoServe OpenRouter". Config: jev_enabled, jev_model.', nodes: ['Ask Jev'], color: 3 },
    { name: 'RESULT', what: 'Say if Jev answered and how long it took. This workflow writes nothing.', needs: 'The Jev answer.', nodes: ['Health result'], color: 5 },
  ];
  const sub16 = finish('GS SUB 16 Health', n16, e16, s16, subSettings);


  const callSub = (id, name, subId, mapping, wait = true) => node(id, name, 'n8n-nodes-base.executeWorkflow', 1.2, {
    source: 'database', workflowId: { __rl: true, value: subId, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: Object.fromEntries(mapping.map(([k, v]) => [k, v])), matchingColumns: [],
      schema: schemaOf(mapping.map(([k, , t]) => [k, t])), attemptToConvertTypes: false, convertFieldsToString: false },
    mode: 'once', options: { waitForSubWorkflow: wait } });

  // ---- Dispatch (story A5): a ready order gets a rider. SUB 21 reads who is online, SUB 13 decides, SUB 19 saves the rider on the order, SUB 22 runs the three in order. ----
  const sub21 = sub({ name: 'GS SUB 21 Dispatch riders', n: 21, callerIds: ids.sub22, credential: cred, settings,
    fields: [['order_id', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_riders.js', rpc: { fn: 'dispatch_candidates', label: 'Read riders' },
    what: 'It reads the riders that are online, with their distance to the kitchen and their trips today. It writes nothing.' });
  const sub19 = sub({ name: 'GS SUB 19 Assign rider', n: 19, callerIds: ids.sub22, credential: cred, settings,
    fields: [['order_id', 'string'], ['rider_id', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_assign.js', rpc: { fn: 'assign_rider', label: 'Assign rider' },
    what: 'It saves the rider on a ready order and writes the event. A second call for the same rider changes nothing.' });
  const f22 = [['session_id', 'string'], ['kitchen_id', 'string'], ['order_id', 'string'], ['params_version', 'number'], ['jev_enabled', 'boolean'], ['jev_model', 'string'],
    ['jev_cost_cap', 'number'], ['kill_switch', 'boolean'], ['supabase_url', 'string']];
  const n22 = [
    node('gs-sub22-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f22)),
    callSub('gs-sub22-02', 'Call SUB 21 Riders', ids.sub21, [['order_id', "={{ $json.order_id }}", 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    ifNode('gs-sub22-03', 'Riders found?', '={{ $json.ok && $json.riders.length > 0 }}', 'true'),
    codeNode('gs-sub22-04', 'Prepare decision', code('dispatch_prepare.js')),
    callSub('gs-sub22-05', 'Call SUB 13 Decide', ids.sub13, f13.map(([k, t]) => [k, '={{ $json.' + k + ' }}', t])),
    codeNode('gs-sub22-06', 'Prepare assign', code('dispatch_assign.js')),
    ifNode('gs-sub22-07', 'Rider chosen?', '={{ $json.ok }}', 'true'),
    callSub('gs-sub22-08', 'Call SUB 19 Assign', ids.sub19, [['order_id', '={{ $json.order_id }}', 'string'], ['rider_id', '={{ $json.rider_id }}', 'string'],
      ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    // The error stops this run, and the error workflow (GS ERR 00) tells the owner: a ready order has no rider.
    node('gs-sub22-09', 'No rider', 'n8n-nodes-base.stopAndError', 1, { errorMessage: "={{ 'No rider could be assigned to ready order ' + $('Start').first().json.order_id }}" }),
  ];
  const e22 = [['Start', 'Call SUB 21 Riders'], ['Call SUB 21 Riders', 'Riders found?'], ['Riders found?', 'Prepare decision', 0], ['Riders found?', 'No rider', 1],
    ['Prepare decision', 'Call SUB 13 Decide'], ['Call SUB 13 Decide', 'Prepare assign'], ['Prepare assign', 'Rider chosen?'], ['Rider chosen?', 'Call SUB 19 Assign', 0], ['Rider chosen?', 'No rider', 1]];
  const s22 = [
    { name: 'RECEIVE', what: 'MAIN 01 calls this after the kitchen taps Ready. It is called after the answer went to the phone.', needs: 'Input: ' + f22.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'RIDERS', what: 'Ask SUB 21 which riders are online. If there are none, stop with an error.', needs: 'SUB 21 id. Input: order_id.', nodes: ['Call SUB 21 Riders', 'Riders found?'], color: 6 },
    { name: 'DECIDE', what: 'SUB 13 picks by rule (online, nearest, fewest trips). Jev only advises. One decision row is written.', needs: 'SUB 13 id. Config values come from MAIN 01.', nodes: ['Prepare decision', 'Call SUB 13 Decide'], color: 6 },
    { name: 'ASSIGN', what: 'Save the picked rider on the order through SUB 19. No pick means stop with an error.', needs: 'SUB 19 id.', nodes: ['Prepare assign', 'Rider chosen?', 'Call SUB 19 Assign'], color: 6 },
    { name: 'STOP', what: 'No rider could be assigned. The run fails on purpose so GS ERR 00 tells the owner; the order stays ready.', needs: 'GS ERR 00 as the error workflow.', nodes: ['No rider'], color: 1 },
  ];
  const sub22 = finish('GS SUB 22 Dispatch', n22, e22, s22, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: main }));

  // ---- SUB 20 Push (story A7): a text-less web push to every subscription of the customer. The phone's service worker asks the database what to say. ----
  const vapidCred = vapidCredential || { id: 'REPLACE_VAPID_CRED_ID', name: 'GoServe VAPID' };
  const f20 = [['session_id', 'string'], ['status', 'string'], ['vapid_public_key', 'string'], ['vapid_subject', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']];
  const rpcCall = (id, name, fn) => node(id, name, 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: `={{ $json.supabase_url }}/rest/v1/rpc/${fn}`, authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.rpc_body }}',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } });
  const n20 = [
    node('gs-sub20-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f20)),
    codeNode('gs-sub20-02', 'Guard', code('guard_push.js')),
    ifNode('gs-sub20-03', 'Allowed?', '={{ $json.ok }}', 'true'),
    rpcCall('gs-sub20-04', 'Read targets', 'push_targets'),
    ifNode('gs-sub20-05', 'Targets?', '={{ $json.statusCode === 200 && $json.body.targets.length > 0 }}', 'true'),
    codeNode('gs-sub20-06', 'Expand', code('push_expand.js')),
    // The private key lives only in the n8n credential "GoServe VAPID" (JWT Auth, ES256). The node keeps only the token, so later nodes pair back to "Expand".
    node('gs-sub20-07', 'Sign VAPID', 'n8n-nodes-base.jwt', 1, { operation: 'sign', useJson: true, claimsJson: '={{ JSON.stringify($json.claims) }}', options: {} },
      { credentials: { jwtAuth: vapidCred } }),
    node('gs-sub20-08', 'Send push', 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: "={{ $('Expand').item.json.endpoint }}", sendHeaders: true,
      headerParameters: { parameters: [
        { name: 'Authorization', value: "=vapid t={{ $json.token }}, k={{ $('Expand').item.json.vapid_public_key }}" },
        { name: 'TTL', value: '3600' }, { name: 'Urgency', value: 'high' }, { name: 'Content-Length', value: '0' }] },
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 8000 } }),
    codeNode('gs-sub20-09', 'Clean', code('push_clean.js')),
    rpcCall('gs-sub20-10', 'Forget', 'push_forget'),
    node('gs-sub20-11', 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const e20 = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', 'Read targets', 0], ['Allowed?', 'Return refusal', 1], ['Read targets', 'Targets?'], ['Targets?', 'Expand', 0],
    ['Expand', 'Sign VAPID'], ['Sign VAPID', 'Send push'], ['Send push', 'Clean'], ['Clean', 'Forget']];
  const s20 = [
    { name: 'RECEIVE', what: 'MAIN 01 calls this after it has answered, for a new order, a ready order or a delivered order. It is not waited for.', needs: 'Input: ' + f20.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse if the kill switch is on or input is bad. Any status other than placed, ready or delivered has nothing to send.', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'TARGETS', what: 'Read the push subscriptions of this customer. No subscription means stop quietly.', needs: 'Credential "GoServe Supabase dev". Function push_targets.', nodes: ['Read targets', 'Targets?'], color: 6 },
    { name: 'SEND', what: 'For each subscription sign a VAPID token and send an empty push. The phone asks the database what to show.', needs: 'Credential "GoServe VAPID" (JWT Auth, ES256). Config: the public key and the contact address.', nodes: ['Expand', 'Sign VAPID', 'Send push'], color: 6 },
    { name: 'CLEAN', what: 'A 404 or 410 means the phone unsubscribed. Forget that subscription.', needs: 'Credential "GoServe Supabase dev". Function push_forget.', nodes: ['Clean', 'Forget'], color: 6 },
    refuseSection,
  ];
  const sub20 = finish('GS SUB 20 Push', n20, e20, s20, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: main }));

  // ---- SUB 17 Feedback: save a tester's report and answer; Drive and Telegram run in SUB 18 without being waited for (story S-B, #94; F90) ----
  const f17 = [['session_id', 'string'], ['kitchen_id', 'string'], ['role', 'string'], ['screen', 'string'], ['order_id', 'string'], ['doing', 'string'], ['text', 'string'], ['context', 'object'],
    ['image_b64', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string'], ['drive_folder_id', 'string'], ['chat_id', 'string'], ['env', 'string']];
  const side = { onError: 'continueRegularOutput' };   // a side effect never undoes the saved report
  const f18 = [['id', 'string'], ['row', 'object'], ['image_b64', 'string'], ['has_image', 'boolean'], ['drive_ready', 'boolean'], ['drive_folder_id', 'string'], ['chat_id', 'string'], ['env', 'string'], ['supabase_url', 'string']];
  const n17 = [
    node('gs-sub17-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f17)),
    codeNode('gs-sub17-02', 'Guard', code('guard_feedback.js')),
    ifNode('gs-sub17-03', 'Allowed?', '={{ $json.ok }}', 'true'),
    node('gs-sub17-04', 'Save report', 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: '={{ $json.supabase_url }}/rest/v1/feedback', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=representation' }] },
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.row }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } }),
    codeNode('gs-sub17-05', 'Check saved', code('feedback_saved.js')),
    ifNode('gs-sub17-06', 'Saved?', '={{ $json.ok }}', 'true'),
    Object.assign(callSub('gs-sub17-07', 'Start side effects', ids.sub18, f18.map(([k, t]) => [k, k === 'id' ? '={{ $json.id }}' : '={{ $json.' + k + ' }}', t]), false), side),
    codeNode('gs-sub17-08', 'Answer', code('feedback_answer.js')),
    node('gs-sub17-09', 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const e17 = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', 'Save report', 0], ['Allowed?', 'Return refusal', 1], ['Save report', 'Check saved'], ['Check saved', 'Saved?'],
    ['Saved?', 'Start side effects', 0], ['Saved?', 'Return refusal', 1], ['Start side effects', 'Answer']];
  const s17 = [
    { name: 'RECEIVE', what: 'The MAIN workflow calls this with a tester\'s report.', needs: 'Input: ' + f17.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse if the kill switch is on or the report is not valid. Nothing is written here.', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'SAVE', what: 'Write one feedback row. If the database refuses, stop with 502: no Drive file and no message are made.', needs: 'Credential "GoServe Supabase dev". Table: feedback.', nodes: ['Save report', 'Check saved', 'Saved?'], color: 6 },
    { name: 'SIDE EFFECTS', what: 'Start SUB 18 (Drive and Telegram) and do not wait for it. If it cannot start, go on.', needs: 'SUB 18 id. The saved row and the picture.', nodes: ['Start side effects'], color: 6 },
    { name: 'ANSWER', what: 'Tell the phone it is saved (201 and the new id).', needs: 'The saved row.', nodes: ['Answer'], color: 5 },
    refuseSection,
  ];
  const sub17 = finish('GS SUB 17 Feedback', n17, e17, s17, subSettings);

  // ---- SUB 18 Feedback side effects: the screenshot to Google Drive and one Telegram message (story S-B; answered after the row, F90) ----
  const n18 = [
    node('gs-sub18-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f18)),
    ifNode('gs-sub18-02', 'Has picture?', '={{ $json.has_image && $json.drive_ready }}', 'true'),
    codeNode('gs-sub18-03', 'Make file', code('feedback_file.js')),
    node('gs-sub18-04', 'Upload to Drive', 'n8n-nodes-base.googleDrive', 3, { resource: 'file', operation: 'upload', inputDataFieldName: 'data', name: '={{ $json.file_name }}',
      driveId: { __rl: true, mode: 'list', value: 'My Drive' }, folderId: { __rl: true, mode: 'id', value: '={{ $json.drive_folder_id }}' }, options: {} },
      Object.assign({ credentials: { googleDriveOAuth2Api: { id: '6KXFSSShw2vwLVK5', name: 'Klickbae8yt@gmail.com' } } }, side)),
    node('gs-sub18-05', 'Link file', 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'PATCH', url: "={{ $('Start').first().json.supabase_url }}/rest/v1/feedback?id=eq.{{ $('Start').first().json.id }}",
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] },
      sendBody: true, specifyBody: 'json', jsonBody: '={{ { drive_file_id: $json.id || null } }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
      Object.assign({ credentials: { httpCustomAuth: cred } }, side)),
    codeNode('gs-sub18-06', 'Build message', code('feedback_message.js')),
    node('gs-sub18-07', 'Notify owner', 'n8n-nodes-base.telegram', 1.2, { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.text }}',
      additionalFields: { parse_mode: 'HTML', appendAttribution: false } }, Object.assign({ credentials: { telegramApi: { id: 'bBVpWzhaY0MCpoQ5', name: 'GoServeBot' } } }, side)),
  ];
  const e18 = [['Start', 'Has picture?'], ['Has picture?', 'Make file', 0], ['Has picture?', 'Build message', 1], ['Make file', 'Upload to Drive'], ['Upload to Drive', 'Link file'],
    ['Link file', 'Build message'], ['Build message', 'Notify owner']];
  const s18 = [
    { name: 'RECEIVE', what: 'SUB 17 calls this after the report is saved, and does not wait.', needs: 'Input: ' + f18.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'PICTURE', what: 'If there is a screenshot, put it in the Google Drive folder and link the file to the row. If Drive fails, go on.', needs: 'Credential "Klickbae8yt@gmail.com". Input: drive_folder_id.', nodes: ['Has picture?', 'Make file', 'Upload to Drive', 'Link file'], color: 6 },
    { name: 'TELL', what: 'Send the owner one Telegram message with the first lines and the Drive link. If Telegram fails, go on.', needs: 'Credential "GoServeBot". Input: chat_id.', nodes: ['Build message', 'Notify owner'], color: 6 },
  ];
  const sub18 = finish('GS SUB 18 Feedback side effects', n18, e18, s18, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: ids.sub17 }));

  const body = (f) => `={{ $json.body.${f} }}`;
  const respond = (id, name, code_, text) => node(id, name, 'n8n-nodes-base.respondToWebhook', 1.1, { respondWith: 'json', responseBody: text, options: { responseCode: code_ } });
  const answer = '={{ JSON.stringify({ ok: $json.ok, error: $json.error, message: $json.message, created: $json.created, order: $json.order, decision: $json.decision, jev: $json.jev, id: $json.id, already_done: $json.already_done, confirm_after_ready_min: $(\'Config\').first().json.confirm_after_ready_min, confirm_after_place_min: $(\'Config\').first().json.confirm_after_place_min }) }}';

  const nodes = [
    node('gs-main01-01', 'Order webhook', 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path: prod ? 'gs-order-prod' : 'gs-order', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, { webhookId: prod ? '9a3e6c14-7b52-4d8f-a1c9-2e5b8d0f4a63' : '6f1d7a52-2c43-4d0b-9b6e-5a1f0c9e7d11' }),
    node('gs-main01-02', 'Config', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [
      { id: 'cfg-1', name: 'kill_switch', type: 'boolean', value: false },
      { id: 'cfg-2', name: 'demo_token', type: 'string', value: token || PLACEHOLDER },
      { id: 'cfg-3', name: 'supabase_url', type: 'string', value: url },
      { id: 'cfg-4', name: 'params_version', type: 'number', value: 1 },
      { id: 'cfg-5', name: 'kitchen_id', type: 'string', value: KITCHEN },
      { id: 'cfg-6', name: 'jev_enabled', type: 'boolean', value: true },
      { id: 'cfg-7', name: 'jev_model', type: 'string', value: 'typesafe/jev-1.13' },
      { id: 'cfg-8', name: 'jev_cost_cap', type: 'number', value: 0.001 },
      { id: 'cfg-9', name: 'drive_folder_id', type: 'string', value: driveFolderId || PLACEHOLDER },
      { id: 'cfg-10', name: 'chat_id', type: 'string', value: chatId || PLACEHOLDER },
      { id: 'cfg-11', name: 'env', type: 'string', value: prod ? 'prod' : 'dev' },
      { id: 'cfg-12', name: 'confirm_after_ready_min', type: 'number', value: 3 },
      { id: 'cfg-13', name: 'confirm_after_place_min', type: 'number', value: 8 },
      { id: 'cfg-14', name: 'vapid_public_key', type: 'string', value: vapidPublicKey || PLACEHOLDER },
      { id: 'cfg-15', name: 'vapid_subject', type: 'string', value: vapidSubject || PLACEHOLDER }] }, options: {} }),
    codeNode('gs-main01-03', 'Check token', code('check_token.js')),
    ifNode('gs-main01-04', 'Token ok?', '={{ $json.token_ok }}', 'true'),
    ifNode('gs-main01-05', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main01-06', 'Route', 'n8n-nodes-base.switch', 3.2, { rules: { values: ['place', 'status', 'decide', 'event', 'health', 'feedback', 'confirm'].map((k) => ({
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'route-' + k, leftValue: '={{ $json.action }}', rightValue: k, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
      renameOutput: true, outputKey: k })) }, options: { fallbackOutput: 'extra', renameFallbackOutput: 'bad' } }),
    callSub('gs-main01-07', 'Call SUB 11 Place order', ids.sub11, [
      ['session_id', body('session_id'), 'string'], ['client_order_key', body('client_order_key'), 'string'], ['items', body('items'), 'array'],
      ['address', body('address'), 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-08', 'Call SUB 12 Change status', ids.sub12, [
      ['session_id', body('session_id'), 'string'], ['order_id', body('order_id'), 'string'], ['to_status', body('to_status'), 'string'],
      ['actor', body('actor'), 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-13', 'Call SUB 13 Decide', ids.sub13, [
      ['session_id', body('session_id'), 'string'], ['kitchen_id', '={{ $json.kitchen_id }}', 'string'], ['order_id', body('order_id'), 'string'],
      ['riders', body('riders'), 'array'], ['params_version', '={{ $json.params_version }}', 'number'], ['jev_enabled', '={{ $json.jev_enabled }}', 'boolean'],
      ['jev_model', '={{ $json.jev_model }}', 'string'], ['jev_cost_cap', '={{ $json.jev_cost_cap }}', 'number'],
      ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-16', 'Call SUB 15 Add event', ids.sub15, [
      ['session_id', body('session_id'), 'string'], ['order_id', body('order_id'), 'string'], ['event', body('event'), 'string'],
      ['actor', body('actor'), 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-17', 'Call SUB 16 Health', ids.sub16, [
      ['jev_enabled', '={{ $json.jev_enabled }}', 'boolean'], ['jev_model', '={{ $json.jev_model }}', 'string']]),
    callSub('gs-main01-19', 'Call SUB 12 Confirm', ids.sub12, [
      ['session_id', body('session_id'), 'string'], ['order_id', body('order_id'), 'string'], ['to_status', 'confirm', 'string'],
      ['actor', 'customer', 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-18', 'Call SUB 17 Feedback', ids.sub17, [
      ['session_id', body('session_id'), 'string'], ['kitchen_id', '={{ $json.kitchen_id }}', 'string'], ['role', body('role'), 'string'], ['screen', body('screen'), 'string'],
      ['order_id', "={{ $json.body.order_id || '' }}", 'string'], ['doing', body('doing'), 'string'], ['text', body('text'), 'string'], ['context', body('context'), 'object'],
      ['image_b64', "={{ $json.body.image_b64 || '' }}", 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string'],
      ['drive_folder_id', '={{ $json.drive_folder_id }}', 'string'], ['chat_id', '={{ $json.chat_id }}', 'string'], ['env', '={{ $json.env }}', 'string']]),
    ifNode('gs-main01-20', 'Ready?', "={{ $json.ok === true && !!$json.order && $json.order.status === 'ready' }}", 'true'),
    callSub('gs-main01-21', 'Call SUB 22 Dispatch', ids.sub22, [
      ['session_id', '={{ $json.order.session_id }}', 'string'], ['kitchen_id', '={{ $json.order.kitchen_id }}', 'string'], ['order_id', '={{ $json.order.id }}', 'string'],
      ['params_version', "={{ $('Config').first().json.params_version }}", 'number'], ['jev_enabled', "={{ $('Config').first().json.jev_enabled }}", 'boolean'],
      ['jev_model', "={{ $('Config').first().json.jev_model }}", 'string'], ['jev_cost_cap', "={{ $('Config').first().json.jev_cost_cap }}", 'number'],
      ['kill_switch', "={{ $('Config').first().json.kill_switch }}", 'boolean'], ['supabase_url', "={{ $('Config').first().json.supabase_url }}", 'string']]),
    ifNode('gs-main01-22', 'Push?', "={{ $json.ok === true && $json.already_done !== true && !!$json.order && (($json.order.status === 'placed' && $json.created === true) || $json.order.status === 'ready' || $json.order.status === 'delivered') }}", 'true'),
    callSub('gs-main01-23', 'Call SUB 20 Push', ids.sub20, [
      ['session_id', '={{ $json.order.session_id }}', 'string'], ['status', '={{ $json.order.status }}', 'string'],
      ['vapid_public_key', "={{ $('Config').first().json.vapid_public_key }}", 'string'], ['vapid_subject', "={{ $('Config').first().json.vapid_subject }}", 'string'],
      ['kill_switch', "={{ $('Config').first().json.kill_switch }}", 'boolean'], ['supabase_url', "={{ $('Config').first().json.supabase_url }}", 'string']], false),
    respond('gs-main01-09', 'Respond result', '={{ $json.status_code }}', answer),
    codeNode('gs-main01-14', 'Log run', code('log_run.js')),
    callSub('gs-main01-15', 'Call SUB 14 Write logs', ids.sub14, [
      ['session_id', '={{ $json.session_id }}', 'string'], ['kitchen_id', '={{ $json.kitchen_id }}', 'string'], ['workflow', '={{ $json.workflow }}', 'string'],
      ['params_version', '={{ $json.params_version }}', 'number'], ['duration_ms', '={{ $json.duration_ms }}', 'number'], ['cost', '={{ $json.cost }}', 'number'],
      ['error', '={{ $json.error }}', 'string'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    respond('gs-main01-10', 'Respond 401', 401, '{"ok":false,"error":"unauthorized","message":"Missing or wrong demo token."}'),
    respond('gs-main01-11', 'Respond 503', 503, '{"ok":false,"error":"kill_switch","message":"Orders are paused. Please try again soon."}'),
    respond('gs-main01-12', 'Respond 400', 400, '{"ok":false,"error":"bad_action","message":"Unknown action."}'),
  ];
  const edges = [['Order webhook', 'Config'], ['Config', 'Check token'], ['Check token', 'Token ok?'],
    ['Token ok?', 'Kill switch?', 0], ['Token ok?', 'Respond 401', 1], ['Kill switch?', 'Respond 503', 0], ['Kill switch?', 'Route', 1],
    ['Route', 'Call SUB 11 Place order', 0], ['Route', 'Call SUB 12 Change status', 1], ['Route', 'Call SUB 13 Decide', 2], ['Route', 'Call SUB 15 Add event', 3], ['Route', 'Call SUB 16 Health', 4], ['Route', 'Call SUB 17 Feedback', 5], ['Route', 'Call SUB 12 Confirm', 6], ['Route', 'Respond 400', 7],
    ['Call SUB 11 Place order', 'Respond result'], ['Call SUB 12 Change status', 'Respond result'], ['Call SUB 13 Decide', 'Respond result'], ['Call SUB 15 Add event', 'Respond result'], ['Call SUB 16 Health', 'Respond result'], ['Call SUB 17 Feedback', 'Respond result'], ['Call SUB 12 Confirm', 'Respond result'],
    ['Respond result', 'Log run'], ['Log run', 'Call SUB 14 Write logs'], ['Respond result', 'Ready?'], ['Ready?', 'Call SUB 22 Dispatch', 0], ['Respond result', 'Push?'], ['Push?', 'Call SUB 20 Push', 0]];
  const sections = [
    { name: 'RECEIVE', what: 'The phone posts here. Body field "action" is place, status, decide, event, health, feedback or confirm. The header x-gs-token carries the demo token.', needs: 'Path gs-order. Body: action and the fields of the SUB.', nodes: ['Order webhook'], color: 4 },
    { name: 'CONFIG', what: 'All tunables live here: the kill switch, the demo token and the database address.', needs: 'Config keys: kill_switch, demo_token, supabase_url.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'Wrong token gets 401. Kill switch on gets 503. Nothing else runs in both cases.', needs: 'Config: demo_token, kill_switch. Header x-gs-token.', nodes: ['Check token', 'Token ok?', 'Kill switch?'], color: 5 },
    { name: 'ROUTE', what: 'Pick the SUB workflow by the action field. Unknown action gets 400.', needs: 'Body field: action.', nodes: ['Route'], color: 5 },
    { name: 'PLACE ORDER', what: 'Call SUB 11. It writes the order and its first event.', needs: 'SUB 11 id. Body: session_id, client_order_key, items, address.', nodes: ['Call SUB 11 Place order'], color: 6 },
    { name: 'CHANGE STATUS', what: 'Call SUB 12. It moves the order one step and writes the event.', needs: 'SUB 12 id. Body: session_id, order_id, to_status, actor.', nodes: ['Call SUB 12 Change status'], color: 6 },
    { name: 'DECIDE', what: 'Call SUB 13. The rule picks a rider; Jev only advises. One decision row is written.', needs: 'SUB 13 id. Body: session_id, order_id, riders. Config: jev keys, kitchen_id, params_version.', nodes: ['Call SUB 13 Decide'], color: 6 },
    { name: 'ADD EVENT', what: 'Call SUB 15. It writes the rider\'s arriving event; the status stays the same.', needs: 'SUB 15 id. Body: session_id, order_id, event, actor.', nodes: ['Call SUB 15 Add event'], color: 6 },
    { name: 'HEALTH', what: 'Call SUB 16. It asks Jev one tiny question and says if it answered. Nothing is written.', needs: 'SUB 16 id. Config: jev_enabled, jev_model.', nodes: ['Call SUB 16 Health'], color: 6 },
    { name: 'CONFIRM', what: 'The customer\'s Yes. Call SUB 12 as the customer: the order is delivered and paid by cash. The answer also tells the phone when to ask.', needs: 'SUB 12 id. Body: session_id, order_id. Config: confirm_after_ready_min, confirm_after_place_min.', nodes: ['Call SUB 12 Confirm'], color: 6 },
    { name: 'FEEDBACK', what: 'Call SUB 17. It saves a tester\'s report, puts the screenshot in Google Drive and tells the owner on Telegram.', needs: 'SUB 17 id. Body: session_id, role, screen, order_id, doing, text, context, image_b64. Config: drive_folder_id, chat_id, env.', nodes: ['Call SUB 17 Feedback'], color: 6 },
    { name: 'ANSWER', what: 'Send the SUB result back to the phone with its status code.', needs: 'The SUB output: status_code, ok, order, decision, id.', nodes: ['Respond result'], color: 4 },
    { name: 'DISPATCH', what: 'After the answer is out: if the order just became Ready, call SUB 22. It picks a rider and saves the rider on the order. If no rider is online the run fails on purpose and GS ERR 00 tells the owner.', needs: 'SUB 22 id. Config: params_version, jev keys.', nodes: ['Ready?', 'Call SUB 22 Dispatch'], color: 6 },
    { name: 'PUSH', what: 'After the answer is out: a new order, a ready order or a delivered order sends a web push through SUB 20. It is not waited for.', needs: 'SUB 20 id. Config: vapid_public_key, vapid_subject.', nodes: ['Push?', 'Call SUB 20 Push'], color: 6 },
    { name: 'LOG', what: 'After the answer is out, write one run row: time taken, settings version, cost, error.', needs: 'SUB 14 id. Config: params_version, kitchen_id.', nodes: ['Log run', 'Call SUB 14 Write logs'], color: 6 },
    { name: 'REFUSE', what: 'Answer the calls that must not go on: 401, 503 and 400.', needs: 'Nothing.', nodes: ['Respond 401', 'Respond 503', 'Respond 400'], color: 1 },
  ];
  const main01 = finish('GS MAIN 01 Order API', nodes, edges, sections, settings);

  // ---- SUB 91 Scorecard numbers: read the window's rows, no writes (story #47; H14 adds the pilot numbers and an `until`) ----
  const f91 = [['since', 'string'], ['until', 'string'], ['supabase_url', 'string']];
  const read = (id, name, table, select) => node(id, name, 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'GET', url: `={{ $('Start').first().json.supabase_url }}/rest/v1/${table}?select=${select}&created_at=gte.{{ $('Start').first().json.since }}&created_at=lt.{{ $('Start').first().json.until }}&order=created_at.desc&limit=1000`,
    authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } });
  const rpcRead = (id, name, fn, bodyExpr, urlFrom) => node(id, name, 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'POST', url: `={{ ${urlFrom} }}/rest/v1/rpc/${fn}`, authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    sendBody: true, specifyBody: 'json', jsonBody: bodyExpr,
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } });
  const n91 = [
    node('gs-sub91-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f91)),
    read('gs-sub91-02', 'Read runs', 'run_log', 'workflow,duration_ms,cost,error'),
    read('gs-sub91-03', 'Read decisions', 'decision_log', 'decision'),
    rpcRead('gs-sub91-05', 'Read pilot numbers', 'pilot_numbers', "={{ JSON.stringify({ p_since: $('Start').first().json.since, p_until: $('Start').first().json.until }) }}", "$('Start').first().json.supabase_url"),
    codeNode('gs-sub91-04', 'Summarise', code('score_summary.js')),
  ];
  const e91 = [['Start', 'Read runs'], ['Read runs', 'Read decisions'], ['Read decisions', 'Read pilot numbers'], ['Read pilot numbers', 'Summarise']];
  const s91 = [
    { name: 'RECEIVE', what: 'The report workflows call this with the start and end of the window.', needs: 'Input: ' + f91.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'READ', what: 'Read the run rows and decision rows of the window (the newest 1000 of each), and ask the database for the pilot numbers. This workflow only reads.', needs: 'Credential "GoServe Supabase dev". Tables: run_log, decision_log. Function: pilot_numbers (read only).', nodes: ['Read runs', 'Read decisions', 'Read pilot numbers'], color: 6 },
    { name: 'SUMMARISE', what: 'Count runs, errors, time, decisions, Jev use and cost. Keep the pilot numbers. Health checks are counted apart. A failed pilot read does not stop the rest.', needs: 'The three reads.', nodes: ['Summarise'], color: 5 },
  ];
  const sub91 = finish('GS SUB 91 Scorecard numbers', n91, e91, s91, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: [ids.main90, ids.main93].filter(Boolean).join(',') }));

  // ---- SUB 93 Watch numbers: the orders over a line right now (story H14) ----
  const f93 = [['accept_min', 'number'], ['rider_min', 'number'], ['supabase_url', 'string']];
  const n93 = [
    node('gs-sub93-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f93)),
    rpcRead('gs-sub93-02', 'Read watch', 'pilot_watch', "={{ JSON.stringify({ p_accept_min: $('Start').first().json.accept_min, p_rider_min: $('Start').first().json.rider_min }) }}", "$('Start').first().json.supabase_url"),
    codeNode('gs-sub93-03', 'Shape rows', code('watch_shape.js')),
  ];
  const e93 = [['Start', 'Read watch'], ['Read watch', 'Shape rows']];
  const s93 = [
    { name: 'RECEIVE', what: 'MAIN 92 calls this every five minutes with the two time lines.', needs: 'Input: ' + f93.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'READ', what: 'Ask the database for orders over a line that nobody was told about yet. This workflow only reads.', needs: 'Credential "GoServe Supabase dev". Function: pilot_watch (read only).', nodes: ['Read watch'], color: 6 },
    { name: 'ANSWER', what: 'Hand back the rows, or a short error. Raw database text is never returned.', needs: 'The database answer.', nodes: ['Shape rows'], color: 5 },
  ];
  const sub93 = finish('GS SUB 93 Watch numbers', n93, e93, s93, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: ids.main92 }));

  // ---- SUB 94 Health and cost numbers: the platform and cost lines of the weekly and monthly report (story H15) ----
  const f94 = [['since', 'string'], ['days', 'number'], ['supabase_url', 'string'], ['uptimerobot_key', 'string']];
  const soft = { onError: 'continueRegularOutput' };
  const readOpts = { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 };
  const n94 = [
    node('gs-sub94-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f94)),
    node('gs-sub94-02', 'Read OpenRouter', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: 'https://openrouter.ai/api/v1/auth/key',
      authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: readOpts }, Object.assign({ credentials: { httpHeaderAuth: jevCred } }, soft)),
    node('gs-sub94-03', 'Read database numbers', 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: "={{ $('Start').first().json.supabase_url }}/rest/v1/rpc/health_numbers",
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, specifyBody: 'json', jsonBody: '={{ {} }}', options: readOpts },
      Object.assign({ credentials: { httpCustomAuth: cred } }, soft)),
    node('gs-sub94-04', 'Read n8n errors', 'n8n-nodes-base.httpRequest', 4.2, { method: 'GET', url: 'https://n8n.linkright.in/api/v1/executions?status=error&limit=100',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'n8nApi', options: readOpts },
      Object.assign({ credentials: { n8nApi: n8nApiCredential || { id: 'REPLACE_N8N_API_CRED_ID', name: 'GoServe n8n API' } } }, soft)),
    node('gs-sub94-05', 'Read uptime', 'n8n-nodes-base.httpRequest', 4.2, { method: 'POST', url: 'https://api.uptimerobot.com/v2/getMonitors', sendBody: true, specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ api_key: $('Start').first().json.uptimerobot_key, format: 'json', custom_uptime_ratios: '7' }) }}", options: readOpts }, soft),
    codeNode('gs-sub94-06', 'Health lines', code('health_lines.js')),
  ];
  const e94 = [['Start', 'Read OpenRouter'], ['Read OpenRouter', 'Read database numbers'], ['Read database numbers', 'Read n8n errors'], ['Read n8n errors', 'Read uptime'], ['Read uptime', 'Health lines']];
  const s94 = [
    { name: 'RECEIVE', what: 'MAIN 93 calls this once a week and once a month.', needs: 'Input: ' + f94.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'SPEND', what: 'Ask OpenRouter how much of the $2 cap is used.', needs: 'Credential "GoServe OpenRouter".', nodes: ['Read OpenRouter'], color: 6 },
    { name: 'DATABASE', what: 'Ask the database for its size, open connections, row counts, oldest rows and the cost caps.', needs: 'Credential "GoServe Supabase dev". Function: health_numbers (read only).', nodes: ['Read database numbers'], color: 6 },
    { name: 'ERRORS', what: 'Read the newest failed n8n runs and count the ones inside the window.', needs: 'Credential "GoServe n8n API" (the owner makes it).', nodes: ['Read n8n errors'], color: 6 },
    { name: 'UPTIME', what: 'Ask UptimeRobot for each monitor and its 7-day uptime.', needs: 'Input: uptimerobot_key.', nodes: ['Read uptime'], color: 6 },
    { name: 'LINES', what: 'Write one line per number, with OK, WATCH or OVER against the cap. A failed read prints "could not read" and the rest go on.', needs: 'The four reads.', nodes: ['Health lines'], color: 5 },
  ];
  const sub94 = finish('GS SUB 94 Health and cost numbers', n94, e94, s94, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: ids.main93 }));

  const telegram = (id, name) => node(id, name, 'n8n-nodes-base.telegram', 1.2, { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.text }}',
    additionalFields: { appendAttribution: false } }, { credentials: { telegramApi: { id: 'bBVpWzhaY0MCpoQ5', name: 'GoServeBot' } } });
  const cfgSet = (id, list) => node(id, 'Config', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: list.map(([name, type, value], i) => ({ id: 'cfg-' + (i + 1), name, type, value })) }, options: {} });
  const schedule = (id, name, expression) => node(id, name, 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression }] } });

  // ---- MAIN 90 Daily pilot card: one schedule, one Telegram message (story #47; H14 moves it to 22:15 and adds the pilot block) ----
  const n90 = [
    schedule('gs-main90-01', 'Every day 22:15', '15 22 * * *'),
    cfgSet('gs-main90-02', [['kill_switch', 'boolean', false], ['chat_id', 'string', chatId || PLACEHOLDER], ['supabase_url', 'string', url], ['prune_pings', 'boolean', true]]),
    ifNode('gs-main90-03', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main90-04', 'Paused', 'n8n-nodes-base.noOp', 1, {}),
    codeNode('gs-main90-05', 'Prepare window', code('score_window.js')),
    callSub('gs-main90-06', 'Call SUB 91 Scorecard numbers', ids.sub91, [['since', '={{ $json.since }}', 'string'], ['until', '={{ $json.until }}', 'string'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    codeNode('gs-main90-07', 'Format message', code('score_message.js')),
    telegram('gs-main90-08', 'Send scorecard'),
    node('gs-main90-09', 'Prune ping history', 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: "={{ $('Config').first().json.supabase_url }}/rest/v1/rpc/pilot_prune", authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ {} }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } }),
  ];
  const e90 = [['Every day 22:15', 'Config'], ['Config', 'Kill switch?'], ['Kill switch?', 'Paused', 0], ['Kill switch?', 'Prepare window', 1], ['Prepare window', 'Call SUB 91 Scorecard numbers'],
    ['Call SUB 91 Scorecard numbers', 'Format message'], ['Format message', 'Send scorecard'], ['Send scorecard', 'Prune ping history']];
  const s90 = [
    { name: 'SCHEDULE', what: 'Once a day at 22:15 India time, after the kitchen closes.', needs: 'Workflow timezone: Asia/Kolkata.', nodes: ['Every day 22:15'], color: 4 },
    { name: 'CONFIG', what: 'The kill switch, the owner chat and the database address live here.', needs: 'Config keys: kill_switch, chat_id, supabase_url, prune_pings.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'If the kill switch is on, send nothing.', needs: 'Config: kill_switch.', nodes: ['Kill switch?', 'Paused'], color: 1 },
    { name: 'WINDOW', what: 'Work out the last 24 hours, and the India time the card is for.', needs: 'Nothing.', nodes: ['Prepare window'], color: 5 },
    { name: 'COLLECT', what: 'Call SUB 91. It reads the rows of the last 24 hours and the pilot numbers.', needs: 'SUB 91 id. Config: supabase_url.', nodes: ['Call SUB 91 Scorecard numbers'], color: 6 },
    { name: 'FORMAT', what: 'Make one short message: the pilot numbers against their lines first, then runs, time, decisions, cost.', needs: 'The SUB 91 numbers.', nodes: ['Format message'], color: 5 },
    { name: 'SEND', what: 'Send the message to the owner on Telegram.', needs: 'Credential "GoServeBot". Config: chat_id.', nodes: ['Send scorecard'], color: 6 },
    { name: 'TIDY', what: 'Delete rider location pings older than 30 days.', needs: 'Credential "GoServe Supabase dev". Function: pilot_prune.', nodes: ['Prune ping history'], color: 6 },
  ];
  const main90 = finish('GS MAIN 90 Daily scorecard', n90, e90, s90, Object.assign({}, settings, { timezone: 'Asia/Kolkata' }));

  // ---- MAIN 92 Pilot watch: every five minutes in open hours, the second bell (story H14) ----
  const n92 = [
    schedule('gs-main92-01', 'Every 5 minutes', '*/5 * * * *'),
    cfgSet('gs-main92-02', [['kill_switch', 'boolean', false], ['chat_id', 'string', chatId || PLACEHOLDER], ['kitchen_chat_id', 'string', ''], ['supabase_url', 'string', url],
      ['accept_min', 'number', 3], ['rider_min', 'number', 5], ['open_from', 'string', '11:00'], ['open_to', 'string', '22:30']]),
    ifNode('gs-main92-03', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main92-04', 'Paused', 'n8n-nodes-base.noOp', 1, {}),
    codeNode('gs-main92-05', 'Open now?', code('watch_open.js')),
    ifNode('gs-main92-06', 'Open hours?', '={{ $json.open }}', 'true'),
    node('gs-main92-07', 'Closed', 'n8n-nodes-base.noOp', 1, {}),
    callSub('gs-main92-08', 'Call SUB 93 Watch numbers', ids.sub93, [['accept_min', '={{ $json.accept_min }}', 'number'], ['rider_min', '={{ $json.rider_min }}', 'number'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    codeNode('gs-main92-09', 'Format message', code('watch_format.js')),
    telegram('gs-main92-10', 'Send alert'),
    codeNode('gs-main92-11', 'Prepare marks', code('watch_marks.js')),
    node('gs-main92-12', 'Mark told', 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: '={{ $json.supabase_url }}/rest/v1/rpc/pilot_watch_mark', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.rpc_body }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } }),
  ];
  const e92 = [['Every 5 minutes', 'Config'], ['Config', 'Kill switch?'], ['Kill switch?', 'Paused', 0], ['Kill switch?', 'Open now?', 1], ['Open now?', 'Open hours?'],
    ['Open hours?', 'Call SUB 93 Watch numbers', 0], ['Open hours?', 'Closed', 1], ['Call SUB 93 Watch numbers', 'Format message'], ['Format message', 'Send alert'],
    ['Send alert', 'Prepare marks'], ['Prepare marks', 'Mark told']];
  const s92 = [
    { name: 'SCHEDULE', what: 'Every five minutes. The workflow itself stays quiet outside open hours.', needs: 'Workflow timezone: Asia/Kolkata.', nodes: ['Every 5 minutes'], color: 4 },
    { name: 'CONFIG', what: 'Kill switch, chats, the two time lines and the open hours live here.', needs: 'Config keys: kill_switch, chat_id, kitchen_chat_id, supabase_url, accept_min, rider_min, open_from, open_to.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'If the kill switch is on, do nothing.', needs: 'Config: kill_switch.', nodes: ['Kill switch?', 'Paused'], color: 1 },
    { name: 'HOURS', what: 'Check the India time against the open hours.', needs: 'Config: open_from, open_to.', nodes: ['Open now?', 'Open hours?', 'Closed'], color: 5 },
    { name: 'LOOK', what: 'Call SUB 93. It lists orders over a line that nobody was told about.', needs: 'SUB 93 id. Config: accept_min, rider_min, supabase_url.', nodes: ['Call SUB 93 Watch numbers'], color: 6 },
    { name: 'TELL', what: 'One short message per order. A late ticket also goes to the kitchen chat when it is set.', needs: 'Credential "GoServeBot". Config: chat_id, kitchen_chat_id.', nodes: ['Format message', 'Send alert'], color: 6 },
    { name: 'MARK', what: 'After the messages are sent, mark each order as told, so it is never sent twice. If a send fails, nothing is marked and the next run tries again.', needs: 'Credential "GoServe Supabase dev". Function: pilot_watch_mark.', nodes: ['Prepare marks', 'Mark told'], color: 6 },
  ];
  const main92 = finish('GS MAIN 92 Pilot watch', n92, e92, s92, Object.assign({}, settings, { timezone: 'Asia/Kolkata' }));

  // ---- MAIN 93 Weekly and monthly report: the table for the last 7 or 30 days beside the period before (story H14) ----
  const n93m = [
    schedule('gs-main93-01', 'Monday 09:00', '0 9 * * 1'),
    schedule('gs-main93-02', '1st of the month 09:00', '0 9 1 * *'),
    node('gs-main93-03', 'Week', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [{ id: 'w-1', name: 'days', type: 'number', value: 7 }] }, options: {} }),
    node('gs-main93-04', 'Month', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [{ id: 'm-1', name: 'days', type: 'number', value: 30 }] }, options: {} }),
    cfgSet('gs-main93-05', [['kill_switch', 'boolean', false], ['chat_id', 'string', chatId || PLACEHOLDER], ['supabase_url', 'string', url], ['uptimerobot_key', 'string', uptimerobotKey || PLACEHOLDER]]),
    ifNode('gs-main93-06', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main93-07', 'Paused', 'n8n-nodes-base.noOp', 1, {}),
    codeNode('gs-main93-08', 'Prepare window', code('score_window.js')),
    callSub('gs-main93-09', 'Call SUB 91 Scorecard numbers', ids.sub91, [['since', "={{ $json.since }}", 'string'], ['until', '={{ $json.until }}', 'string'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main93-10', 'Call SUB 91 before', ids.sub91, [['since', "={{ $('Prepare window').first().json.prev_since }}", 'string'], ['until', "={{ $('Prepare window').first().json.prev_until }}", 'string'], ['supabase_url', "={{ $('Prepare window').first().json.supabase_url }}", 'string']]),
    callSub('gs-main93-13', 'Call SUB 94 Health and cost numbers', ids.sub94, [['since', "={{ $('Prepare window').first().json.since }}", 'string'], ['days', "={{ $('Prepare window').first().json.days }}", 'number'], ['supabase_url', "={{ $('Prepare window').first().json.supabase_url }}", 'string'], ['uptimerobot_key', "={{ $('Prepare window').first().json.uptimerobot_key }}", 'string']]),
    codeNode('gs-main93-11', 'Format message', code('score_message.js')),
    telegram('gs-main93-12', 'Send report'),
  ];
  const e93m = [['Monday 09:00', 'Week'], ['1st of the month 09:00', 'Month'], ['Week', 'Config'], ['Month', 'Config'], ['Config', 'Kill switch?'], ['Kill switch?', 'Paused', 0], ['Kill switch?', 'Prepare window', 1],
    ['Prepare window', 'Call SUB 91 Scorecard numbers'], ['Call SUB 91 Scorecard numbers', 'Call SUB 91 before'], ['Call SUB 91 before', 'Call SUB 94 Health and cost numbers'], ['Call SUB 94 Health and cost numbers', 'Format message'], ['Format message', 'Send report']];
  const s93m = [
    { name: 'SCHEDULE', what: 'Monday 09:00 for the last 7 days. The 1st of the month 09:00 for the last 30 days.', needs: 'Workflow timezone: Asia/Kolkata.', nodes: ['Monday 09:00', '1st of the month 09:00'], color: 4 },
    { name: 'PERIOD', what: 'Set how many days the report covers.', needs: 'Nothing.', nodes: ['Week', 'Month'], color: 5 },
    { name: 'CONFIG', what: 'The kill switch, the owner chat and the database address live here.', needs: 'Config keys: kill_switch, chat_id, supabase_url.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'If the kill switch is on, send nothing.', needs: 'Config: kill_switch.', nodes: ['Kill switch?', 'Paused'], color: 1 },
    { name: 'WINDOW', what: 'Work out this period and the same length just before it.', needs: 'Nothing.', nodes: ['Prepare window'], color: 5 },
    { name: 'COLLECT', what: 'Call SUB 91 twice: for this period, and for the one before.', needs: 'SUB 91 id.', nodes: ['Call SUB 91 Scorecard numbers', 'Call SUB 91 before'], color: 6 },
    { name: 'HEALTH', what: 'Call SUB 94. It reads the platform and cost numbers: OpenRouter spend, database size, failed n8n runs, uptime.', needs: 'SUB 94 id. Config: uptimerobot_key.', nodes: ['Call SUB 94 Health and cost numbers'], color: 6 },
    { name: 'FORMAT', what: 'Make one message: the table against its lines, each number with the one before it, then the platform and cost lines.', needs: 'The two SUB 91 answers and the SUB 94 lines.', nodes: ['Format message'], color: 5 },
    { name: 'SEND', what: 'Send the message to the owner on Telegram.', needs: 'Credential "GoServeBot". Config: chat_id.', nodes: ['Send report'], color: 6 },
  ];
  const main93 = finish('GS MAIN 93 Weekly and monthly report', n93m, e93m, s93m, Object.assign({}, settings, { timezone: 'Asia/Kolkata' }));

  // ---- Simulator (story H5, #188, epic E16): the synthetic city. SUB 30 writes through sim_seed or sim_reset; MAIN 30 is its own webhook with its own token. ----
  const sub30 = sub({ name: 'GS SUB 30 Simulator write', n: 30, callerIds: [ids.main30, ids.main31].filter(Boolean).join(','), credential: cred, settings,
    fields: [['action', 'string'], ['body', 'object'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_sim.js', rpc: { fn: 'sim_seed or sim_reset', label: 'Seed or reset', dynamic: true },
    what: 'Seed fills the synthetic kitchens, dishes and riders (same seed, same rows). Reset deletes every synthetic row and nothing else. Tick moves the synthetic riders and flips a few kitchens, dishes and riders (H6). Enable and disable write the sim_enabled switch. Status reads the switch and the counts for the admin tab (H7).' });
  const n30 = [
    node('gs-main30-01', 'Sim webhook', 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path: prod ? 'gs-sim-prod' : 'gs-sim', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, { webhookId: prod ? '3c7a9e52-6d1b-4f08-9a2e-7b5d1c0e8f30' : 'a1e4c830-5b2f-4d7e-8c3a-9f0b6d2e1c30' }),
    cfgSet('gs-main30-02', [['kill_switch', 'boolean', false], ['sim_token', 'string', simToken || PLACEHOLDER], ['supabase_url', 'string', url], ['env', 'string', prod ? 'prod' : 'dev']]),
    codeNode('gs-main30-03', 'Check token', code('sim_token.js')),
    ifNode('gs-main30-04', 'Token ok?', '={{ $json.token_ok }}', 'true'),
    ifNode('gs-main30-05', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    ifNode('gs-main30-06', 'Action ok?', '={{ $json.action !== "bad" }}', 'true'),
    callSub('gs-main30-07', 'Call SUB 30 Simulator write', ids.sub30, [['action', '={{ $json.action }}', 'string'], ['body', '={{ $json.body }}', 'object'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    respond('gs-main30-08', 'Respond result', '={{ $json.status_code }}', '={{ JSON.stringify($json) }}'),   // a JSON string like MAIN 01; an object body made the edge answer 502 (prod, 25 Oct)
    respond('gs-main30-09', 'Respond 401', 401, '{"ok":false,"error":"unauthorized","message":"Missing or wrong simulator token."}'),
    respond('gs-main30-10', 'Respond 503', 503, '{"ok":false,"error":"kill_switch","message":"The simulator is paused."}'),
    respond('gs-main30-11', 'Respond 400', 400, '{"ok":false,"error":"bad_action","message":"Action must be seed, reset, tick, enable, disable or status."}'),
  ];
  const e30 = [['Sim webhook', 'Config'], ['Config', 'Check token'], ['Check token', 'Token ok?'], ['Token ok?', 'Kill switch?', 0], ['Token ok?', 'Respond 401', 1],
    ['Kill switch?', 'Respond 503', 0], ['Kill switch?', 'Action ok?', 1], ['Action ok?', 'Call SUB 30 Simulator write', 0], ['Action ok?', 'Respond 400', 1], ['Call SUB 30 Simulator write', 'Respond result']];
  const s30 = [
    { name: 'RECEIVE', what: 'The admin Simulator tab posts here through n8n, never the database. Body field "action" is seed, reset, tick, enable, disable or status; seed may carry kitchens, riders, dishes_per_kitchen, seed, open_pct, online_pct. The header x-gs-sim-token carries the simulator token.', needs: 'Path gs-sim. Body: action and the seed numbers.', nodes: ['Sim webhook'], color: 4 },
    { name: 'CONFIG', what: 'The kill switch, the simulator token (its own, not the demo token) and the database address.', needs: 'Config keys: kill_switch, sim_token, supabase_url, env.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'Wrong token gets 401. Kill switch on gets 503. An action that is not seed or reset gets 400.', needs: 'Config: sim_token, kill_switch. Header x-gs-sim-token. Body: action.', nodes: ['Check token', 'Token ok?', 'Kill switch?', 'Action ok?'], color: 5 },
    { name: 'WRITE', what: 'Call SUB 30. It clamps the numbers and runs sim_seed or sim_reset. Only rows marked synthetic are ever touched.', needs: 'SUB 30 id. Body: action and the seed numbers.', nodes: ['Call SUB 30 Simulator write'], color: 6 },
    { name: 'ANSWER', what: 'Send the counts back with the status code.', needs: 'The SUB output: status_code, ok, kitchens, riders, dishes.', nodes: ['Respond result'], color: 4 },
    { name: 'REFUSE', what: 'Answer the calls that must not go on: 401, 503 and 400.', needs: 'Nothing.', nodes: ['Respond 401', 'Respond 503', 'Respond 400'], color: 1 },
  ];
  const main30 = finish('GS MAIN 30 Simulator', n30, e30, s30, settings);

  // ---- MAIN 31 Simulator tick (story H6, #189): every minute, while the database switch sim_enabled is on, the synthetic city moves. ----
  const n31 = [
    schedule('gs-main31-01', 'Every minute', '* * * * *'),
    cfgSet('gs-main31-02', [['kill_switch', 'boolean', false], ['supabase_url', 'string', url], ['env', 'string', prod ? 'prod' : 'dev']]),
    ifNode('gs-main31-03', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main31-04', 'Paused', 'n8n-nodes-base.noOp', 1, {}),
    codeNode('gs-main31-05', 'Tick', code('sim_tick.js')),
    callSub('gs-main31-06', 'Call SUB 30 Simulator write', ids.sub30, [['action', '={{ $json.action }}', 'string'], ['body', '={{ $json.body }}', 'object'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
  ];
  const e31 = [['Every minute', 'Config'], ['Config', 'Kill switch?'], ['Kill switch?', 'Paused', 0], ['Kill switch?', 'Tick', 1], ['Tick', 'Call SUB 30 Simulator write']];
  const s31 = [
    { name: 'CLOCK', what: 'Runs every minute. The real on/off switch is the database param sim_enabled (the admin tab flips it through MAIN 30); when it is off the tick does nothing.', needs: 'Nothing.', nodes: ['Every minute'], color: 4 },
    { name: 'CONFIG', what: 'The kill switch stops the schedule itself. The database address.', needs: 'Config keys: kill_switch, supabase_url, env.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'Kill switch on: stop here.', needs: 'Config: kill_switch.', nodes: ['Kill switch?', 'Paused'], color: 5 },
    { name: 'TICK', what: 'Say "tick" and call SUB 30. It runs sim_tick: synthetic riders walk 100 to 300 m, a few synthetic kitchens (opening hours only), dishes and riders flip. Real rows never change. Successful runs are not saved.', needs: 'SUB 30 id.', nodes: ['Tick', 'Call SUB 30 Simulator write'], color: 6 },
  ];
  const main31 = finish('GS MAIN 31 Simulator tick', n31, e31, s31, Object.assign({}, settings, { saveDataSuccessExecution: 'none' }));   // 1440 'skipped' runs a day would bury real errors (review of #259)

  // ---- Decision engine (story #263): the admin app asks MAIN 32 with the admin's own sign-in token; SUB 32 forwards it to the database, which checks is_admin(). ----
  const sub32 = sub({ name: 'GS SUB 32 Engine call', n: 32, callerIds: ids.main32, credential: cred, settings,
    fields: [['action', 'string'], ['engine', 'string'], ['auth', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string'], ['anon_key', 'string']],
    guardFile: 'guard_engine.js', shapeFile: 'engine_shape.js', rpc: { fn: 'get_decision_engine or set_decision_engine', label: 'Engine rpc', userJwt: true },
    what: 'Get reads the decision engine and set changes it. The database checks that the caller is an admin; the change is a new params version with the admin\'s email.' });
  const n32 = [
    node('gs-main32-01', 'Engine webhook', 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path: prod ? 'gs-engine-prod' : 'gs-engine', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, { webhookId: prod ? 'd2b8f1a6-4c93-4e17-b0a5-6e9c3f7d2e32' : '5e0a7c94-1b68-4f3d-8d2a-c4b9e6f1a032' }),
    cfgSet('gs-main32-02', [['kill_switch', 'boolean', false], ['supabase_url', 'string', url], ['anon_key', 'string', anonKey || PLACEHOLDER], ['env', 'string', prod ? 'prod' : 'dev']]),
    codeNode('gs-main32-03', 'Check request', code('engine_check.js')),
    ifNode('gs-main32-04', 'Signed in?', '={{ $json.auth_ok }}', 'true'),
    ifNode('gs-main32-05', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    ifNode('gs-main32-06', 'Action ok?', '={{ $json.action !== "bad" }}', 'true'),
    callSub('gs-main32-07', 'Call SUB 32 Engine', ids.sub32, [['action', '={{ $json.action }}', 'string'], ['engine', '={{ $json.engine }}', 'string'], ['auth', '={{ $json.auth }}', 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string'], ['anon_key', '={{ $json.anon_key }}', 'string']]),
    respond('gs-main32-08', 'Respond result', '={{ $json.status_code }}', '={{ JSON.stringify($json) }}'),
    respond('gs-main32-09', 'Respond 401', 401, '{"ok":false,"error":"not_signed_in","message":"Please sign in again."}'),
    respond('gs-main32-10', 'Respond 503', 503, '{"ok":false,"error":"kill_switch","message":"Decision changes are paused."}'),
    respond('gs-main32-11', 'Respond 400', 400, '{"ok":false,"error":"bad_action","message":"Action must be get or set with an engine."}'),
  ];
  const e32 = [['Engine webhook', 'Config'], ['Config', 'Check request'], ['Check request', 'Signed in?'], ['Signed in?', 'Kill switch?', 0], ['Signed in?', 'Respond 401', 1],
    ['Kill switch?', 'Respond 503', 0], ['Kill switch?', 'Action ok?', 1], ['Action ok?', 'Call SUB 32 Engine', 0], ['Action ok?', 'Respond 400', 1], ['Call SUB 32 Engine', 'Respond result']];
  const s32 = [
    { name: 'RECEIVE', what: 'The admin app posts here with its own sign-in token in the Authorization header. Body: action get, or action set with the engine (rules, jev or laya).', needs: 'Path gs-engine. Header Authorization: Bearer <token>.', nodes: ['Engine webhook'], color: 4 },
    { name: 'CONFIG', what: 'The kill switch, the database address and the public anon key. No admin token and no demo token live here.', needs: 'Config keys: kill_switch, supabase_url, anon_key, env.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'No token in the right shape gets 401. Kill switch on gets 503. An unknown action or engine gets 400. Who is an admin is decided by the database in the next step.', needs: 'Header Authorization. Body: action, engine.', nodes: ['Check request', 'Signed in?', 'Kill switch?', 'Action ok?'], color: 5 },
    { name: 'CALL', what: 'Call SUB 32. It forwards the token to the database function. A non-admin gets 403 from the database.', needs: 'SUB 32 id.', nodes: ['Call SUB 32 Engine'], color: 6 },
    { name: 'ANSWER', what: 'Send the engine, its version and who changed it back, with the status code.', needs: 'The SUB output: status_code, engine, version, by, changed_at.', nodes: ['Respond result'], color: 4 },
    { name: 'REFUSE', what: 'Answer the calls that must not go on: 401, 503 and 400.', needs: 'Nothing.', nodes: ['Respond 401', 'Respond 503', 'Respond 400'], color: 1 },
  ];
  const main32 = finish('GS MAIN 32 Decision engine', n32, e32, s32, settings);

  // ---- ERR 00: tells the owner on Telegram when a GoServe workflow fails (rulebook 84) ----
  const aNodes = [
    node('gs-err00-01', 'Error trigger', 'n8n-nodes-base.errorTrigger', 1, {}),
    node('gs-err00-02', 'Config', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [
      { id: 'cfg-1', name: 'chat_id', type: 'string', value: chatId || PLACEHOLDER }] }, options: {} }),
    codeNode('gs-err00-03', 'Format message', code('format_alert.js')),
    node('gs-err00-04', 'Send alert', 'n8n-nodes-base.telegram', 1.2, { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.text }}',
      additionalFields: { parse_mode: 'HTML', appendAttribution: false } }, { credentials: { telegramApi: { id: 'bBVpWzhaY0MCpoQ5', name: 'GoServeBot' } } }),
  ];
  const aEdges = [['Error trigger', 'Config'], ['Config', 'Format message'], ['Format message', 'Send alert']];
  const aSections = [
    { name: 'CATCH', what: 'n8n starts this when a GoServe order workflow fails.', needs: 'Set as the error workflow of the other three.', nodes: ['Error trigger'], color: 1 },
    { name: 'CONFIG', what: 'The owner chat id lives here.', needs: 'Config key: chat_id.', nodes: ['Config'], color: 5 },
    { name: 'FORMAT', what: 'Make a short message: workflow, node, error, execution id.', needs: 'The error item.', nodes: ['Format message'], color: 5 },
    { name: 'SEND', what: 'Send the message to the owner on Telegram.', needs: 'Credential "GoServeBot". Config: chat_id.', nodes: ['Send alert'], color: 6 },
  ];
  const alert = finish('GS ERR 00 Alert', aNodes, aEdges, aSections, baseSettings);
  const all = { sub11, sub12, sub13, sub14, sub15, sub16, sub17, sub18, sub19, sub20, sub21, sub22, sub30, sub32, main30, main31, main32, sub91, sub93, sub94, main01, main90, main92, main93, alert };
  if (prod) for (const k of Object.keys(all)) if (k !== 'alert') all[k].name += ' PROD';   // the one GS ERR 00 alert is shared (one bot, one chat)
  return { ...all, STATUS_ROLES };
}

module.exports = { build, PLACEHOLDER };
