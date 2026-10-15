// SUB 17, node "Guard": kill switch, then the shape of the report. Nothing is written here. Server limits are wider than the phone's (text 2000, picture 2 MB).
const j = $input.first().json;
const refuse = (status_code, error, message) => [{ json: { ok: false, status_code, error, message } }];
if (j.kill_switch === true) return refuse(503, 'kill_switch', 'Orders are paused. Please try again soon.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ['customer', 'kitchen', 'rider', 'ops', 'console'];
const doings = ['ordering', 'cooking', 'delivering', 'watching ops', 'installing', 'other'];
const text = typeof j.text === 'string' ? j.text.trim() : '';
const image = typeof j.image_b64 === 'string' ? j.image_b64 : '';
const orderId = j.order_id === '' || j.order_id == null ? null : String(j.order_id);
const ctx = j.context;
const bad = text === '' || text.length > 2000
  || typeof j.session_id !== 'string' || j.session_id.trim() === '' || j.session_id.length > 64
  || !uuid.test(String(j.kitchen_id)) || !roles.includes(j.role) || !doings.includes(j.doing)
  || typeof j.screen !== 'string' || j.screen === '' || j.screen.length > 200
  || (orderId !== null && !uuid.test(orderId))
  || typeof ctx !== 'object' || ctx === null || Array.isArray(ctx) || JSON.stringify(ctx).length > 20000
  || image.length > 2000000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image);
if (bad) return refuse(400, 'invalid_request', 'The report is not valid.');
const folder = String(j.drive_folder_id || '');
return [{ json: { ok: true, supabase_url: j.supabase_url,
  row: { kitchen_id: j.kitchen_id, session_id: j.session_id, role: j.role, screen: j.screen, order_id: orderId, doing: j.doing, text, context: ctx },
  image_b64: image, has_image: image !== '', drive_ready: folder !== '' && folder !== 'REPLACE_AT_DEPLOY', drive_folder_id: folder, chat_id: String(j.chat_id || ''), env: String(j.env || 'dev') } }];
