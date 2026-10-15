// SUB 17, node "Build message": one short Telegram message for the owner: first lines, kind of work, order, and the Drive link or why there is none.
const s = $('Check saved').first().json;
const up = $('Upload to Drive');
let picture = 'no picture';
if (s.has_image) {
  const f = s.drive_ready && up.isExecuted ? up.first().json : null;
  picture = f && f.id ? 'https://drive.google.com/file/d/' + f.id + '/view' : 'picture not saved (' + (s.drive_ready ? 'Drive failed' : 'Drive folder not set') + ')';
}
const r = s.row;
const text = 'New feedback (' + s.env + ') from ' + r.role + '\n"' + r.text.slice(0, 300) + '"\nDoing: ' + r.doing + ' · Order: ' + (r.order_id || 'none') + ' · Screen: ' + r.screen + '\nPicture: ' + picture + '\nId: ' + s.id;
return [{ json: { text, chat_id: s.chat_id } }];
