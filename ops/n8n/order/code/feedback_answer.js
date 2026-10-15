// SUB 17, node "Answer": the report is saved (Drive and Telegram are best effort), so the phone gets 201 and the new id.
return [{ json: { ok: true, status_code: 201, id: $('Check saved').first().json.id } }];
