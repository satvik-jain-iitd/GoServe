// MAIN 90, node "Limit alert": one message when any health line is OVER (80% of a free limit) or UNHEALTHY; nothing when all is well (story #488).
const h = $('Call SUB 94 Health and cost numbers').first().json;
if (!h || !h.ok || !Array.isArray(h.lines)) return [];
const bad = h.lines.filter((l) => / · OVER/.test(l) || /UNHEALTHY/.test(l));
if (!bad.length) return [];
return [{ json: { chat_id: $('Config').first().json.chat_id, text: 'GoServe limit warning:\n' + bad.join('\n') } }];
