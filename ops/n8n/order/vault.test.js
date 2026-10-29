// Story (vault, owner 29 Oct 2026): the n8n scripts read ~/Desktop/Secrets/goserve/goserve.env first, then the old shared file. Uses a temporary HOME.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const withHome = (files, fn) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-vault-'));
  const sec = path.join(home, 'Desktop/Secrets');
  fs.mkdirSync(path.join(sec, 'goserve'), { recursive: true });
  for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(sec, f), text);
  const old = process.env.HOME;
  process.env.HOME = home;
  delete require.cache[require.resolve('../lib/vault')];
  try { return fn(require('../lib/vault'), sec); } finally { process.env.HOME = old; delete require.cache[require.resolve('../lib/vault')]; }
};

test('V1 the goserve file wins over the old file', () => {
  withHome({ 'goserve/goserve.env': 'KEY=new\n', '02_databases.env': 'KEY=old\n' }, (v) => assert.equal(v.get('02_databases.env', 'KEY'), 'new'));
});
test('V2 a key only in the old file is still found; a key nowhere is null', () => {
  withHome({ 'goserve/goserve.env': 'OTHER=1\n', '04_integrations.env': 'KEY=old\n' }, (v) => {
    assert.equal(v.get('04_integrations.env', 'KEY'), 'old');
    assert.equal(v.get('04_integrations.env', 'NOPE'), null);
  });
});
test('V3 without the goserve file the old file is used, and a comment line is not a key', () => {
  withHome({ '04_integrations.env': '# KEY=commented\nKEY=real\n' }, (v) => assert.equal(v.get('04_integrations.env', 'KEY'), 'real'));
});
test('V4 a new secret is appended to the goserve file when it exists, else to the old file', () => {
  withHome({ 'goserve/goserve.env': 'A=1\n', '04_integrations.env': 'B=2\n' }, (v, sec) => {
    v.append('04_integrations.env', 'C=3\n');
    assert.match(fs.readFileSync(path.join(sec, 'goserve/goserve.env'), 'utf8'), /C=3/);
    assert.doesNotMatch(fs.readFileSync(path.join(sec, '04_integrations.env'), 'utf8'), /C=3/);
  });
  withHome({ '04_integrations.env': 'B=2\n' }, (v, sec) => {
    fs.rmSync(path.join(sec, 'goserve'), { recursive: true });
    v.append('04_integrations.env', 'C=3\n');
    assert.match(fs.readFileSync(path.join(sec, '04_integrations.env'), 'utf8'), /C=3/);
  });
});
