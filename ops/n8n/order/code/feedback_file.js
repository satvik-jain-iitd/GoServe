// SUB 18, node "Make file": the base64 picture becomes a JPEG file named date_role_id8.jpg for Google Drive.
const j = $input.first().json;
const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const name = day + '_' + j.row.role + '_' + String(j.id).slice(0, 8) + '.jpg';
const data = await this.helpers.prepareBinaryData(Buffer.from(j.image_b64, 'base64'), name, 'image/jpeg');
return [{ json: Object.assign({}, j, { image_b64: undefined, file_name: name }), binary: { data } }];
