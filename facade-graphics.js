// Фасадна суперграфіка: розкладка ліній в одній координаті обходу периметра s (м).
// Використовується і розгортками, і 3D-моделлю.
export const COL = { violet: '#7B3FE4', blue: '#3A56F0', yellow: '#F2E01C', green: '#7ED321' };
export const WID = { violet: 0.55, blue: 0.38, yellow: 0.18, green: 0.15 };
export const GND = -1.58, PL = -0.38, PAR = 0.55, PERIM = 334.4, PANEL = 1.2;
export const CLAD = '#1C1D21', SEAM = '#3A3D43';
const T2 = 7.42, T3 = 10.8;

// ---------- геометрія ----------
function path(s, y) {
  const pts = [[s, y]];
  const a = {
    to(x) { s = x; pts.push([s, y]); return a; },
    d(dy) { s += Math.abs(dy); y += dy; pts.push([s, y]); return a; },
    v(dy) { y += dy; pts.push([s, y]); return a; },
    pts,
  };
  return a;
}
function from(pts) { const p = path(...pts[pts.length - 1]); p.pts.splice(0, 1, ...pts); return p; }

export function offsetPoly(pts, d) {
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  return pts.map((p, i) => {
    const n1 = i > 0 ? nrm(pts[i - 1], p) : null, n2 = i < pts.length - 1 ? nrm(p, pts[i + 1]) : null;
    if (!n1) return [p[0] + n2[0] * d, p[1] + n2[1] * d];
    if (!n2) return [p[0] + n1[0] * d, p[1] + n1[1] * d];
    const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}
// обрізати ламану (монотонну по s) до діапазону [a, b]
function clipS(pts, a, b) {
  const out = [];
  const push = (q) => { const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-6) out.push(q); };
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    if (q[0] < a || p[0] > b) continue;
    const at = (x) => [x, p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0])];
    push(p[0] < a ? at(a) : p);
    push(q[0] > b ? at(b) : q);
  }
  return out;
}
// смуга постійної ширини з міттерними кутами; кінці — прямий або 45° зріз
function linePoly(l) {
  const w = WID[l.c], h = w / 2, P = l.pts;
  const Lf = offsetPoly(P, h), R = offsetPoly(P, -h);
  const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy); return [dx / n, dy / n]; };
  if (l.cutEnd) {
    const t = dir(P[P.length - 2], P[P.length - 1]), n = P.length - 1, k = h * l.cutEnd;
    Lf[n] = [Lf[n][0] + t[0] * k, Lf[n][1] + t[1] * k]; R[n] = [R[n][0] - t[0] * k, R[n][1] - t[1] * k];
  }
  if (l.cutStart) {
    const t = dir(P[0], P[1]), k = h * l.cutStart;
    Lf[0] = [Lf[0][0] + t[0] * k, Lf[0][1] + t[1] * k]; R[0] = [R[0][0] - t[0] * k, R[0][1] - t[1] * k];
  }
  return [...Lf, ...R.reverse()];
}

// ---------- фасади (u — зліва направо, дивлячись ззовні; y — абсолютна висота, м) ----------
const grid = (c0, step, n) => Array.from({ length: n }, (_, i) => +(c0 + step * i).toFixed(2));
const wins = (cs, floors, w = 1.8, h = 2.0) => cs.flatMap(c => floors.map(y => ({ k: 'win', u0: c - w / 2, u1: c + w / 2, y0: y, y1: y + h })));
const LINK_COLS = [2, 4.8, 7.6, 10.4, 13.2, 16];
const frontOpen = [
  ...wins(grid(4.75, 3, 12), [3.72]),
  ...grid(4.75, 3, 8).map((c, i) => ({ k: 'win', u0: c - 0.9, u1: c + 0.9, y0: i ? 0.34 : 0.84, y1: 2.34 })),
  { k: 'win', u0: 33.85, u1: 35.65, y0: 1.1, y1: 2.65 }, { k: 'win', u0: 36.85, u1: 38.65, y0: 1.1, y1: 2.65 },
  { k: 'door', u0: 27.45, u1: 30.2, y0: PL, y1: 2.85, cx: 28.9 }, { k: 'door', u0: 30.65, u1: 33.55, y0: PL, y1: 2.85, cx: 32.1 },
  { k: 'canopy', u0: 26.88, u1: 39.87, y0: 2.85, y1: 3.4 },
  ...grid(40.1, 6, 4).map(u => ({ k: 'curtain', u0: u, u1: u + 4.6, y0: 0.3, y1: 5.72 })),
  { k: 'disc', u0: 63.72, u1: 65.58, y0: 5.22, y1: 7.08 },
];

// face — параметри для 3D (напрям, фіксована координата, a..b як у face() сцени)
export const FACADES = [
  { id: 'F_S', n: '01', name: 'Головний фасад', len: 66.6, top: T2, segs: [{ u0: 0, u1: 66.6, s0: 0 }], open: frontOpen },
  { id: 'F_E', n: '02', name: 'Торець, схід', len: 14, top: T2, segs: [{ u0: 0, u1: 14, s0: 66.6 }], open: [] },
  { id: 'HB', n: '03', name: 'Тил блоку залів', len: 27.3, top: T2, segs: [{ u0: 0, u1: 27.3, s0: 80.6 }], open: [] },
  { id: 'KE', n: '04', name: 'Перехід, схід', len: 18, top: T2, segs: [{ u0: 0, u1: 18, s0: 107.9 }], open: wins(LINK_COLS, [0.34, 3.72]) },
  { id: 'RS', n: '05', name: 'Задній корпус, двір', len: 66.6, top: T3, segs: [{ u0: 0, u1: 27.3, s0: 247.8 }, { u0: 39.3, u1: 66.6, s0: 86.6 }],
    open: wins(grid(3, 3, 8).concat(grid(42, 3, 8)), [0.34, 3.72, 7.10]), link: { u0: 27.3, u1: 39.3, top: T2 + PAR } },
  { id: 'RE', n: '06', name: 'Торець заднього корпусу, схід', len: 14, top: T3, segs: [{ u0: 0, u1: 14, s0: 153.2 }], open: [] },
  { id: 'RN', n: '07', name: 'Задній корпус, північ', len: 66.6, top: T3, segs: [{ u0: 0, u1: 66.6, s0: 167.2 }], open: wins(grid(3.6, 3, 21), [0.34, 3.72, 7.10]) },
  { id: 'RW', n: '08', name: 'Торець заднього корпусу, захід', len: 14, top: T3, segs: [{ u0: 0, u1: 14, s0: 233.8 }], open: [] },
  { id: 'KW', n: '09', name: 'Перехід, захід', len: 18, top: T2, segs: [{ u0: 0, u1: 18, s0: 275.1 }], open: wins(LINK_COLS, [0.34, 3.72]) },
  { id: 'CB', n: '10', name: 'Тил класів', len: 27.3, top: T2, segs: [{ u0: 0, u1: 27.3, s0: 293.1 }], open: wins(grid(4.55, 3, 7), [0.34, 3.72]) },
  { id: 'F_W', n: '11', name: 'Торець, захід', len: 14, top: T2, segs: [{ u0: 0, u1: 14, s0: 320.4 }], open: [] },
];
export const byId = Object.fromEntries(FACADES.map(f => [f.id, f]));

// ---------- розкладка ліній ----------
export const LINES = [];
const add = (c, pts, o = {}) => LINES.push({ c, pts, ...o });

// A: синя від північного фасаду через західний торець, двір і тил класів — на головний фасад;
//    на західному торці до неї стають фіолетова (впритул) і лайм (з зазором)
const bA = path(211.2, -0.02).to(235.8).d(3.05).to(241.8).d(3.38).to(324.0).d(-3.105).to(345.0).d(3.54).to(355.0).d(-3.54).to(360.3).pts;
add('blue', bA, { cutEnd: 1 });
add('violet', clipS(offsetPoly(bA, -0.465), 321.2, 360.3), { cutEnd: 1 });
add('green', clipS(offsetPoly(bA, 0.465), 234.3, 330.0), { cutEnd: 1 });
add('yellow', path(326.4, -0.02).to(360.9).pts);

// H: фіолетова від блоку залів — вниз простінком, через східний торець Z-подібно, навколо заднього корпусу
const vH = path(41.2, 6.5).to(51.4).v(-6.54).to(69.1).d(3.24).to(75.6).d(3.0).to(86.6).d(-6.24)
  .to(154.7).d(6.45).to(175.2).d(-6.45).to(201.2).d(3.07).to(213.2).d(3.38).to(237.8).d(3.54).to(268.3).pts;
add('violet', vH, { cutStart: 1, cutEnd: 1 });
add('yellow', [[43.0, 7.065], [62.4, 7.065]], { cutEnd: -1 });
// синя стає поруч з фіолетовою на торці й іде прямо, коли та повертає вниз
add('blue', from(offsetPoly(clipS(vH, 72.8, 86.6), 0.665)).to(132.9).d(3.085).to(191.2).d(-3.54).to(207.2).pts, { cutEnd: 1 });
// лайм над фіолетовою на торці заднього корпусу, відокремлюється на північному фасаді
add('green', from(offsetPoly(clipS(vH, 156.2, 175.2), 0.55)).to(186.7).pts, { cutEnd: 1 });

// Y: жовта + лайм з тилу залів, через перехід у двір; жовта піднімається, лайм іде прямо
const yB = path(92.6, 4.4).to(100.1).d(-1.19).to(139.9).d(3.29).to(153.7).d(2.9).to(236.6).pts;
add('yellow', yB, { cutEnd: 1 });
add('green', from(offsetPoly(clipS(yB, 92.6, 139.9), -0.365)).to(143.9).pts);
// жовта у західному дворі: від цоколя на міжповерховий пояс
add('yellow', path(259.8, -0.02).to(282.1).d(3.14).to(318.6).pts, { cutEnd: 1 });
// пара на східному торці головного корпусу
const yE = path(67.1, 6.8).to(70.1).d(-1.8).to(74.2).pts;
add('yellow', yE, { cutEnd: 1 });
add('green', offsetPoly(yE, -0.365), { cutEnd: 1 });

// акценти біля парапету й короткі відрізки
add('green', [[1.05, 6.55], [1.5, 7.0], [5.5, 7.0], [5.95, 6.55]]);
add('green', [[30.0, 7.05], [34.0, 7.05], [34.45, 6.6]]);
add('green', [[197.2, 9.9], [197.65, 10.35], [201.2, 10.35], [201.65, 9.9]]);
add('green', [[270.3, 10.4], [273.6, 10.4], [274.05, 9.95]]);
add('green', [[219.5, 3.03], [223.0, 3.03]], { cutStart: 1, cutEnd: 1 });
add('violet', [[260.8, 3.03], [264.3, 3.03]], { cutStart: -1, cutEnd: 1 });

export const SHAPES = [
  { c: 'blue', pts: [[38.2, 7.42], [40.0, 7.42], [40.6, 6.82], [38.8, 6.82]] },
  { c: 'blue', pts: [[129.9, 10.8], [132.3, 10.8], [131.7, 10.2], [130.5, 10.2]] },
  { c: 'blue', pts: [[222.2, 10.8], [224.0, 10.8], [224.6, 10.2], [222.8, 10.2]] },
  { c: 'blue', pts: [[329.4, 7.42], [331.2, 7.42], [331.8, 6.82], [330.0, 6.82]] },
];
const ORDER = { violet: 0, blue: 1, yellow: 2, green: 3 };
export const POLYS = [...LINES.map(l => ({ c: l.c, pts: linePoly(l) })), ...SHAPES]
  .map((p, i) => ({ ...p, i, s0: Math.min(...p.pts.map(q => q[0])), s1: Math.max(...p.pts.map(q => q[0])) }));

// полігони в локальних координатах сегмента фасаду
export function polysFor(seg) {
  const out = [];
  for (const p of POLYS) for (const k of [-1, 0, 1]) {
    const sh = seg.s0 + k * PERIM;
    if (p.s1 - sh < seg.u0 || p.s0 - sh > seg.u1) continue;
    out.push({ c: p.c, pts: p.pts.map(([s, y]) => [s - sh, y]) });
  }
  return out;
}

// ---------- малювання ----------
export function drawFacade(cv, f, o = {}) {
  const u0 = o.u0 ?? 0, u1 = o.u1 ?? f.len, px = o.px ?? 40, lo = !!o.linesOnly;
  const yHi = lo ? f.top : f.top + PAR, yLo = lo ? PL : GND;
  cv.width = Math.round((u1 - u0) * px); cv.height = Math.round((yHi - yLo) * px);
  const c = cv.getContext('2d');
  const X = u => (u - u0) * px, Y = y => (yHi - y) * px;
  const R = (a, b, y0, y1, col) => { c.fillStyle = col; c.fillRect(X(a), Y(y1), (b - a) * px, (y1 - y0) * px); };
  const lw = Math.max(1, 0.01 * px);
  const seams = () => {
    for (let u = Math.ceil(u0 / PANEL) * PANEL; u <= u1; u += PANEL) c.fillRect(X(u) - lw / 2, Y(f.top + PAR), lw, (f.top + PAR - PL) * px);
    for (let y = PL + PANEL; y < f.top - 0.05; y += PANEL) c.fillRect(0, Y(y) - lw / 2, cv.width, lw);
    c.fillRect(0, Y(f.top) - lw / 2, cv.width, lw);
  };
  const linePath = new Path2D();
  const drawLines = () => {
    for (const seg of f.segs) {
      if (seg.u1 < u0 || seg.u0 > u1) continue;
      c.save();
      c.beginPath(); c.rect(X(seg.u0), Y(f.top), (seg.u1 - seg.u0) * px, (f.top - PL) * px); c.clip();
      for (const p of polysFor(seg).sort((a, b) => ORDER[a.c] - ORDER[b.c])) {
        const pp = new Path2D();
        p.pts.forEach(([u, y], i) => i ? pp.lineTo(X(u), Y(y)) : pp.moveTo(X(u), Y(y)));
        pp.closePath();
        c.fillStyle = COL[p.c]; c.fill(pp);
        linePath.addPath(pp);
      }
      c.restore();
    }
  };

  if (lo) {
    drawLines();
    c.globalCompositeOperation = 'destination-out';
    for (const w of f.open) R(w.u0, w.u1, w.y0, w.y1, '#000');
    if (f.link) R(f.link.u0, f.link.u1, PL, f.link.top, '#000');
    c.globalCompositeOperation = 'source-over';
    return cv;
  }

  R(u0, u1, PL, f.top + PAR, CLAD);
  c.fillStyle = SEAM; seams();
  drawLines();
  c.save(); c.clip(linePath); c.fillStyle = 'rgba(0,0,0,0.32)'; seams(); c.restore();
  R(u0, u1, f.top + PAR - 0.06, f.top + PAR, '#C9CCD0');
  R(u0, u1, GND, PL, '#6f4a41');

  const FR = '#F2EFE9', GL = '#8FA3A9';
  for (const w of f.open) {
    if (w.u1 < u0 || w.u0 > u1) continue;
    if (w.k === 'win') {
      R(w.u0 - 0.12, w.u1 + 0.12, w.y0 - 0.09, w.y0, '#E2DFD8');
      R(w.u0, w.u1, w.y0, w.y1, FR);
      R(w.u0 + 0.09, w.u1 - 0.09, w.y0 + 0.09, w.y1 - 0.09, GL);
      R(w.u0, w.u1, w.y1 - 0.55, w.y1 - 0.48, FR);
      const m = (w.u0 + w.u1) / 2; R(m - 0.035, m + 0.035, w.y0, w.y1 - 0.55, FR);
    } else if (w.k === 'curtain') {
      R(w.u0, w.u1, w.y0, w.y1, FR);
      R(w.u0 + 0.11, w.u1 - 0.11, w.y0 + 0.11, w.y1 - 0.11, GL);
      const W = w.u1 - w.u0, H = w.y1 - w.y0;
      for (let k = 1; k <= 2; k++) { const u = w.u0 + W * k / 3; R(u - 0.045, u + 0.045, w.y0, w.y1, FR); }
      for (let r = 1; r <= 3; r++) { const y = w.y0 + 0.55 + (H - 0.55) * (r - 1) / 3; R(w.u0, w.u1, y, y + 0.09, FR); }
    } else if (w.k === 'door') {
      R(w.u0, w.u1, w.y0, w.y1, '#2B2C31');
      R(w.cx - 1.15, w.cx + 1.15, PL, 2.65, FR);
      R(w.cx - 1.06, w.cx - 0.02, PL + 0.5, 2.56, GL);
      R(w.cx + 0.02, w.cx + 1.06, PL + 0.5, 2.56, GL);
    } else if (w.k === 'canopy') {
      R(w.u0, w.u1, w.y0, w.y1, FR);
    } else if (w.k === 'disc') {
      const cx = X((w.u0 + w.u1) / 2), cy = Y((w.y0 + w.y1) / 2), r = (w.u1 - w.u0) / 2 * px;
      c.fillStyle = '#6cb033'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
      c.fillStyle = '#F6F4F0'; c.beginPath(); c.arc(cx, cy, r * 0.88, 0, 7); c.fill();
    }
  }
  if (f.link && f.link.u1 > u0 && f.link.u0 < u1) {
    R(f.link.u0, f.link.u1, GND, f.link.top, '#D8D4CC');
    c.fillStyle = '#6b6d72'; c.font = `500 ${Math.max(10, px * 0.5)}px "IBM Plex Mono", monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('перехід 04 / 09', X((f.link.u0 + f.link.u1) / 2), Y(3.2));
  }
  return cv;
}

export function coverage(f) {
  const px = 10, cv = drawFacade(document.createElement('canvas'), f, { px, linesOnly: true });
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let on = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 127) on++;
  let area = f.len * (f.top - PL);
  f.open.forEach(w => { area -= (w.u1 - w.u0) * Math.max(0, Math.min(w.y1, f.top) - Math.max(w.y0, PL)); });
  if (f.link) area -= (f.link.u1 - f.link.u0) * (f.link.top - PL);
  return on / (area * px * px);
}

export function drawPlan(cv) {
  const S = 4, K = 2;
  cv.width = 80 * S * K; cv.height = 60 * S * K;
  const c = cv.getContext('2d'); c.scale(K, K);
  const X = x => (x + 7) * S, Y = z => (z + 53) * S;
  const box = (x0, x1, z0, z1) => c.fillRect(X(x0), Y(z0), (x1 - x0) * S, (z1 - z0) * S);
  c.fillStyle = CLAD;
  box(-0.5, 66.1, -14, 0); box(26.8, 38.8, -32, -14); box(-0.5, 66.1, -46, -32);
  const L = [['01', 33, 3.6], ['02', 69.8, -7], ['03', 52.5, -17.8], ['04', 42.4, -23], ['05', 52.5, -28.2], ['05', 13, -28.2],
    ['06', 69.8, -39], ['07', 33, -49.6], ['08', -3.9, -39], ['09', 23.2, -23], ['10', 13, -17.8], ['11', -3.9, -7]];
  c.font = '500 10px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const [t, x, z] of L) {
    c.fillStyle = '#EEEDEA'; c.strokeStyle = CLAD; c.lineWidth = 1;
    c.beginPath(); c.arc(X(x), Y(z), 9, 0, 7); c.fill(); c.stroke();
    c.fillStyle = CLAD; c.fillText(t, X(x), Y(z) + 0.5);
  }
  return cv;
}

// ---------- 3D (етап 2): опуклі шматки тих самих полігонів для мешів ----------
// Розкладку не змінює: бере LINES / SHAPES / linePoly і лише ріже їх по прямокутниках.
function clipHalf(poly, nx, ny, c) {
  if (!poly) return null;
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out.length >= 3 ? out : null;
}
const polyArea = p => Math.abs(p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2;
const clipRect = (p, u0, u1, y0, y1) => [[-1, 0, -u0], [1, 0, u1], [0, -1, -y0], [0, 1, y1]].reduce((q, [a, b, c]) => clipHalf(q, a, b, c), p);
function subtractRect(pieces, r) {
  const out = [];
  for (const p of pieces) {
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    if (Math.max(...xs) <= r.u0 || Math.min(...xs) >= r.u1 || Math.max(...ys) <= r.y0 || Math.min(...ys) >= r.y1) { out.push(p); continue; }
    const mid = clipHalf(clipHalf(p, -1, 0, -r.u0), 1, 0, r.u1);
    [clipHalf(p, 1, 0, r.u0), clipHalf(p, -1, 0, -r.u1), clipHalf(mid, 0, 1, r.y0), clipHalf(mid, 0, -1, -r.y1)]
      .forEach(q => { if (q && polyArea(q) > 1e-7) out.push(q); });
  }
  return out;
}
// кожна лінія — ланцюжок опуклих чотирикутників між міттерними вершинами
function convexParts() {
  const parts = [];
  LINES.forEach(l => {
    const poly = linePoly(l), n = l.pts.length, Lf = poly.slice(0, n), R = poly.slice(n).reverse();
    for (let i = 0; i < n - 1; i++) parts.push({ c: l.c, pts: [Lf[i], Lf[i + 1], R[i + 1], R[i]] });
  });
  SHAPES.forEach(s => parts.push({ c: s.c, pts: s.pts }));
  return parts;
}
// лінії фасаду в локальних (u, y): обрізані сегментами, з вирізаними прорізами.
// ext — виліт за край фасаду (м), щоб на зовнішніх кутах площини сходились без щілини.
export function facadePieces(f, o = {}) {
  const e = o.ext ?? 0, parts = convexParts();
  const holes = [...f.open, ...(f.link ? [{ u0: f.link.u0, u1: f.link.u1, y0: PL, y1: f.link.top }] : [])];
  const out = [];
  for (const seg of f.segs) for (const p of parts) for (const k of [-1, 0, 1]) {
    const sh = seg.s0 + k * PERIM, pts = p.pts.map(([s, y]) => [s - sh, y]);
    const xs = pts.map(q => q[0]);
    if (Math.max(...xs) < seg.u0 - e || Math.min(...xs) > seg.u1 + e) continue;
    const c0 = clipRect(pts, seg.u0 - e, seg.u1 + e, PL, f.top);
    if (!c0) continue;
    let pieces = [c0];
    for (const h of holes) pieces = subtractRect(pieces, h);
    if (pieces.length) out.push({ c: p.c, polys: pieces });
  }
  return out;
}
// облицювання фасаду без прорізів (вікна, вітражі, двері) і без зони переходу
export function claddingPieces(f, o = {}) {
  const e = o.ext ?? 0;
  let pieces = [[[-e, PL], [f.len + e, PL], [f.len + e, f.top], [-e, f.top]]];
  const holes = f.open.filter(w => w.k === 'win' || w.k === 'curtain' || w.k === 'door');
  if (f.link) holes.push({ u0: f.link.u0, u1: f.link.u1, y0: PL, y1: o.linkTop ?? f.link.top });
  for (const h of holes) pieces = subtractRect(pieces, h);
  return pieces;
}
