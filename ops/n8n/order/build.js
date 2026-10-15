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
function sub({ name, n, trigger, fields, guardFile, rpc, callerIds, what, credential, settings }) {
  const p = `gs-sub${n}`;
  const nodes = [
    node(`${p}-01`, 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, { inputSource: 'workflowInputs', workflowInputs: { values: fields.map(([name, type]) => ({ name, type })) } }),
    codeNode(`${p}-02`, 'Guard', code(guardFile)),
    ifNode(`${p}-03`, 'Allowed?', '={{ $json.ok }}', 'true'),
    node(`${p}-04`, rpc.label, 'n8n-nodes-base.httpRequest', 4.2, {
      method: 'POST', url: `={{ $json.supabase_url }}/rest/v1/rpc/${rpc.fn}`,
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.rpc_body }}',
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } },
      { credentials: { httpCustomAuth: credential } }),
    codeNode(`${p}-05`, 'Shape result', code('shape.js')),
    node(`${p}-06`, 'Return refusal', 'n8n-nodes-base.noOp', 1, {}),
  ];
  const edges = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', rpc.label, 0], ['Allowed?', 'Return refusal', 1], [rpc.label, 'Shape result']];
  const sections = [
    { name: 'RECEIVE', what: `The MAIN workflow calls this with the fields below. ${what}`, needs: 'Input: ' + fields.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse at once if the kill switch is on or a field is missing. Nothing is written here.', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'WRITE', what: `One database call (${rpc.fn}) does the check and the write together. The database decides, not this workflow.`, needs: 'Credential "GoServe Supabase dev". Input: supabase_url.', nodes: [rpc.label], color: 6 },
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
function build({ ids, token, supabaseUrl, credential, openrouterCredential, chatId, env }) {
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
    guardFile: 'guard_status.js', rpc: { fn: 'change_status', label: 'Change status' },
    what: 'It moves the order one step and writes the event.' });

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
  const e13 = [['Start', 'Guard'], ['Guard', 'Allowed?'], ['Allowed?', 'Ask Jev?', 0], ['Allowed?', 'Return refusal', 1], ['Ask Jev?', 'Ask Jev', 0], ['Ask Jev?', 'Decide', 1],
    ['Ask Jev', 'Decide'], ['Decide', 'Write decision'], ['Write decision', 'Decision stored']];
  const s13 = [
    { name: 'RECEIVE', what: 'The MAIN workflow calls this with a ready order and the riders.', needs: 'Input: ' + f13.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'CHECK', what: 'Refuse if the kill switch is on or input is bad. Work out the rule pick and build the Jev question (no names or addresses).', needs: 'Input fields. No credential.', nodes: ['Guard', 'Allowed?'], color: 5 },
    { name: 'JEV', what: 'Ask Jev for a suggestion within 1500 ms. If Jev is off or fails, go on without it.', needs: 'Credential "GoServe OpenRouter". Config: jev_enabled, jev_model.', nodes: ['Ask Jev?', 'Ask Jev'], color: 3 },
    { name: 'DECIDE', what: 'The rule decides. Jev is kept in the record with its confidence, or the reason it was not used.', needs: 'Guard and Jev results. Config: jev_cost_cap.', nodes: ['Decide'], color: 5 },
    { name: 'WRITE', what: 'Write one decision_log row with the rule pick, the Jev pick and the pick used.', needs: 'Credential "GoServe Supabase dev". Table: decision_log.', nodes: ['Write decision'], color: 6 },
    { name: 'ANSWER', what: 'Return the decision if the row was stored, else a short error.', needs: 'The database answer.', nodes: ['Decision stored'], color: 5 },
    refuseSection,
  ];
  const sub13 = finish('GS SUB 13 Decide', n13, e13, s13, subSettings);

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

  const callSub = (id, name, subId, mapping) => node(id, name, 'n8n-nodes-base.executeWorkflow', 1.2, {
    source: 'database', workflowId: { __rl: true, value: subId, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: Object.fromEntries(mapping.map(([k, v]) => [k, v])), matchingColumns: [],
      schema: schemaOf(mapping.map(([k, , t]) => [k, t])), attemptToConvertTypes: false, convertFieldsToString: false },
    mode: 'once', options: { waitForSubWorkflow: true } });
  const body = (f) => `={{ $json.body.${f} }}`;
  const respond = (id, name, code_, text) => node(id, name, 'n8n-nodes-base.respondToWebhook', 1.1, { respondWith: 'json', responseBody: text, options: { responseCode: code_ } });
  const answer = '={{ JSON.stringify({ ok: $json.ok, error: $json.error, message: $json.message, created: $json.created, order: $json.order, decision: $json.decision, jev: $json.jev }) }}';

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
      { id: 'cfg-8', name: 'jev_cost_cap', type: 'number', value: 0.001 }] }, options: {} }),
    codeNode('gs-main01-03', 'Check token', code('check_token.js')),
    ifNode('gs-main01-04', 'Token ok?', '={{ $json.token_ok }}', 'true'),
    ifNode('gs-main01-05', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main01-06', 'Route', 'n8n-nodes-base.switch', 3.2, { rules: { values: ['place', 'status', 'decide', 'event', 'health'].map((k) => ({
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
    ['Route', 'Call SUB 11 Place order', 0], ['Route', 'Call SUB 12 Change status', 1], ['Route', 'Call SUB 13 Decide', 2], ['Route', 'Call SUB 15 Add event', 3], ['Route', 'Call SUB 16 Health', 4], ['Route', 'Respond 400', 5],
    ['Call SUB 11 Place order', 'Respond result'], ['Call SUB 12 Change status', 'Respond result'], ['Call SUB 13 Decide', 'Respond result'], ['Call SUB 15 Add event', 'Respond result'], ['Call SUB 16 Health', 'Respond result'],
    ['Respond result', 'Log run'], ['Log run', 'Call SUB 14 Write logs']];
  const sections = [
    { name: 'RECEIVE', what: 'The phone posts here. Body field "action" is place, status, decide, event or health. The header x-gs-token carries the demo token.', needs: 'Path gs-order. Body: action and the fields of the SUB.', nodes: ['Order webhook'], color: 4 },
    { name: 'CONFIG', what: 'All tunables live here: the kill switch, the demo token and the database address.', needs: 'Config keys: kill_switch, demo_token, supabase_url.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'Wrong token gets 401. Kill switch on gets 503. Nothing else runs in both cases.', needs: 'Config: demo_token, kill_switch. Header x-gs-token.', nodes: ['Check token', 'Token ok?', 'Kill switch?'], color: 5 },
    { name: 'ROUTE', what: 'Pick the SUB workflow by the action field. Unknown action gets 400.', needs: 'Body field: action.', nodes: ['Route'], color: 5 },
    { name: 'PLACE ORDER', what: 'Call SUB 11. It writes the order and its first event.', needs: 'SUB 11 id. Body: session_id, client_order_key, items, address.', nodes: ['Call SUB 11 Place order'], color: 6 },
    { name: 'CHANGE STATUS', what: 'Call SUB 12. It moves the order one step and writes the event.', needs: 'SUB 12 id. Body: session_id, order_id, to_status, actor.', nodes: ['Call SUB 12 Change status'], color: 6 },
    { name: 'DECIDE', what: 'Call SUB 13. The rule picks a rider; Jev only advises. One decision row is written.', needs: 'SUB 13 id. Body: session_id, order_id, riders. Config: jev keys, kitchen_id, params_version.', nodes: ['Call SUB 13 Decide'], color: 6 },
    { name: 'ADD EVENT', what: 'Call SUB 15. It writes the rider\'s arriving event; the status stays the same.', needs: 'SUB 15 id. Body: session_id, order_id, event, actor.', nodes: ['Call SUB 15 Add event'], color: 6 },
    { name: 'HEALTH', what: 'Call SUB 16. It asks Jev one tiny question and says if it answered. Nothing is written.', needs: 'SUB 16 id. Config: jev_enabled, jev_model.', nodes: ['Call SUB 16 Health'], color: 6 },
    { name: 'ANSWER', what: 'Send the SUB result back to the phone with its status code.', needs: 'The SUB output: status_code, ok, order, decision.', nodes: ['Respond result'], color: 4 },
    { name: 'LOG', what: 'After the answer is out, write one run row: time taken, settings version, cost, error.', needs: 'SUB 14 id. Config: params_version, kitchen_id.', nodes: ['Log run', 'Call SUB 14 Write logs'], color: 6 },
    { name: 'REFUSE', what: 'Answer the calls that must not go on: 401, 503 and 400.', needs: 'Nothing.', nodes: ['Respond 401', 'Respond 503', 'Respond 400'], color: 1 },
  ];
  const main01 = finish('GS MAIN 01 Order API', nodes, edges, sections, settings);

  // ---- SUB 91 Scorecard numbers: read today's rows, no writes (story #47) ----
  const f91 = [['since', 'string'], ['supabase_url', 'string']];
  const read = (id, name, table, select) => node(id, name, 'n8n-nodes-base.httpRequest', 4.2, {
    method: 'GET', url: `={{ $('Start').first().json.supabase_url }}/rest/v1/${table}?select=${select}&created_at=gte.{{ $('Start').first().json.since }}&order=created_at.desc&limit=1000`,
    authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
    options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 10000 } }, { credentials: { httpCustomAuth: cred } });
  const n91 = [
    node('gs-sub91-01', 'Start', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, inputs(f91)),
    read('gs-sub91-02', 'Read runs', 'run_log', 'workflow,duration_ms,cost,error'),
    read('gs-sub91-03', 'Read decisions', 'decision_log', 'decision'),
    codeNode('gs-sub91-04', 'Summarise', code('score_summary.js')),
  ];
  const e91 = [['Start', 'Read runs'], ['Read runs', 'Read decisions'], ['Read decisions', 'Summarise']];
  const s91 = [
    { name: 'RECEIVE', what: 'The scorecard workflow calls this with the start of the last 24 hours.', needs: 'Input: ' + f91.map((f) => f[0]).join(', ') + '.', nodes: ['Start'], color: 4 },
    { name: 'READ', what: 'Read the run rows and decision rows of the last 24 hours (the newest 1000 of each). This workflow only reads.', needs: 'Credential "GoServe Supabase dev". Tables: run_log, decision_log.', nodes: ['Read runs', 'Read decisions'], color: 6 },
    { name: 'SUMMARISE', what: 'Count runs, errors, time, decisions, Jev use and cost. Health checks are counted apart.', needs: 'The two reads.', nodes: ['Summarise'], color: 5 },
  ];
  const sub91 = finish('GS SUB 91 Scorecard numbers', n91, e91, s91, Object.assign({}, settings, { callerPolicy: 'workflowsFromAList', callerIds: ids.main90 }));

  // ---- MAIN 90 Daily scorecard: one schedule, one Telegram message (story #47) ----
  const n90 = [
    node('gs-main90-01', 'Every day 21:00', 'n8n-nodes-base.scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: '0 21 * * *' }] } }),
    node('gs-main90-02', 'Config', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [
      { id: 'cfg-1', name: 'kill_switch', type: 'boolean', value: false },
      { id: 'cfg-2', name: 'chat_id', type: 'string', value: chatId || PLACEHOLDER },
      { id: 'cfg-3', name: 'supabase_url', type: 'string', value: url }] }, options: {} }),
    ifNode('gs-main90-03', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main90-04', 'Paused', 'n8n-nodes-base.noOp', 1, {}),
    codeNode('gs-main90-05', 'Prepare window', code('score_window.js')),
    callSub('gs-main90-06', 'Call SUB 91 Scorecard numbers', ids.sub91, [['since', '={{ $json.since }}', 'string'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    codeNode('gs-main90-07', 'Format message', code('score_message.js')),
    node('gs-main90-08', 'Send scorecard', 'n8n-nodes-base.telegram', 1.2, { resource: 'message', operation: 'sendMessage', chatId: '={{ $json.chat_id }}', text: '={{ $json.text }}',
      additionalFields: { appendAttribution: false } }, { credentials: { telegramApi: { id: 'bBVpWzhaY0MCpoQ5', name: 'GoServeBot' } } }),
  ];
  const e90 = [['Every day 21:00', 'Config'], ['Config', 'Kill switch?'], ['Kill switch?', 'Paused', 0], ['Kill switch?', 'Prepare window', 1], ['Prepare window', 'Call SUB 91 Scorecard numbers'],
    ['Call SUB 91 Scorecard numbers', 'Format message'], ['Format message', 'Send scorecard']];
  const s90 = [
    { name: 'SCHEDULE', what: 'Once a day at 21:00 India time.', needs: 'Workflow timezone: Asia/Kolkata.', nodes: ['Every day 21:00'], color: 4 },
    { name: 'CONFIG', what: 'The kill switch, the owner chat and the database address live here.', needs: 'Config keys: kill_switch, chat_id, supabase_url.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'If the kill switch is on, send nothing.', needs: 'Config: kill_switch.', nodes: ['Kill switch?', 'Paused'], color: 1 },
    { name: 'WINDOW', what: 'Work out the last 24 hours, and the India time the card is for.', needs: 'Nothing.', nodes: ['Prepare window'], color: 5 },
    { name: 'COLLECT', what: 'Call SUB 91. It reads the rows of the last 24 hours and counts them.', needs: 'SUB 91 id. Config: supabase_url.', nodes: ['Call SUB 91 Scorecard numbers'], color: 6 },
    { name: 'FORMAT', what: 'Make one short message: runs with errors, time, decisions, cost.', needs: 'The SUB 91 numbers.', nodes: ['Format message'], color: 5 },
    { name: 'SEND', what: 'Send the message to the owner on Telegram.', needs: 'Credential "GoServeBot". Config: chat_id.', nodes: ['Send scorecard'], color: 6 },
  ];
  const main90 = finish('GS MAIN 90 Daily scorecard', n90, e90, s90, Object.assign({}, settings, { timezone: 'Asia/Kolkata' }));

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
  const all = { sub11, sub12, sub13, sub14, sub15, sub16, sub91, main01, main90, alert };
  if (prod) for (const k of Object.keys(all)) if (k !== 'alert') all[k].name += ' PROD';   // the one GS ERR 00 alert is shared (one bot, one chat)
  return { ...all, STATUS_ROLES };
}

module.exports = { build, PLACEHOLDER };
