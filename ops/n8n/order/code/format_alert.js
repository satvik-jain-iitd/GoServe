// ERR 00, node "Format message": a short Telegram message for the owner. User text is escaped for Telegram HTML (rulebook 72).
const e = $input.first().json;
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ex = e.execution || {};
const text = ['<b>GoServe workflow error</b>', 'Workflow: ' + esc((e.workflow || {}).name), 'Node: ' + esc(ex.lastNodeExecuted),
  'Error: ' + esc((ex.error || {}).message), 'Execution: ' + esc(ex.id)].join('\n');
return [{ json: { chat_id: e.chat_id, text } }];
