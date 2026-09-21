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
  angle: 50,        // nib cut angle in degrees
  opacity: 1,
  pressure: 1,
  drawing: false,
  pts: [],
  cache: null,      // pre-stroke snapshot while drawing
  guides: true,
  font: 'Amiri, serif',
  fontName: 'Amiri',
  text: '',
  textPos: null,
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

/* --------------------------- paper & guides --------------------------- */
export function drawGuides() {
  if (!state.guides) return;
  const { w, h } = cssSize();
  const step = Math.max(10, Math.round(state.size * 1.4));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(48,38,24,0.14)';
  for (let y = step; y < h; y += step)
    for (let x = step; x < w; x += step)
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  ctx.restore();
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

  [board, overlay].forEach((c) => { c.width = Math.round(w * ratio); c.height = Math.round(h * ratio); });
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  octx.setTransform(ratio, 0, 0, ratio, 0, 0);

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

/* ---------------------- snapshot w/o guides data ---------------------- */
function stripGuides(fn) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tmp = document.createElement('canvas');
  tmp.width = board.width;
  tmp.height = board.height;
  tmp.getContext('2d').drawImage(board, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, board.width, board.height);
  fn();
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

export function exportPng(cb) {
  stripGuides(() => board.toBlob(cb, 'image/png'));
}

/* ----------------------------- history ----------------------------- */
const MAX = 40;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((fn) => fn());

export function snapshot() {
  try {
    let data;
    stripGuides(() => { data = board.toDataURL('image/png'); });
    return data;
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

/* ------------------------------ qalam nib ------------------------------ */
export function nibWidth(theta) {
  const phi = state.angle * Math.PI / 180;
  const L = state.size;
  const w = Math.max(1, state.size * 0.16);
  const d = theta - phi;
  return L * Math.abs(Math.sin(d)) + w * Math.abs(Math.cos(d));
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

function drawStroke() {
  const pts = state.pts;
  if (pts.length < 2) {
    applyInk(ctx);
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(1, nibWidth(Math.PI / 4) / 2) * (0.5 + 0.5 * state.pressure), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  applyInk(ctx);
  const n = pts.length;
  const press = 0.5 + 0.5 * state.pressure;
  for (let i = 1; i < n - 1; i++) {
    const m0 = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
    const m1 = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    const theta = Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);
    ctx.lineWidth = nibWidth(theta) * press;
    ctx.beginPath();
    ctx.moveTo(m0.x, m0.y);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m1.x, m1.y);
    ctx.stroke();
  }
  const theta = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
  ctx.lineWidth = nibWidth(theta) * press;
  ctx.beginPath();
  ctx.moveTo(pts[n - 2].x, pts[n - 2].y);
  ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
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

/* ----------------------------- overlay ----------------------------- */
export function clearOverlay() {
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.restore();
}

/* ------------------------------ text ------------------------------ */
export const textSize = () => Math.max(12, Math.round(state.size * 3.2));

export function renderTextOverlay() {
  clearOverlay();
  if (!state.text || !state.textPos) return;
  octx.save();
  octx.direction = 'rtl';
  octx.font = `${textSize()}px ${state.font}`;
  octx.fillStyle = state.color;
  octx.globalAlpha = state.opacity;
  octx.textAlign = 'center';
  octx.textBaseline = 'alphabetic';
  octx.fillText(state.text, state.textPos.x, state.textPos.y);
  octx.restore();
}

export function commitText() {
  if (!state.text || !state.textPos) { clearOverlay(); return; }
  ctx.save();
  ctx.direction = 'rtl';
  ctx.font = `${textSize()}px ${state.font}`;
  ctx.fillStyle = state.color;
  ctx.globalAlpha = state.opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(state.text, state.textPos.x, state.textPos.y);
  ctx.restore();
  clearOverlay();
}