/* ------------------------------------------------------------------ *
 * engine.js — canvas, qalam nib, history and pages
 * ------------------------------------------------------------------ */

export const stage   = document.getElementById('stage');
export const board   = document.getElementById('board');
export const overlay = document.getElementById('overlay');
export const ctx     = board.getContext('2d');
export const octx    = overlay.getContext('2d');

export const PAPER = '#f5eeda';

export const state = {
  tool: 'qalam',
  color: '#221c14',
  size: 8,          // nib length in px
  angle: 40,        // nib cut angle in degrees (naskh qalam ≈ 35–45°)
  opacity: 1,
  pressure: 1,
  drawing: false,
  pts: [],
  cache: null,      // pre-stroke snapshot while drawing
  guides: true,
};

/* ----------------------------- pages ----------------------------- */
let uid = 0;
const newPage = () => ({ id: ++uid, snapshot: null, history: [], future: [] });

export const pages = [newPage()];
export let index = 0;

export const current = () => pages[index];

/* ----------------------------- sizing ----------------------------- */
export const dpr = () => Math.min(window.devicePixelRatio || 1, 2.5);

export function cssSize() {
  return { w: stage.clientWidth || window.innerWidth, h: stage.clientHeight || window.innerHeight };
}

/* --------------------------- paper & guides ---------------------------
 * The guide dots live on the transparent overlay layer; #board holds only
 * ink on paper. That way snapshots and exports never need guide stripping
 * and undo/redo always reproduce the exact drawing. */
export function clearGuides() {
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.restore();
}

export function drawGuides() {
  if (!state.guides) return;
  clearGuides();
  const { w, h } = cssSize();
  const step = Math.max(10, Math.round(state.size * 1.4));
  const ratio = dpr();
  octx.save();
  octx.setTransform(ratio, 0, 0, ratio, 0, 0);
  octx.globalAlpha = 1;
  octx.fillStyle = 'rgba(48,38,24,0.14)';
  for (let y = step; y < h; y += step)
    for (let x = step; x < w; x += step)
      octx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  octx.restore();
}

export function fillPaper() {
  const { w, h } = cssSize();
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  drawGuides();
}

export function resizeCanvas(preserve = true) {
  const { w, h } = cssSize();
  const ratio = dpr();

  let snap = null;
  if (preserve && board.width && board.height) {
    snap = document.createElement('canvas');
    snap.width = board.width;
    snap.height = board.height;
    snap.getContext('2d').drawImage(board, 0, 0);
  }

  board.width = Math.round(w * ratio);
  board.height = Math.round(h * ratio);
  overlay.width = Math.round(w * ratio);
  overlay.height = Math.round(h * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  fillPaper();

  if (snap) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(snap, 0, 0, board.width, board.height);
    ctx.restore();
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/* --------------------------- export & snapshot ---------------------------
 * The board never contains guide dots (they live on the overlay), so the
 * canvas can be exported / snapshotted directly. */

export function exportPng(cb) {
  board.toBlob(cb, 'image/png');
}

/* ----------------------------- history ----------------------------- */
const MAX = 40;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((fn) => fn());

export function snapshot() {
  try {
    return board.toDataURL('image/png');
  } catch { return null; }
}

export function commit() {
  const p = current();
  const data = snapshot();
  if (!data) return;
  p.history.push(data);
  if (p.history.length > MAX) p.history.shift();
  p.future.length = 0;
  p.snapshot = data;
  emit();
}

export function paint(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) { fillPaper(); resolve(); return; }
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, board.width, board.height);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, board.width, board.height);
      ctx.drawImage(img, 0, 0, board.width, board.height);
      ctx.restore();
      drawGuides();
      resolve();
    };
    img.onerror = () => { fillPaper(); resolve(); };
    img.src = dataUrl;
  });
}

export async function refresh() {
  const p = current();
  await paint(p.snapshot);
}

export const canUndo = () => current().history.length > 1;
export const canRedo = () => current().future.length > 0;

export async function undo() {
  const p = current();
  if (p.history.length < 2) return false;
  p.future.push(p.history.pop());
  p.snapshot = p.history[p.history.length - 1];
  await paint(p.snapshot);
  emit();
  return true;
}

export async function redo() {
  const p = current();
  if (!p.future.length) return false;
  const next = p.future.pop();
  p.history.push(next);
  p.snapshot = next;
  await paint(next);
  emit();
  return true;
}

export function clearPage() {
  fillPaper();
  commit();
}

/* ----------------------------- page nav ----------------------------- */
function stash() {
  const p = current();
  p.snapshot = snapshot();
}

export async function goTo(i) {
  if (i < 0 || i >= pages.length || i === index) return;
  stash();
  index = i;
  const p = current();
  await paint(p.snapshot);
  if (!p.history.length) commit();
  emit();
}

export async function addPage(at = pages.length) {
  stash();
  const p = newPage();
  pages.splice(at, 0, p);
  index = at;
  fillPaper();
  commit();
  emit();
}

export async function removePage(i) {
  if (pages.length === 1) {
    pages[0] = newPage();
    index = 0;
    fillPaper();
    commit();
    emit();
    return;
  }
  const wasCurrent = i === index;
  pages.splice(i, 1);
  if (index >= pages.length) index = pages.length - 1;
  else if (i < index) index -= 1;
  if (wasCurrent || true) await paint(current().snapshot);
  if (!current().history.length) commit();
  emit();
}

export function syncCurrentSnapshot() { stash(); }

/* ------------------------------ qalam nib ------------------------------
 * A cut-reed qalam is a thin, straight rectangle of ink — length L (the
 * "nib length") and width w — held at a fixed cut angle φ (the qalam slant
 * of the pen, 35–45° for Naskh, adjustable for other scripts). As the pen
 * moves along a direction θ the exposed cross-section is
 *
 *   width(θ) = L·|sin(θ − φ)| + w·|cos(θ − φ)|
 *
 * Because the nib is a rigid straight edge, every stroke is the *sweep of
 * that edge*: the ink region is the path ⊕ nib segment. That sweep is what
 * produces the true flat, angled start/end cuts of a real qalam — a rounded
 * variable-width line can never print that. So we fill the polygon whose
 * two long sides are the path translated by ±(nib edge)/2, exactly the union
 * of the nib edge as it passes along the trajectory. A thin stroke along the
 * centre line adds the minimum w (the "belly") so hairlines stay visible.
 * ---------------------------------------------------------------------- */

export function nibEdge(press) {
  const phi = state.angle * Math.PI / 180;
  const L = (state.size * press) / 2;
  return { x: Math.cos(phi) * L, y: Math.sin(phi) * L };
}

export function nibWidth(theta, press = 1) {
  const d = theta - state.angle * Math.PI / 180;
  const L = state.size * press;
  const w = Math.max(0.7, state.size * 0.16) * press;
  return Math.max(0.8, L * Math.abs(Math.sin(d)) + w * Math.abs(Math.cos(d)));
}

function applyInk(c) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.globalAlpha = state.opacity;
  c.strokeStyle = state.color;
  c.fillStyle = state.color;
}

function restoreCache() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, board.width, board.height);
  if (state.cache) ctx.drawImage(state.cache, 0, 0);
  ctx.restore();
}

/* Densely resample the control points onto the actual smoothed curve so
 * the swept polygon follows the ribbon without kinks between samples. */
function smoothSamples(pts) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  const add = (p) => {
    const q = out[out.length - 1];
    if ((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) > 0.01) out.push(p);
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const m0 = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
    const m1 = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    add(m0);
    const len = Math.hypot(m1.x - m0.x, m1.y - m0.y) + Math.hypot(pts[i].x - m0.x, pts[i].y - m0.y);
    const steps = Math.max(3, Math.min(16, Math.ceil(len / 2)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, u = 1 - t;
      add({
        x: u * u * m0.x + 2 * u * t * pts[i].x + t * t * m1.x,
        y: u * u * m0.y + 2 * u * t * pts[i].y + t * t * m1.y,
      });
    }
  }
  add(pts[pts.length - 1]);
  return out;
}

function drawStroke() {
  const pts = state.pts;
  if (!pts.length) return;
  const press = 0.5 + 0.5 * state.pressure;
  applyInk(ctx);
  const u = nibEdge(press);

  if (pts.length === 1) {
    /* A tap: the square cut edge pressed flat leaves a parallelogram mark
     * at the cut angle — the classic nuqta. */
    const p = pts[0];
    const w = Math.max(0.7, state.size * 0.16) * press;
    const perp = { x: -Math.sin(state.angle * Math.PI / 180) * w / 2, y: Math.cos(state.angle * Math.PI / 180) * w / 2 };
    ctx.beginPath();
    ctx.moveTo(p.x + u.x + perp.x, p.y + u.y + perp.y);
    ctx.lineTo(p.x + u.x - perp.x, p.y + u.y - perp.y);
    ctx.lineTo(p.x - u.x - perp.x, p.y - u.y - perp.y);
    ctx.lineTo(p.x - u.x + perp.x, p.y - u.y + perp.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const sp = smoothSamples(pts);

  /* The swept nib edge — the ink region of a rigid flat nib. The two long
   * sides are the trajectory shifted by ±u, and the caps close flat along
   * the nib edge itself, at the true cut angle. */
  ctx.beginPath();
  ctx.moveTo(sp[0].x + u.x, sp[0].y + u.y);
  for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x + u.x, sp[i].y + u.y);
  for (let i = sp.length - 1; i >= 0; i--) ctx.lineTo(sp[i].x - u.x, sp[i].y - u.y);
  ctx.closePath();
  ctx.fill();

  /* Minimum "belly" thickness along the centre line so strokes running
   * parallel to the nib stay ink-true (round caps fill the tiny join gaps). */
  const w = Math.max(0.7, state.size * 0.16) * press;
  ctx.beginPath();
  ctx.moveTo(sp[0].x, sp[0].y);
  for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function startStroke(p, pressure = 1) {
  state.drawing = true;
  state.pts = [p];
  state.pressure = pressure;
  state.cache = document.createElement('canvas');
  state.cache.width = board.width;
  state.cache.height = board.height;
  state.cache.getContext('2d').drawImage(board, 0, 0);
  if (state.tool === 'qalam') drawStroke();
}

export function extendStroke(p, pressure = 1) {
  if (!state.drawing) return;
  const pts = state.pts;
  const last = pts[pts.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) < 0.75) return;
  state.pressure = pressure;
  pts.push(p);
  restoreCache();
  if (state.tool === 'eraser') {
    for (let i = 1; i < pts.length; i++) eraseSegment(pts[i - 1], pts[i]);
  } else {
    drawStroke();
  }
}

export function endStroke() {
  if (!state.drawing) return;
  state.drawing = false;
  state.pts = [];
  state.cache = null;
  state.pressure = 1;
}

export function eraseSegment(a, b) {
  const theta = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = Math.max(state.size * 1.4, 8);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}
