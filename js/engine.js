/* ------------------------------------------------------------------ *
 * engine.js — canvas, qalam nib, zoom, history and pages
 * ------------------------------------------------------------------ */

export const stage   = document.getElementById('stage');
export const board   = document.getElementById('board');
export const overlay = document.getElementById('overlay');
export const ctx     = board.getContext('2d');
export const octx    = overlay.getContext('2d');

export const PAPER = '#f5eeda';

/* The full-page drawing lives on an off-screen canvas (`page`) at paper
 * resolution. `board` is only a *viewport*: it composites `page` through
 * the view transform (zoom + pan). That way undo/redo and export are
 * always the full page, no matter how far you are zoomed in. */
const page  = document.createElement('canvas');
const pctx  = page.getContext('2d');
let  pageRatio = 1;                          // dpr frozen when the page is created

export const state = {
  tool: 'qalam',
  color: '#221c14',
  size: 8,          // nib length in px
  angle: 40,        // nib cut angle in degrees (naskh qalam ≈ 35–45°)
  mirror: false,    // flip the qalam cut to the opposite slant
  opacity: 1,
  pressure: 1,
  drawing: false,
  pts: [],
  baked: 0,         // how many smoothed samples are already on the page
  cache: null,      // pre-stroke snapshot of the page while drawing
  guides: true,
  paper: { w: 0, h: 0 },                    // logical sheet size (frozen at load)
  view: { zoom: 1, panX: 0, panY: 0 },      // paper -> screen view transform
};

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;

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

function screenToDevice(c) {
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/* --------------------------- rendering ---------------------------
 * render() composites the page onto the visible board through the view
 * transform; the whole visible area keeps the paper tone so zooming out
 * looks seamless. */
export function render() {
  const r = dpr();
  const { zoom, panX, panY } = state.view;
  ctx.save();
  screenToDevice(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, board.width, board.height);
  ctx.setTransform(r * zoom, 0, 0, r * zoom, r * panX, r * panY);
  ctx.drawImage(page, 0, 0, page.width, page.height, 0, 0, state.paper.w, state.paper.h);
  ctx.restore();
}

export function refresh() {
  render();
  drawGuides();
}

/* --------------------------- paper & guides ---------------------------
 * The guide dots live on the transparent overlay layer; #board holds only
 * ink on paper. They are paper-space dots shown through the same view
 * transform, so their pitch follows the zoom. */
export function clearGuides() {
  octx.save();
  screenToDevice(octx);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  octx.restore();
}

export function drawGuides() {
  if (!state.guides) return;
  clearGuides();
  const step = Math.max(10, Math.round(state.size * 1.4));
  const r = dpr();
  const { zoom, panX, panY } = state.view;
  const { w, h } = state.paper;
  octx.save();
  octx.setTransform(r * zoom, 0, 0, r * zoom, r * panX, r * panY);
  octx.globalAlpha = 1;
  octx.fillStyle = 'rgba(48,38,24,0.14)';
  for (let y = step; y < h; y += step)
    for (let x = step; x < w; x += step)
      octx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
  octx.restore();
}

export function fillPaper() {
  pctx.save();
  pctx.setTransform(pageRatio, 0, 0, pageRatio, 0, 0);
  pctx.globalAlpha = 1;
  pctx.globalCompositeOperation = 'source-over';
  pctx.fillStyle = PAPER;
  pctx.fillRect(0, 0, state.paper.w, state.paper.h);
  pctx.restore();
  refresh();
}

export function resizeCanvas(_preserve = true) {
  const { w, h } = cssSize();
  const ratio = dpr();

  if (!state.paper.w) {
    pageRatio = ratio;
    state.paper.w = w;
    state.paper.h = h;
    page.width = Math.round(w * pageRatio);
    page.height = Math.round(h * pageRatio);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.fillStyle = PAPER;
    pctx.fillRect(0, 0, page.width, page.height);
  }

  board.width = Math.round(w * ratio);
  board.height = Math.round(h * ratio);
  overlay.width = Math.round(w * ratio);
  overlay.height = Math.round(h * ratio);

  refresh();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/* --------------------------- view (zoom & pan) --------------------------- */
export function setViewLocked(zoom, panX, panY) {
  state.view.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
  state.view.panX = panX;
  state.view.panY = panY;
  refresh();
}

export function screenToPaper(s) {
  const { zoom, panX, panY } = state.view;
  return { x: (s.x - panX) / zoom, y: (s.y - panY) / zoom };
}

export function zoomAt(cssX, cssY, factor) {
  const v = state.view;
  const px = (cssX - v.panX) / v.zoom;
  const py = (cssY - v.panY) / v.zoom;
  v.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
  v.panX = cssX - px * v.zoom;
  v.panY = cssY - py * v.zoom;
  refresh();
}

export function zoomBy(factor) {
  const r = board.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, factor);
}

export function zoomReset() {
  setViewLocked(1, 0, 0);
}

export function panBy(dx, dy) {
  const v = state.view;
  v.panX += dx;
  v.panY += dy;
  refresh();
}

/* --------------------------- export & snapshot ---------------------------
 * The page canvas never contains guide dots (they live on the overlay), so
 * the full page can be exported / snapshotted directly, independent of the
 * current zoom level. */

export function exportPng(cb) {
  page.toBlob(cb, 'image/png');
}

/* ----------------------------- history ----------------------------- */
const MAX = 40;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((fn) => fn());

export function snapshot() {
  try {
    return page.toDataURL('image/png');
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
      pctx.save();
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = 'source-over';
      pctx.globalAlpha = 1;
      pctx.clearRect(0, 0, page.width, page.height);
      pctx.drawImage(img, 0, 0, page.width, page.height);
      pctx.restore();
      refresh();
      resolve();
    };
    img.onerror = () => { fillPaper(); resolve(); };
    img.src = dataUrl;
  });
}

export async function refreshPage() {
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
 *
 * The cut *direction* matters: with `mirror` off, descending-to-the-LEFT
 * strokes come out thick (the classic Naskh slant — تِنزِلُ الخطوطُ السمينة
 * إلى اليسار، كما في نزلات النونِ والراءِ والباء). `mirror` flips the cut
 * so the thick lines fall to the RIGHT instead — useful when practicing
 * other scripts or a left-handed hold.
 * ---------------------------------------------------------------------- */

function phi() {
  const a = state.angle * Math.PI / 180;
  return state.mirror ? -a : a;
}

export function nibEdge(press) {
  const p = phi();
  const L = (state.size * press) / 2;
  return { x: Math.cos(p) * L, y: Math.sin(p) * L };
}

export function nibWidth(theta, press = 1) {
  const d = theta - phi();
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

/* Restore a paper-space bbox of the page to its pre-stroke state, so only a
 * tiny region — not the whole page — has to be cleared & redrawn per move. */
function restoreRegion(x0, y0, x1, y1) {
  pctx.save();
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  const sx = Math.max(0, Math.round(x0 * pageRatio));
  const sy = Math.max(0, Math.round(y0 * pageRatio));
  const ex = Math.min(page.width,  Math.ceil(x1 * pageRatio));
  const ey = Math.min(page.height, Math.ceil(y1 * pageRatio));
  const sw = ex - sx, sh = ey - sy;
  if (sw > 0 && sh > 0) {
    pctx.clearRect(sx, sy, sw, sh);
    if (state.cache) pctx.drawImage(state.cache, sx, sy, sw, sh, sx, sy, sw, sh);
  }
  pctx.restore();
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

/* Paint (or repaint) the nib sweep from smoothed sample `startIdx` onward.
 * Adding a control point shifts only the few samples at the tail, so we
 * restore just that bbox from the pre-stroke cache and re-ink it — the rest
 * of the stroke stays untouched on the page. Returns the paper-space bbox
 * that changed (for dirty-region rendering of the viewport). */
function paintFrom(sp, startIdx) {
  startIdx = Math.max(0, startIdx);
  const press = 0.5 + 0.5 * state.pressure;
  const u = nibEdge(press);
  const w = Math.max(0.7, state.size * 0.16) * press;

  if (sp.length === 1) {
    /* A tap: the square cut edge pressed flat leaves a parallelogram mark
     * at the cut angle — the classic nuqta. */
    const p = sp[0];
    const pp = phi();
    const perp = { x: -Math.sin(pp) * w / 2, y: Math.cos(pp) * w / 2 };
    const pad = Math.hypot(u.x, u.y) + w;
    pctx.save();
    pctx.setTransform(pageRatio, 0, 0, pageRatio, 0, 0);
    applyInk(pctx);
    pctx.beginPath();
    pctx.moveTo(p.x + u.x + perp.x, p.y + u.y + perp.y);
    pctx.lineTo(p.x + u.x - perp.x, p.y + u.y - perp.y);
    pctx.lineTo(p.x - u.x - perp.x, p.y - u.y - perp.y);
    pctx.lineTo(p.x - u.x + perp.x, p.y - u.y + perp.y);
    pctx.closePath();
    pctx.fill();
    pctx.restore();
    return { x0: p.x - pad, y0: p.y - pad, x1: p.x + pad, y1: p.y + pad };
  }

  /* Paper-space bounds of every ink pixel we are about to touch. */
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (q) => {
    if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
    if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
  };
  for (let i = startIdx; i < sp.length - 1; i++) {
    const a = sp[i], c = sp[i + 1];
    grow({ x: a.x + u.x, y: a.y + u.y }); grow({ x: a.x - u.x, y: a.y - u.y });
    grow({ x: c.x + u.x, y: c.y + u.y }); grow({ x: c.x - u.x, y: c.y - u.y });
  }
  for (let i = startIdx; i < sp.length; i++) grow(sp[i]);
  const pad = Math.hypot(u.x, u.y) + w;
  const bx0 = x0 - pad, by0 = y0 - pad, bx1 = x1 + pad, by1 = y1 + pad;

  restoreRegion(bx0, by0, bx1, by1);

  pctx.save();
  pctx.setTransform(pageRatio, 0, 0, pageRatio, 0, 0);
  applyInk(pctx);

  /* The swept nib edge — the ink region of a rigid flat nib. Stamping the
   * nib edge along each consecutive pair of samples as *separate quads*:
   * a single merged polygon self-intersects whenever the pen returns over
   * its own path (ج ع ل م heads, loops…) and the non-zero winding rule then
   * cuts a hole under the return — the written ink beneath dissolves. Filling
   * quad by quad, overlapping passages simply re-ink the same pigment, so
   * the sweeps keep the flat cut caps and the shape stays solid. */
  for (let i = startIdx; i < sp.length - 1; i++) {
    const a = sp[i], c = sp[i + 1];
    pctx.beginPath();
    pctx.moveTo(a.x + u.x, a.y + u.y);
    pctx.lineTo(c.x + u.x, c.y + u.y);
    pctx.lineTo(c.x - u.x, c.y - u.y);
    pctx.lineTo(a.x - u.x, a.y - u.y);
    pctx.closePath();
    pctx.fill();
  }

  /* Minimum "belly" thickness along the (partial) centre line so strokes
   * running parallel to the nib stay ink-true (round caps fill the gaps). */
  pctx.beginPath();
  pctx.moveTo(sp[startIdx].x, sp[startIdx].y);
  for (let i = startIdx + 1; i < sp.length; i++) pctx.lineTo(sp[i].x, sp[i].y);
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.lineWidth = w;
  pctx.stroke();
  pctx.restore();

  return { x0: bx0, y0: by0, x1: bx1, y1: by1 };
}

/* Redraw only the paper-space bbox that changed onto the viewport board
 * instead of compositing the whole page on every pointer move. */
function renderRegion(b) {
  const r = dpr();
  const { zoom, panX, panY } = state.view;
  const sx = Math.max(0, Math.floor(b.x0 * pageRatio));
  const sy = Math.max(0, Math.floor(b.y0 * pageRatio));
  const ex = Math.min(page.width,  Math.ceil(b.x1 * pageRatio));
  const ey = Math.min(page.height, Math.ceil(b.y1 * pageRatio));
  const sw = ex - sx, sh = ey - sy;
  if (sw <= 0 || sh <= 0) return;
  const dx = (b.x0 * zoom + panX) * r;
  const dy = (b.y0 * zoom + panY) * r;
  const dw = (b.x1 - b.x0) * zoom * r;
  const dh = (b.y1 - b.y0) * zoom * r;
  ctx.save();
  screenToDevice(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.drawImage(page, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

export function startStroke(p, pressure = 1) {
  state.drawing = true;
  state.pts = [p];
  state.pressure = pressure;
  state.baked = 0;
  state.cache = document.createElement('canvas');
  state.cache.width = page.width;
  state.cache.height = page.height;
  state.cache.getContext('2d').drawImage(page, 0, 0);
  if (state.tool === 'qalam') {
    renderRegion(paintFrom(smoothSamples(state.pts), 0));
    state.baked = 1;
  }
}

export function extendStroke(p, pressure = 1) {
  if (!state.drawing) return;
  const pts = state.pts;
  const last = pts[pts.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) < 0.75) return;
  state.pressure = pressure;
  pts.push(p);
  if (state.tool === 'eraser') {
    eraseSegment(last, p);
    const pad = Math.max(state.size * 1.4, 8) / 2;
    renderRegion({
      x0: Math.min(last.x, p.x) - pad, y0: Math.min(last.y, p.y) - pad,
      x1: Math.max(last.x, p.x) + pad, y1: Math.max(last.y, p.y) + pad,
    });
    return;
  }
  /* Only the last few smoothed samples shift when a control point is added,
   * so repaint just that tail — not the whole stroke — and composite only
   * the dirty paper bbox. Constant cost per move regardless of stroke size. */
  const sp = smoothSamples(pts);
  renderRegion(paintFrom(sp, state.baked - 3));
  state.baked = sp.length;
}

export function endStroke() {
  if (!state.drawing) return;
  state.drawing = false;
  state.pts = [];
  state.cache = null;
  state.pressure = 1;
  render();
}

export function eraseSegment(a, b) {
  pctx.save();
  pctx.setTransform(pageRatio, 0, 0, pageRatio, 0, 0);
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.globalAlpha = 1;
  pctx.globalCompositeOperation = 'source-over';
  pctx.strokeStyle = PAPER;
  pctx.lineWidth = Math.max(state.size * 1.4, 8);
  pctx.beginPath();
  pctx.moveTo(a.x, a.y);
  pctx.lineTo(b.x, b.y);
  pctx.stroke();
  pctx.restore();
}