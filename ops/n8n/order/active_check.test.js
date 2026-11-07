// Story #920: a timer MAIN that is active in one env and off in the other fails the live check, and the message names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { activeMismatches } = require('./active_check');

const list = (dev, prod) => [
  { name: 'GS MAIN 34 Push drain', active: dev }, { name: 'GS MAIN 34 Push drain PROD', active: prod },
  { name: 'GS MAIN 90 Daily scorecard', active: true }, { name: 'GS MAIN 90 Daily scorecard PROD', active: true },
];

test('#920 dev off and prod on names MAIN 34', () => {
  const m = activeMismatches(list(false, true));
  assert.equal(m.length, 1);
  assert.match(m[0], /MAIN 34/);
  assert.match(m[0], /dev=off/);
  assert.match(m[0], /prod=on/);
});

test('#920 the same on both sides is clean', () => {
  assert.deepEqual(activeMismatches(list(true, true)), []);
  assert.deepEqual(activeMismatches(list(false, false)), []);
});
