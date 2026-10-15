// SUB 17, node "Build message": one short Telegram message (HTML) for the owner: first lines, kind of work, order, and the Drive link or why there is none.
// What the tester typed is escaped (&, <, >) so Telegram never refuses the message.
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const s = $('Check saved').first().json;
const up = $('Upload to Drive');
let picture = 'no picture';
if (s.has_image) {
  const f = s.drive_ready && up.isExecuted ? up.first().json : null;
  picture = f && f.id ? 'https://drive.google.com/file/d/' + f.id + '/view' : 'picture not saved (' + (s.drive_ready ? 'Drive failed' : 'Drive folder not set') + ')';
}
const r = s.row;
const text = 'New feedback (' + esc(s.env) + ') from ' + esc(r.role) + '\n"' + esc(r.text.slice(0, 300)) + '"\nDoing: ' + esc(r.doing) + ' · Order: ' + (r.order_id || 'none') + ' · Screen: ' + esc(r.screen) + '\nPicture: ' + esc(picture) + '\nId: ' + s.id;
return [{ json: { text, chat_id: s.chat_id } }];
