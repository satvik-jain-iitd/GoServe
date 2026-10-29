// The GoServe vault reader for the n8n scripts (owner, 29 Oct 2026). Every GoServe key lives in ~/Desktop/Secrets/goserve/goserve.env; the older shared files no longer hold
// GoServe keys (the owner removed the copies on 29 Oct 2026), only the account-level ones (SUPABASE_ACCESS_TOKEN, UPTIMEROBOT_API_KEY). Look in goserve.env first, then in the old file. Nothing here prints a value.
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = () => path.join(os.homedir(), 'Desktop', 'Secrets');
const goserve = () => path.join(root(), 'goserve', 'goserve.env');

function read(oldFile) {
  let text = '';
  for (const p of [goserve(), path.join(root(), oldFile)]) {
    try { text += fs.readFileSync(p, 'utf8').replace(/\n*$/, '\n'); } catch { /* not there */ }
  }
  return text;
}

const get = (oldFile, key) => { const m = read(oldFile).match(new RegExp('^' + key + '=(\\S+)', 'm')); return m ? m[1] : null; };

// A new secret goes to goserve.env when it exists, otherwise to the old file.
function append(oldFile, text) {
  fs.appendFileSync(fs.existsSync(goserve()) ? goserve() : path.join(root(), oldFile), text);
}

module.exports = { read, get, append };
