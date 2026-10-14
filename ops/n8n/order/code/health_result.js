// SUB 16, node "Health result": did Jev answer, and how fast. A Jev failure is a result for the health page, not a workflow error.
const prep = $('Prepare').first().json;
const res = $input.first().json || {};
let status = 'jev_off';
let cost = 0;
if (prep.use_jev) {
  status = 'jev_error';
  if (!res.error && res.statusCode === 200) {
    status = 'jev_bad_reply';
    const body = res.body && typeof res.body === 'object' ? res.body : {};
    cost = body.usage && typeof body.usage.cost === 'number' ? body.usage.cost : 0;
    let reply = null;
    try { reply = JSON.parse(body.choices[0].message.content); } catch (e) { reply = null; }
    if (reply && prep.options.includes(reply.choice)) status = 'ok';
  }
}
return [{ json: { ok: true, status_code: 200, cost, jev: { ok: status === 'ok', status, ms: prep.use_jev ? Math.max(0, Date.now() - prep.started_at) : null } } }];
