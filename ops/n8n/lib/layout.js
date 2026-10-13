// Sticky-note layout for generated n8n workflows (rulebook B12; Satvik's rules 12 Oct 2026).
// layout({nodes, sections, edges, loops}) -> {nodes}: every node gets a position, and one stickyNote per section is added (first in the list, so it draws behind).
// B12.1-3: a box wraps the nodes of ONE step; the note text sits in a band at the top of the box and nodes start below it; boxes never overlap and keep GAP px apart.
// B12.4: the flow runs LEFT TO RIGHT. Column of a box = its depth in the flow (longest path over the links between boxes). A box never sits left of a box it receives from;
//   only links listed in `loops` may point left. Boxes of one column stack in rows (parallel branches). Rows are chosen so that a link which skips a column travels through a
//   row that holds no box, then so that links are as short as possible; the main flow stays on row 0. Boxes in one row share a top; their first nodes share one line.
// Positions come from here only, never from the UI.
const NW = 200, NH = 100, PITCH_X = 280, PITCH_Y = 160, PAD = 60, GAP = 200, MIN_W = 640, MAX_ROWS = 5;
// text height the way n8n draws it: about 9 px a char, 24 px a line, heading 40 px (kept in step with tests/lib/layout_checks.js)
const textHeight = (content, width) => { const cpl = Math.floor((width - 40) / 9); return 40 + content.split('\n').filter(l => l.trim() !== '').slice(1).reduce((s, l) => s + Math.ceil(l.length / cpl), 0) * 24 + 20; };
const perms = (items, rows) => { const out = []; const rec = (i, used, cur) => { if (i === items.length) { out.push(cur.slice()); return; } for (let r = 0; r < rows; r++) if (!used.has(r)) { used.add(r); cur.push(r); rec(i + 1, used, cur); cur.pop(); used.delete(r); } }; rec(0, new Set(), []); return out; };
function layout({ nodes, sections, edges, loops }) {
  const byName = Object.fromEntries(nodes.map(n => [n.name, n])), secOf = {}, skip = new Set((loops || []).map(l => l.join('>')));
  sections.forEach((s, i) => {
    if (!s.nodes || !s.nodes.length) throw new Error('section ' + s.name + ' has no nodes');
    for (const nn of s.nodes) { if (!byName[nn]) throw new Error('section ' + s.name + ': unknown node ' + nn); if (secOf[nn] !== undefined) throw new Error(nn + ' is in two sections'); secOf[nn] = i; }
  });
  for (const n of nodes) if (secOf[n.name] === undefined) throw new Error('node ' + n.name + ' belongs to no section');
  // ---- inside a box: layers left to right, branches stacked ----
  const boxes = sections.map((s, i) => {
    const inS = new Set(s.nodes), mainOnly = (edges || []).filter(e => !e[2] || e[2] === 'main'), ai = (edges || []).filter(e => e[2] && e[2] !== 'main' && inS.has(e[0]) && inS.has(e[1]));
    const es = mainOnly.filter(([a, b]) => inS.has(a) && inS.has(b) && !skip.has(a + '>' + b));   // model and parser links hang below their parent (placed after the main nodes)
    const aiKid = new Set(ai.map(e => e[0])), depth = Object.fromEntries(s.nodes.map(n => [n, 0]));
    for (let k = 0; k < s.nodes.length; k++) for (const [a, b] of es) if (depth[b] < depth[a] + 1 && depth[a] < s.nodes.length) depth[b] = depth[a] + 1;   // longest path, bounded for safety
    const kn = {}; for (const [kid, parent] of ai) depth[kid] = depth[parent] + (kn[parent] = kn[parent] === undefined ? 0 : kn[parent] + 1);   // sub-nodes sit side by side under the parent: the 1st under it, the next ones to its right
    const L = Math.max(...Object.values(depth)) + 1, layers = Array.from({ length: L }, () => []);
    for (const n of s.nodes) layers[depth[n]].push(n);
    // rows inside the box: the first node on row 0; a node follows its first parent on the same row, except that a branch which leaves the box keeps the parent's row and the
    // successors that stay in the box go below it (so an outgoing link never runs through the next node of its own box); several successors go on rows below each other
    const ext = {}; for (const [a, b] of mainOnly) if (inS.has(a) && !inS.has(b) && !skip.has(a + '>' + b)) ext[a] = (ext[a] || 0) + 1;
    const rowOf = {}, parentOf = {}, kids = {}; for (const [a, b] of es) { (kids[a] = kids[a] || []).push(b); if (!parentOf[b]) parentOf[b] = a; }
    for (const l of layers) for (const n of l) { if (aiKid.has(n)) continue; const p = parentOf[n]; let r = p === undefined ? 0 : rowOf[p] + (ext[p] ? 1 : 0) + kids[p].indexOf(n);
      while (l.some(m => m !== n && rowOf[m] === r)) r++; rowOf[n] = r; }
    for (const [kid, parent] of ai) { let r = rowOf[parent] + 1; const l = layers[depth[kid]]; while (l.some(m => m !== kid && rowOf[m] === r)) r++; rowOf[kid] = r; }
    const rows = Math.max(...Object.values(rowOf)) + 1, innerW = (L - 1) * PITCH_X + NW, innerH = (rows - 1) * PITCH_Y + NH;
    const content = '## ' + s.name + '\n**What:** ' + s.what + '\n**Needs:** ' + s.needs, width = Math.max(innerW + 2 * PAD, MIN_W);
    return { i, s, content, width, band: textHeight(content, width), innerH, layers, rows, rowOf };
  });
  // ---- columns: depth in the flow between boxes ----
  const links = new Set(); for (const [a, b] of (edges || [])) { const x = secOf[a], y = secOf[b]; if (x !== undefined && y !== undefined && x !== y && !skip.has(a + '>' + b)) links.add(x + '>' + y); }
  const pairs = [...links].map(l => l.split('>').map(Number)), col = sections.map(() => 0);
  for (let k = 0; k < sections.length; k++) for (const [a, b] of pairs) if (col[b] < col[a] + 1 && col[a] < sections.length) col[b] = col[a] + 1;
  const ncol = Math.max(...col) + 1, cols = Array.from({ length: ncol }, (_, c) => boxes.filter(b => col[b.i] === c));
  // ---- rows: per column, left to right: no link through a box, then short links, then row 0 first ----
  const R = Math.min(MAX_ROWS, Math.max(...cols.map(c => c.length)) + 1), row = {};
  for (let c = 0; c < ncol; c++) {
    const K = cols[c]; let best = null;
    for (const p of perms(K, Math.max(R, K.length))) {
      let cross = 0, dist = 0; K.forEach((b, k) => { for (const [a, t] of pairs) if (t === b.i) { const rowA = row[a], cA = col[a]; dist += Math.abs(p[k] - rowA);
        for (let m = cA + 1; m < c; m++) { const yl = rowA + (p[k] - rowA) * (m - cA) / (c - cA); if (cols[m].some(x => Math.abs(row[x.i] - yl) < 0.6)) cross++; } } });
      // look ahead: a link from an earlier box to a later column passes THIS column on its own row, so no box here may sit on that row
      K.forEach((b, k) => { for (const [a2, t] of pairs) if (col[a2] < c && col[t] > c && p[k] === row[a2]) cross++; });
      const cost = cross * 1000 + dist * 10 + p.reduce((s, v) => s + v, 0);
      if (!best || cost < best.cost) best = { cost, p };
    }
    K.forEach((b, k) => { row[b.i] = best.p[k]; });
  }
  // ---- geometry: column x from the widest box so far, row y from the tallest box so far; one text band per row so first nodes line up ----
  const nrow = Math.max(...Object.values(row)) + 1, rowBand = Array(nrow).fill(0), colW = Array(ncol).fill(0), rowH = Array(nrow).fill(0);
  for (const b of boxes) { rowBand[row[b.i]] = Math.max(rowBand[row[b.i]], b.band); colW[col[b.i]] = Math.max(colW[col[b.i]], b.width); }
  for (const b of boxes) { b.height = rowBand[row[b.i]] + PAD + b.innerH + PAD; rowH[row[b.i]] = Math.max(rowH[row[b.i]], b.height); }
  const colX = [], rowY = []; let x = 0, y = 0; for (let c = 0; c < ncol; c++) { colX[c] = x; x += colW[c] + GAP; } for (let r = 0; r < nrow; r++) { rowY[r] = y; y += rowH[r] + (rowH[r] ? GAP : 0); }
  const placed = {};
  for (const b of boxes) { b.x = colX[col[b.i]]; b.y = rowY[row[b.i]];
    b.layers.forEach((l, li) => l.forEach(nn => { placed[nn] = [b.x + PAD + li * PITCH_X, b.y + rowBand[row[b.i]] + PAD + b.rowOf[nn] * PITCH_Y]; })); }
  const stickies = boxes.map((b, i) => ({ parameters: { content: b.content, width: b.width, height: b.height, color: b.s.color || 4 }, name: 'Sticky: ' + b.s.name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [b.x, b.y], id: 'gs-note-' + String(i + 1).padStart(2, '0') }));
  return { nodes: stickies.concat(nodes.map(n => Object.assign({}, n, { position: placed[n.name] }))) };
}
module.exports = { layout, textHeight, NW, NH, PITCH_X, PITCH_Y, PAD, GAP };
