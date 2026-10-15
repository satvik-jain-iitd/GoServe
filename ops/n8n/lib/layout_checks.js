// Geometry checks for sticky-note layouts (Satvik's rules, 12 Oct 2026; port of Miraya tests/test_pb_build.py, stricter).
// checkLayout(wf, sections) -> list of failure strings. wf = {nodes:[...]} with n8n stickyNote nodes; sections = [{name, nodes:[...]}] in the same order as the stickies.
const NODE_W = 200, NODE_H = 100, MIN_GAP = 160;
const rect = (n) => { const [x, y] = n.position; return n.type === 'n8n-nodes-base.stickyNote' ? [x, y, x + n.parameters.width, y + n.parameters.height] : [x, y, x + NODE_W, y + NODE_H]; };
const hit = (a, b) => !(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]);
const gap = (a, b) => Math.max(Math.max(b[0] - a[2], a[0] - b[2]), Math.max(b[1] - a[3], a[1] - b[3]));   // > 0 when apart; the larger axis gap
// text height the way n8n draws it: 9 px a char, 24 px a line, heading 40 px
const textHeight = (content, width) => { const cpl = Math.floor((width - 40) / 9); const lines = content.split('\n').filter(l => l.trim() !== '').slice(1).reduce((s, l) => s + Math.ceil(l.length / cpl), 0); return 40 + lines * 24 + 20; };
function checkLayout(wf, sections, opts) {
  opts = opts || {}; const loops = (opts.loops || []).map(l => l.join('>'));
  const fails = [], f = (c, m) => { if (!c) fails.push(m); };
  const stickies = wf.nodes.filter(n => n.type === 'n8n-nodes-base.stickyNote'), others = wf.nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote');
  const byName = Object.fromEntries(others.map(n => [n.name, n]));
  f(stickies.length === sections.length, stickies.length + ' stickies != ' + sections.length + ' sections');
  const owned = {};
  sections.forEach((s, i) => {
    const note = stickies[i]; if (!note) return; const c = note.parameters.content, r = rect(note);
    f(c.startsWith('## ' + s.name), s.name + ': content must start with "## <NAME>"');
    f(/\*\*What:\*\*/.test(c) && /\*\*Needs:\*\*/.test(c), s.name + ': content needs What and Needs lines');
    const longest = Math.max(...c.split(/\s+/).map(w => w.length)); f(note.parameters.width - 40 >= longest * 9, s.name + ': box too narrow for its longest word');
    const band = textHeight(c, note.parameters.width);
    for (const nn of s.nodes) {
      const n = byName[nn]; f(!!n, s.name + ': unknown node ' + nn); if (!n) continue;
      f(!owned[nn], nn + ' is in two sections'); owned[nn] = s.name;
      const nr = rect(n);
      f(nr[0] > r[0] && nr[2] < r[2] && nr[1] > r[1] && nr[3] < r[3], s.name + ': node "' + nn + '" not inside its box');
      f(nr[1] >= r[1] + band, s.name + ': node "' + nn + '" sits on the note text (needs y >= box top + ' + band + ')');
    }
    f(r[3] - r[1] >= band, s.name + ': box shorter than its text');
  });
  for (const n of others) f(owned[n.name], 'node "' + n.name + '" belongs to no section');
  const rs = stickies.map(rect);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    f(!hit(rs[i], rs[j]), 'boxes ' + (sections[i] || {}).name + ' and ' + (sections[j] || {}).name + ' overlap');
    f(gap(rs[i], rs[j]) >= MIN_GAP, 'boxes ' + (sections[i] || {}).name + ' and ' + (sections[j] || {}).name + ' closer than ' + MIN_GAP + ' px');
  }
  for (const n of others) { const nr = rect(n); sections.forEach((s, i) => { if (!s.nodes.includes(n.name) && rs[i] && hit(nr, rs[i])) fails.push('node "' + n.name + '" overlaps foreign box ' + s.name); }); }
  const nr = others.map(n => [n.name, rect(n)]);
  for (let i = 0; i < nr.length; i++) for (let j = i + 1; j < nr.length; j++) f(!hit(nr[i][1], nr[j][1]), 'nodes "' + nr[i][0] + '" and "' + nr[j][0] + '" overlap');

  // ---- flow rules (B12.4, Satvik 12 Oct 2026): left to right, no link through a foreign box or over note text, same-row alignment ----
  const secOf = {}; sections.forEach((s, i) => s.nodes.forEach(n => { secOf[n] = i; }));
  const links = [], aiLinks = []; for (const [from, byType] of Object.entries(wf.connections || {})) for (const [type, outs] of Object.entries(byType)) for (const out of outs) for (const c of out) if (byName[from] && byName[c.node]) (type === 'main' ? links : aiLinks).push([from, c.node]);
  const bandOf = sections.map((s, i) => stickies[i] ? textHeight(stickies[i].parameters.content, stickies[i].parameters.width) : 0);
  for (const [from, to] of links) {
    const a = secOf[from], b = secOf[to]; if (a === undefined || b === undefined || a === b || !rs[a] || !rs[b] || loops.includes(from + '>' + to)) continue;
    f(rs[b][0] >= rs[a][2] + MIN_GAP, 'link ' + from + ' -> ' + to + ' runs right to left or too close: box "' + sections[b].name + '" must sit at least ' + MIN_GAP + ' px right of "' + sections[a].name + '"');
    // n8n draws a link leaving the node sideways and entering the next node sideways: node -> box edge (flat), box edge -> box edge (the slope), box edge -> node (flat)
    const A = rect(byName[from]), B = rect(byName[to]), yA = (A[1] + A[3]) / 2, yB = (B[1] + B[3]) / 2, ex = rs[a][2], en = rs[b][0];
    const path = []; for (let t = 0; t <= 20; t++) path.push([A[2] + (ex - A[2]) * t / 20, yA]); for (let t = 1; t <= 100; t++) path.push([ex + (en - ex) * t / 100, yA + (yB - yA) * t / 100]); for (let t = 1; t <= 20; t++) path.push([en + (B[0] - en) * t / 20, yB]);
    for (let k = 0; k < sections.length; k++) { if (!rs[k] || k === a || k === b) continue; const r = rs[k];
      f(!path.some(([x, y]) => x > r[0] && x < r[2] && y > r[1] && y < r[3]), 'link ' + from + ' -> ' + to + ' runs through the box "' + sections[k].name + '"'); }
    for (const k of [a, b]) { const r = rs[k];
      f(!path.some(([x, y]) => x > r[0] && x < r[2] && y > r[1] && y < r[1] + bandOf[k]), 'link ' + from + ' -> ' + to + ' runs over the note text of "' + sections[k].name + '"'); }
  }
  // model / parser sub-nodes hang BELOW the node they serve, side by side (n8n draws their link from the bottom of the parent); no such link may run through another node
  for (const [child, parent] of aiLinks) { const C = byName[child].position, P = byName[parent].position;
    f(secOf[child] === secOf[parent] && C[1] > P[1] && C[0] >= P[0], 'sub-node ' + child + ' must sit below ' + parent + ' (same box, not left of it)');
    const path = []; for (let t = 0; t <= 100; t++) path.push([P[0] + 100 + (C[0] + 100 - P[0] - 100) * t / 100, P[1] + 100 + (C[1] - P[1] - 100) * t / 100]);
    for (const n of others) { if (n.name === child || n.name === parent) continue; const r = rect(n); if (path.some(([x, y]) => x > r[0] && x < r[2] && y > r[1] && y < r[3])) fails.push('sub-node link ' + parent + ' -> ' + child + ' runs through the node "' + n.name + '"'); } }
  // no link may run through a node that is not one of its two ends (a branch to another box must leave on its own row)
  const nodeRects = others.map(n => [n.name, rect(n)]);
  for (const [from, to] of links) {
    const A = rect(byName[from]), B = rect(byName[to]), yA = (A[1] + A[3]) / 2, yB = (B[1] + B[3]) / 2, a = secOf[from], b = secOf[to], path = [];
    if (a !== undefined && b !== undefined && a !== b && rs[a] && rs[b] && !loops.includes(from + '>' + to)) { const ex = rs[a][2], en = rs[b][0];
      for (let t = 0; t <= 20; t++) path.push([A[2] + (ex - A[2]) * t / 20, yA]); for (let t = 1; t <= 100; t++) path.push([ex + (en - ex) * t / 100, yA + (yB - yA) * t / 100]); for (let t = 1; t <= 20; t++) path.push([en + (B[0] - en) * t / 20, yB]);
    } else if (a === b) { for (let t = 0; t <= 100; t++) path.push([A[2] + (B[0] - A[2]) * t / 100, yA + (yB - yA) * t / 100]); }
    for (const [nn, r] of nodeRects) { if (nn === from || nn === to) continue; if (path.some(([x, y]) => x > r[0] && x < r[2] && y > r[1] && y < r[3])) fails.push('link ' + from + ' -> ' + to + ' runs through the node "' + nn + '"'); }
  }
  // boxes in one row share a top; if each of them has a single line of nodes, those lines are one line
  const rowsByTop = {}; sections.forEach((s, i) => { if (rs[i]) (rowsByTop[rs[i][1]] = rowsByTop[rs[i][1]] || []).push(i); });
  const nodeYs = (i) => [...new Set(sections[i].nodes.map(n => byName[n] && byName[n].position[1]))];
  for (const idxs of Object.values(rowsByTop)) { const single = idxs.filter(i => nodeYs(i).length === 1); if (single.length > 1) f(new Set(single.map(i => nodeYs(i)[0])).size === 1, 'boxes in one row do not share one node line: ' + single.map(i => sections[i].name).join(', ')); }
  return fails;
}
module.exports = { checkLayout, textHeight, NODE_W, NODE_H, MIN_GAP };
