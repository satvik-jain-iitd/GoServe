// SUB 11 and SUB 12, node "Shape result": turns the database answer into the SUB's output (the contract in docs/integrations/n8n-order-workflows.md).
// Database messages are mapped to short codes. Raw database text never goes back to the phone.
const res = $input.first().json;
const body = res.body && typeof res.body === 'object' ? res.body : {};
const out = (status_code, extra) => [{ json: Object.assign({ ok: status_code < 300, status_code }, extra) }];
if (res.statusCode === 200 && body.already_done === true && body.order && typeof body.order === 'object') return out(200, { order: body.order, already_done: true });   // a repeat Yes: nothing changed
if (res.statusCode === 200 && Array.isArray(body.riders)) return out(200, { riders: body.riders });   // SUB 21: the riders that are online
if (res.statusCode === 200 && body.order && typeof body.order === 'object') {
  return out(body.created === true ? 201 : 200, { order: body.order, created: body.created === true });
}
const msg = String(body.message || '');
if (msg === 'session_order_cap') return out(429, { error: 'session_order_cap', message: 'Too many orders in this demo session.' });
if (msg === 'order_not_found') return out(404, { error: 'order_not_found', message: 'No such order in this session.' });
if (msg === 'not_ready' || msg === 'rider_not_available') return out(409, { error: msg, message: msg === 'not_ready' ? 'The order is not ready yet.' : 'That rider is not available.' });
if (msg === 'event_exists' || msg === 'already_done') return out(409, { error: 'already_done', message: 'Already done.' });
if (msg.startsWith('illegal status step') || msg.startsWith('illegal_event')) return out(409, { error: 'illegal_step', message: 'That step is not allowed now.' });
if (msg.startsWith('invalid_status') || msg.startsWith('invalid_event')) return out(400, { error: msg.split(':')[0], message: msg.startsWith('invalid_event') ? 'Unknown event.' : 'Unknown status.' });
if (/^invalid_(item|address|request)/.test(msg)) return out(400, { error: msg.split(':')[0], message: 'The order is not valid.' });
return out(502, { error: 'database_error', message: 'Something went wrong. Please try again.' });
