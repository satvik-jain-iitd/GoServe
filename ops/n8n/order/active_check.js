// Story #920: a timer MAIN that is on in one env and off in the other is how dev stayed silent for two days (MAIN 34 off since 5 Nov).
// deploy.js never changes the active flag, so a hand switch stays. MAIN 31 (simulator tick) is left out: prod keeps the simulator off on purpose.
const { NAMES, namesFor } = require('./deploy');
const TIMERS = ['main33', 'main34', 'main90', 'main92', 'main93'];

// list: the workflows from n8n. Returns one line per mismatch, naming the workflow.
function activeMismatches(list) {
  const dev = namesFor('dev'), prod = namesFor('prod'), by = (n) => list.find((w) => w.name === n);
  const out = [];
  for (const k of TIMERS) {
    const d = by(dev[k]), p = by(prod[k]);
    if (d && p && !!d.active !== !!p.active) out.push(`${NAMES[k]}: dev=${d.active ? 'on' : 'off'}, prod=${p.active ? 'on' : 'off'}`);
  }
  return out;
}

module.exports = { activeMismatches, TIMERS };
