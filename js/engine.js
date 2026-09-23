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

/* ------------------------- live-stroke rendering -------------------------
 * While a stroke is being drawn its ink is painted *directly* onto the
 * visible board through the view transform — no off-screen work canvas and
 * no per-move drawImage copy. The only canvas copy is at pointer-down/pen-up
 * (baking the finished stroke onto `page` once).
 *
 * To keep each move O(tail): appending one pointer sample only changes the
 * smoothed sample list near its *end* — everything up to the last ~3 samples
 * is identical to the previous move (the shared prefix). So we
 *  1. clear only the old tail's quads (tight per-quad rects, so the erase
 *     never reaches back into untouched ink) and redraw the `page` content
 *     (previous strokes / paper) back into that region, then
 *  2. re-stamp the new tail starting ONE sample before the seam (a shared
 *     quad) so the round-cap sliver at the junction is covered.
 * Only if the nib parameters (pressure) changed do we fall back to re-stamping
 * the whole stroke. `page` is written just once, at endStroke — so its
 * re-read during the clear is a cheap "cold" canvas draw. */
let  spOld = null;            // smoothed sample list of the previous move
let  uOld = 0, wOld = 0;      // nib params used for the previous move

function paperToDev(b) {
  return {
    sx: Math.max(0, Math.round(b.x0 * pageRatio)),
    sy: Math.max(0, Math.round(b.y0 * pageRatio)),
    ex: Math.min(page.width,  Math.ceil(b.x1 * pageRatio)),
    ey: Math.min(page.height, Math.ceil(b.y1 * pageRatio)),
  };
}

function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  };
}

function growBox(s, q) {
  if (q.x < s.x0) s.x0 = q.x; if (q.x > s.x1) s.x1 = q.x;
  if (q.y < s.y0) s.y0 = q.y; if (q.y > s.y1) s.y1 = q.y;
}

/* Axis-aligned paper bbox of everything `stampStroke` will ink from index
 * `start` on, padded by the nib half-length + belly width so a region is
 * never clipped. */
function inkBounds(sp, u, w, start = 0) {
  const s = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  if (sp.length === 1) {
    growBox(s, { x: sp[0].x + Math.abs(u.x) + w, y: sp[0].y + Math.abs(u.y) + w });
    growBox(s, { x: sp[0].x - Math.abs(u.x) - w, y: sp[0].y - Math.abs(u.y) - w });
    return s;
  }
  for (let i = start; i < sp.length - 1; i++) {
    const a = sp[i], c = sp[i + 1];
    growBox(s, { x: a.x + u.x, y: a.y + u.y }); growBox(s, { x: a.x - u.x, y: a.y - u.y });
    growBox(s, { x: c.x + u.x, y: c.y + u.y }); growBox(s, { x: c.x - u.x, y: c.y - u.y });
  }
  for (let i = start; i < sp.length; i++) growBox(s, sp[i]);
  const pad = Math.hypot(u.x, u.y) + w;
  s.x0 -= pad; s.y0 -= pad; s.x1 += pad; s.y1 += pad;
  return s;
}

/* Stamp stroke samples from index `start` (all of them when 0 — a whole
 * repaint). The context must already be in paper space. Drawing every segment
 * keeps overlapping self-intersecting quads solid — see the sweep note below. */
function stampStroke(c, sp, u, w, start = 0) {
  if (sp.length === 1) {
    const p = sp[0];
    const pp = phi();
    const perp = { x: -Math.sin(pp) * w / 2, y: Math.cos(pp) * w / 2 };
    c.beginPath();
    c.moveTo(p.x + u.x + perp.x, p.y + u.y + perp.y);
    c.lineTo(p.x + u.x - perp.x, p.y + u.y - perp.y);
    c.lineTo(p.x - u.x - perp.x, p.y - u.y - perp.y);
    c.lineTo(p.x - u.x + perp.x, p.y - u.y + perp.y);
    c.closePath();
    c.fill();
    return;
  }
  for (let i = Math.max(1, start); i < sp.length; i++) {
    const a = sp[i - 1], c2 = sp[i];
    c.beginPath();
    c.moveTo(a.x + u.x, a.y + u.y);
    c.lineTo(c2.x + u.x, c2.y + u.y);
    c.lineTo(c2.x - u.x, c2.y - u.y);
    c.lineTo(a.x - u.x, a.y - u.y);
    c.closePath();
    c.fill();
  }
  c.beginPath();
  c.moveTo(sp[Math.max(0, start - 1)].x, sp[Math.max(0, start - 1)].y);
  for (let i = Math.max(0, start - 1); i < sp.length; i++) c.lineTo(sp[i].x, sp[i].y);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = w;
  c.stroke();
}

function viewSet(c) {
  const r = dpr();
  const { zoom, panX, panY } = state.view;
  c.setTransform(r * zoom, 0, 0, r * zoom, r * panX, r * panY);
}

/* Paper-space bbox of the quad between two samples (tight, for the erase). */
function quadBox(a, c, u) {
  return {
    x0: Math.min(a.x, c.x) - Math.abs(u.x),
    y0: Math.min(a.y, c.y) - Math.abs(u.y),
    x1: Math.max(a.x, c.x) + Math.abs(u.x),
    y1: Math.max(a.y, c.y) + Math.abs(u.y),
  };
}

/* Clear a paper box on the visible board and draw the `page` content back
 * into it: restores paper + previous strokes beneath an erased tail. */
function restoreRegion(b) {
  const r = dpr();
  const { zoom, panX, panY } = state.view;
  const d = paperToDev(b);
  const sw = d.ex - d.sx, sh = d.ey - d.sy;
  if (sw <= 0 || sh <= 0) return;
  const dx = (b.x0 * zoom + panX) * r;
  const dy = (b.y0 * zoom + panY) * r;
  const dw = (b.x1 - b.x0) * zoom * r;
  const dh = (b.y1 - b.y0) * zoom * r;
  ctx.save();
  screenToDevice(ctx);
  ctx.globalAlpha = 1;
  ctx.clearRect(dx, dy, dw, dh);
  ctx.drawImage(page, d.sx, d.sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/* Erase the old tail quads (from index d on) and re-stamp the new tail from
 * index r, both directly on the visible board. If the nib parameters changed
 * (pressure/size), the whole previous stroke is stale and gets re-stamped. */
function repaintTail(sp, u, w) {
  if (spOld && (u.x !== uOld.x || u.y !== uOld.y || w !== wOld)) {
    restoreRegion(unionBox(inkBounds(spOld, uOld, wOld, 0), inkBounds(sp, u, w, 0)));
    spOld = null;                       // force the full re-stamp below
  }
  const d = !spOld ? 0 : Math.max(0, spOld.length - 3);
  const r = Math.max(0, d - 1);
  if (spOld) {
    let cleared = null;
    for (let i = d; i < spOld.length - 2; i++) {
      cleared = unionBox(cleared, quadBox(spOld[i], spOld[i + 1], uOld));
    }
    if (cleared) restoreRegion(cleared);
  }
  ctx.save();
  viewSet(ctx);
  applyInk(ctx);
  stampStroke(ctx, sp, u, w, r);
  ctx.restore();
  spOld = sp;
  uOld = u; wOld = w;
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

function nibParams() {
  const press = 0.5 + 0.5 * state.pressure;
  return { u: nibEdge(press), w: Math.max(0.7, state.size * 0.16) * press };
}

export function startStroke(p, pressure = 1) {
  state.drawing = true;
  state.pts = [p];
  state.pressure = pressure;
  if (state.tool === 'qalam') {
    spOld = null; uOld = 0; wOld = 0;    // any leftover tail is gone
    const sp = smoothSamples(state.pts);
    const { u, w } = nibParams();
    repaintTail(sp, u, w);
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
    restoreRegion({
      x0: Math.min(last.x, p.x) - pad, y0: Math.min(last.y, p.y) - pad,
      x1: Math.max(last.x, p.x) + pad, y1: Math.max(last.y, p.y) + pad,
    });
    return;
  }
  if (state.tool === 'qalam') {
    const sp = smoothSamples(state.pts);
    const { u, w } = nibParams();
    repaintTail(sp, u, w);
  }
}

export function endStroke() {
  if (!state.drawing) return;
  state.drawing = false;
  if (state.tool === 'qalam') {
    const sp = smoothSamples(state.pts);
    const { u, w } = nibParams();
    pctx.save();
    pctx.setTransform(pageRatio, 0, 0, pageRatio, 0, 0);
    applyInk(pctx);
    stampStroke(pctx, sp, u, w, 0);
    pctx.restore();
    spOld = null;
    uOld = 0; wOld = 0;
  }
  state.pts = [];
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