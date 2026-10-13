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

function build({ ids, token, supabaseUrl, credential, chatId }) {
  const settings = ids.alert ? Object.assign({}, baseSettings, { errorWorkflow: ids.alert }) : baseSettings;
  const cred = credential || { id: 'REPLACE_CREDENTIAL_ID', name: 'GoServe Supabase dev' };
  const url = supabaseUrl || 'https://REPLACE_PROJECT.supabase.co';
  const main = ids.main01;

  const sub11 = sub({ name: 'GS SUB 11 Place order', n: 11, callerIds: main, credential: cred, settings,
    fields: [['session_id', 'string'], ['client_order_key', 'string'], ['items', 'array'], ['address', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_place.js', rpc: { fn: 'place_order', label: 'Place order' },
    what: 'It checks the dishes and prices and writes the order and its first event.' });
  const sub12 = sub({ name: 'GS SUB 12 Change status', n: 12, callerIds: main, credential: cred, settings,
    fields: [['session_id', 'string'], ['order_id', 'string'], ['to_status', 'string'], ['actor', 'string'], ['kill_switch', 'boolean'], ['supabase_url', 'string']],
    guardFile: 'guard_status.js', rpc: { fn: 'change_status', label: 'Change status' },
    what: 'It moves the order one step and writes the event.' });

  const callSub = (id, name, subId, mapping) => node(id, name, 'n8n-nodes-base.executeWorkflow', 1.2, {
    source: 'database', workflowId: { __rl: true, value: subId, mode: 'id' },
    workflowInputs: { mappingMode: 'defineBelow', value: Object.fromEntries(mapping.map(([k, v]) => [k, v])), matchingColumns: [],
      schema: schemaOf(mapping.map(([k, , t]) => [k, t])), attemptToConvertTypes: false, convertFieldsToString: false },
    mode: 'once', options: { waitForSubWorkflow: true } });
  const body = (f) => `={{ $json.body.${f} }}`;
  const respond = (id, name, code_, text) => node(id, name, 'n8n-nodes-base.respondToWebhook', 1.1, { respondWith: 'json', responseBody: text, options: { responseCode: code_ } });
  const answer = '={{ JSON.stringify({ ok: $json.ok, error: $json.error, message: $json.message, created: $json.created, order: $json.order }) }}';

  const nodes = [
    node('gs-main01-01', 'Order webhook', 'n8n-nodes-base.webhook', 2, { httpMethod: 'POST', path: 'gs-order', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, { webhookId: '6f1d7a52-2c43-4d0b-9b6e-5a1f0c9e7d11' }),
    node('gs-main01-02', 'Config', 'n8n-nodes-base.set', 3.4, { mode: 'manual', includeOtherFields: true, assignments: { assignments: [
      { id: 'cfg-1', name: 'kill_switch', type: 'boolean', value: false },
      { id: 'cfg-2', name: 'demo_token', type: 'string', value: token || PLACEHOLDER },
      { id: 'cfg-3', name: 'supabase_url', type: 'string', value: url }] }, options: {} }),
    codeNode('gs-main01-03', 'Check token', code('check_token.js')),
    ifNode('gs-main01-04', 'Token ok?', '={{ $json.token_ok }}', 'true'),
    ifNode('gs-main01-05', 'Kill switch?', '={{ $json.kill_switch }}', 'true'),
    node('gs-main01-06', 'Route', 'n8n-nodes-base.switch', 3.2, { rules: { values: ['place', 'status'].map((k) => ({
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: 'route-' + k, leftValue: '={{ $json.action }}', rightValue: k, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
      renameOutput: true, outputKey: k })) }, options: { fallbackOutput: 'extra', renameFallbackOutput: 'bad' } }),
    callSub('gs-main01-07', 'Call SUB 11 Place order', ids.sub11, [
      ['session_id', body('session_id'), 'string'], ['client_order_key', body('client_order_key'), 'string'], ['items', body('items'), 'array'],
      ['address', body('address'), 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    callSub('gs-main01-08', 'Call SUB 12 Change status', ids.sub12, [
      ['session_id', body('session_id'), 'string'], ['order_id', body('order_id'), 'string'], ['to_status', body('to_status'), 'string'],
      ['actor', body('actor'), 'string'], ['kill_switch', '={{ $json.kill_switch }}', 'boolean'], ['supabase_url', '={{ $json.supabase_url }}', 'string']]),
    respond('gs-main01-09', 'Respond result', '={{ $json.status_code }}', answer),
    respond('gs-main01-10', 'Respond 401', 401, '{"ok":false,"error":"unauthorized","message":"Missing or wrong demo token."}'),
    respond('gs-main01-11', 'Respond 503', 503, '{"ok":false,"error":"kill_switch","message":"Orders are paused. Please try again soon."}'),
    respond('gs-main01-12', 'Respond 400', 400, '{"ok":false,"error":"bad_action","message":"Unknown action."}'),
  ];
  const edges = [['Order webhook', 'Config'], ['Config', 'Check token'], ['Check token', 'Token ok?'],
    ['Token ok?', 'Kill switch?', 0], ['Token ok?', 'Respond 401', 1], ['Kill switch?', 'Respond 503', 0], ['Kill switch?', 'Route', 1],
    ['Route', 'Call SUB 11 Place order', 0], ['Route', 'Call SUB 12 Change status', 1], ['Route', 'Respond 400', 2],
    ['Call SUB 11 Place order', 'Respond result'], ['Call SUB 12 Change status', 'Respond result']];
  const sections = [
    { name: 'RECEIVE', what: 'The phone posts here. Body field "action" is place or status. The header x-gs-token carries the demo token.', needs: 'Path gs-order. Body: action and the fields of the SUB.', nodes: ['Order webhook'], color: 4 },
    { name: 'CONFIG', what: 'All tunables live here: the kill switch, the demo token and the database address.', needs: 'Config keys: kill_switch, demo_token, supabase_url.', nodes: ['Config'], color: 5 },
    { name: 'GATE', what: 'Wrong token gets 401. Kill switch on gets 503. Nothing else runs in both cases.', needs: 'Config: demo_token, kill_switch. Header x-gs-token.', nodes: ['Check token', 'Token ok?', 'Kill switch?'], color: 5 },
    { name: 'ROUTE', what: 'Pick the SUB workflow by the action field. Unknown action gets 400.', needs: 'Body field: action.', nodes: ['Route'], color: 5 },
    { name: 'PLACE ORDER', what: 'Call SUB 11. It writes the order and its first event.', needs: 'SUB 11 id. Body: session_id, client_order_key, items, address.', nodes: ['Call SUB 11 Place order'], color: 6 },
    { name: 'CHANGE STATUS', what: 'Call SUB 12. It moves the order one step and writes the event.', needs: 'SUB 12 id. Body: session_id, order_id, to_status, actor.', nodes: ['Call SUB 12 Change status'], color: 6 },
    { name: 'ANSWER', what: 'Send the SUB result back to the phone with its status code.', needs: 'The SUB output: status_code, ok, order.', nodes: ['Respond result'], color: 4 },
    { name: 'REFUSE', what: 'Answer the calls that must not go on: 401, 503 and 400.', needs: 'Nothing.', nodes: ['Respond 401', 'Respond 503', 'Respond 400'], color: 1 },
  ];
  const main01 = finish('GS MAIN 01 Order API', nodes, edges, sections, settings);

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
  return { sub11, sub12, main01, alert, STATUS_ROLES };
}

module.exports = { build, PLACEHOLDER };
