// SUB 20, node "Expand": one item per subscription, with the VAPID claims for the push service of that endpoint (RFC 8292: aud is its origin, exp within 24 hours).
// Only https endpoints are used.
const g = $('Guard').first().json;
const targets = ($input.first().json.body || {}).targets || [];
const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
const out = [];
for (const t of targets) {
  const m = /^(https:\/\/[^\/?#\s]+)/.exec(String(t.endpoint));   // the origin, by hand: the code sandbox has no URL class (found on the live run, 23 Oct 2026)
  if (!m) continue;
  out.push({ json: { endpoint: t.endpoint, vapid_public_key: g.vapid_public_key, claims: { aud: m[1], exp, sub: g.vapid_subject } } });
}
return out;
