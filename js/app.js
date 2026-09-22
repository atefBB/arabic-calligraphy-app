import * as E from './engine.js';

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

const board     = E.board;
const cursorEl  = $('cursor');
const toast     = $('toast');

const undoBtn   = $('undoBtn');
const redoBtn   = $('redoBtn');
const clearBtn  = $('clearBtn');
const exportBtn = $('exportBtn');
const newPageBtn = $('newPage');
const guideBtn  = $('guideBtn');
const prevBtn   = $('prevPage');
const nextBtn   = $('nextPage');
const pageNum   = $('pageNum');
const pageTotal = $('pageTotal');

const sizeBtn   = $('sizeBtn');
const sizePop   = $('sizePop');
const sizeRow   = $('sizeRow');
const sizeRange = $('sizeRange');
const sizeVal   = $('sizeVal');
const sizeDot   = $('sizeDot');

const angleBtn   = $('angleBtn');
const anglePop   = $('anglePop');
const angleRange = $('angleRange');
const angleVal   = $('angleVal');
const angleBadge = $('angleBadge');
const angleRow   = $('angleRow');

const colorBtn   = $('colorBtn');
const colorPop   = $('colorPop');
const colorRow   = $('colorRow');
const colorInput = $('colorInput');
const colorDot   = $('colorDot');
const opacityR   = $('opacityRange');

const overview  = $('overview');
const ovGrid    = $('ovGrid');
const ovCount   = $('ovCount');
const ovClose   = $('ovClose');
const ovNew     = $('ovNew');
const ovExportAll = $('ovExportAll');

const zoomOutBtn = $('zoomOut');
const zoomInBtn  = $('zoomIn');
const zoomValue  = $('zoomValue');
const mirrorBtn  = $('mirrorBtn');

const INKS  = ['#221c14', '#3a2416', '#4a2c12', '#0f172a', '#6b4f1d', '#7b2f24'];
const SIZES = [4, 6, 8, 12, 18, 26];

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */
let toastTimer;
function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
}

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */
const toolBtns = [...document.querySelectorAll('.tool[data-tool]')];

function setTool(tool) {
  E.state.tool = tool;
  toolBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.tool === tool));
  cursorEl.classList.toggle('eraser', tool === 'eraser');
  paintPreviews();
}
toolBtns.forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

/* ------------------------------------------------------------------ *
 * Size / angle / ink / font controls
 * ------------------------------------------------------------------ */
SIZES.forEach((s) => {
  const btn = document.createElement('button');
  btn.className = 'size-chip';
  btn.dataset.size = s;
  const dot = document.createElement('i');
  dot.style.width = Math.min(s, 22) + 'px';
  dot.style.height = Math.min(s, 22) + 'px';
  btn.appendChild(dot);
  btn.addEventListener('click', () => setSize(s));
  sizeRow.appendChild(btn);
});

INKS.forEach((hex) => {
  const btn = document.createElement('button');
  btn.className = 'ink';
  btn.dataset.color = hex;
  btn.style.background = hex;
  btn.title = hex;
  btn.addEventListener('click', () => setColor(hex));
  colorRow.appendChild(btn);
});

function setSize(px) {
  E.state.size = Math.max(2, Math.min(40, Math.round(px)));
  sizeRange.value = E.state.size;
  sizeVal.textContent = E.state.size;
  [...sizeRow.children].forEach((c) => c.classList.toggle('is-active', +c.dataset.size === E.state.size));
  paintPreviews();
}

function setAngle(deg) {
  E.state.angle = Math.max(0, Math.min(90, Math.round(deg)));
  angleRange.value = E.state.angle;
  angleVal.textContent = E.state.angle;
  angleBadge.textContent = E.state.angle + '°';
  [...angleRow.children].forEach((c) => c.classList.toggle('is-active', +c.dataset.angle === E.state.angle));
}

const ANGLES = [25, 35, 40, 45, 60, 90];
ANGLES.forEach((a) => {
  const btn = document.createElement('button');
  btn.className = 'ang-chip';
  btn.dataset.angle = a;
  btn.textContent = a + '°';
  btn.title = a + '°';
  btn.addEventListener('click', () => setAngle(a));
  angleRow.appendChild(btn);
});

function setColor(hex) {
  E.state.color = hex;
  colorInput.value = hex;
  [...colorRow.children].forEach((c) => c.classList.toggle('is-active', c.dataset.color.toLowerCase() === hex.toLowerCase()));
  if (E.state.tool === 'eraser') setTool('qalam');
  paintPreviews();
}

function paintPreviews() {
  const d = Math.max(3, Math.min(E.state.size, 20));
  sizeDot.style.width = d + 'px';
  sizeDot.style.height = d + 'px';
  sizeDot.style.background = E.state.tool === 'eraser' ? '#c9c9c9' : E.state.color;
  colorDot.style.background = E.state.color;
  colorDot.style.opacity = E.state.opacity;
  updateCursorSize();
}

sizeRange.addEventListener('input', () => setSize(+sizeRange.value));
angleRange.addEventListener('input', () => setAngle(+angleRange.value));
colorInput.addEventListener('input', () => setColor(colorInput.value));
opacityR.addEventListener('input', () => {
  E.state.opacity = +opacityR.value / 100;
  paintPreviews();
});

/* popovers */
function closePops(except) {
  [sizePop, anglePop, colorPop].forEach((p) => { if (p !== except) p.classList.remove('open'); });
}
function togglePop(pop, anchor) {
  const open = !pop.classList.contains('open');
  closePops(open ? pop : null);
  pop.classList.toggle('open', open);
  if (open) {
    const bar = document.getElementById('toolbar').getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    pop.style.left = (a.left - bar.left + a.width / 2) + 'px';
  }
}
sizeBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(sizePop, sizeBtn); });
angleBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(anglePop, angleBtn); });
colorBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(colorPop, colorBtn); });
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('.tool.wide')) closePops(null);
});

/* ------------------------------------------------------------------ *
 * Cursor ring
 * ------------------------------------------------------------------ */
function updateCursorSize() {
  const z = E.state.view ? E.state.view.zoom : 1;
  const d = Math.max(6, E.state.size * z);
  cursorEl.style.width = d + 'px';
  cursorEl.style.height = d + 'px';
}
board.addEventListener('pointermove', (e) => {
  cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
  cursorEl.classList.add('show');
});
board.addEventListener('pointerenter', () => cursorEl.classList.add('show'));
board.addEventListener('pointerleave', () => cursorEl.classList.remove('show'));

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */
function pos(e) {
  const r = board.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function paperPos(e) {
  return E.screenToPaper(pos(e));
}
function pressureOf(e) {
  return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1;
}

/* Two-finger pinch zoom (touch). We track live pointers on the board; when
 * two are down we zoom about their midpoint and keep the paper under the
 * fingers fixed (which also pans). Also pan by dragging mid-finger. */
const livePointers = new Map();
let pinch = null;
let panStart = null;

function pointersMid() {
  const pts = [...livePointers.values()];
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

board.addEventListener('pointerdown', (e) => {
  const p = pos(e);
  livePointers.set(e.pointerId, p);

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    if (!panStart) panStart = { x: e.clientX, y: e.clientY };
    closePops(null);
    board.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (livePointers.size === 2) {
    if (E.state.drawing) finish();
    closePops(null);
    const [a, b] = [...livePointers.values()];
    pinch = {
      zoom: E.state.view.zoom,
      panX: E.state.view.panX,
      panY: E.state.view.panY,
      mid: pointersMid(),
      dist: Math.hypot(a.x - b.x, a.y - b.y),
    };
    board.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  closePops(null);
  const pp = paperPos(e);
  board.setPointerCapture(e.pointerId);
  if (E.state.tool === 'qalam' || E.state.tool === 'eraser') {
    E.startStroke(pp, pressureOf(e));
  }
});

board.addEventListener('pointermove', (e) => {
  livePointers.set(e.pointerId, pos(e));

  if (panStart) {
    E.panBy(e.clientX - panStart.x, e.clientY - panStart.y);
    panStart = { x: e.clientX, y: e.clientY };
    updateZoomUI();
    return;
  }
  if (pinch && livePointers.size === 2) {
    const [a, b] = [...livePointers.values()];
    const mid = pointersMid();
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const factor = pinch.dist ? dist / pinch.dist : 1;
    const zoom = Math.max(E.ZOOM_MIN, Math.min(E.ZOOM_MAX, pinch.zoom * factor));
    /* keep the paper point that was under the start midpoint under the new
     * midpoint, scaled by the finger distance ratio */
    const paper = {
      x: (pinch.mid.x - pinch.panX) / pinch.zoom,
      y: (pinch.mid.y - pinch.panY) / pinch.zoom,
    };
    const panX = mid.x - paper.x * zoom;
    const panY = mid.y - paper.y * zoom;
    E.setViewLocked(zoom, panX, panY);
    updateZoomUI();
    return;
  }
  if (!E.state.drawing) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) E.extendStroke(paperPos(ev), pressureOf(ev));
});

function releasePointer(id) {
  livePointers.delete(id);
  if (livePointers.size < 2) pinch = null;
}
board.addEventListener('pointerup', (e) => {
  const wasPan = !!panStart;
  panStart = null;
  const wasPinch = !!pinch;
  releasePointer(e.pointerId);
  if (wasPan || wasPinch) return;
  finish();
});
board.addEventListener('pointercancel', (e) => {
  panStart = null;
  releasePointer(e.pointerId);
  E.endStroke();
});

/* wheel = zoom about the cursor */
board.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = pos(e);
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.001 : 0.002));
  E.zoomAt(p.x, p.y, factor);
  updateZoomUI();
}, { passive: false });

function finish() {
  if (!E.state.drawing) return;
  E.endStroke();
  E.commit();
}

/* ------------------------------------------------------------------ *
 * Zoom & nib mirror
 * ------------------------------------------------------------------ */
function updateZoomUI() {
  const pct = Math.round(E.state.view.zoom * 100);
  zoomValue.textContent = pct + '%';
  zoomValue.title = `${pct}%`;
  updateCursorSize();
}

zoomInBtn.addEventListener('click', () => { E.zoomBy(1.25); updateZoomUI(); });
zoomOutBtn.addEventListener('click', () => { E.zoomBy(0.8); updateZoomUI(); });
zoomValue.addEventListener('click', () => { E.zoomReset(); updateZoomUI(); say('٪100 تكبير'); });

mirrorBtn.addEventListener('click', () => {
  E.state.mirror = !E.state.mirror;
  mirrorBtn.classList.toggle('is-active', E.state.mirror);
  say(E.state.mirror ? 'القطة مقلوبة' : 'القطة على الاتجاه الطبيعي');
});

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */
undoBtn.addEventListener('click', () => E.undo());
redoBtn.addEventListener('click', () => E.redo());
clearBtn.addEventListener('click', () => { E.clearPage(); say('مُسحَت الصفحة'); });

newPageBtn.addEventListener('click', async () => { await E.addPage(); say('صفحة جديدة'); });
prevBtn.addEventListener('click', () => E.goTo(E.index - 1));
nextBtn.addEventListener('click', () => E.goTo(E.index + 1));

guideBtn.addEventListener('click', () => {
  E.state.guides = !E.state.guides;
  guideBtn.classList.toggle('active', E.state.guides);
  if (E.state.guides) E.drawGuides(); else E.clearGuides();
  say(E.state.guides ? 'شبكة النقاط: ظاهرة' : 'شبكة النقاط: مخفية');
});

function download(dataUrl, name) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

exportBtn.addEventListener('click', () => {
  E.exportPng((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    download(url, `qalam-page-${String(E.index + 1).padStart(2, '0')}-${stamp()}.png`);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    say('تم التصدير');
  });
});

ovExportAll.addEventListener('click', () => {
  E.syncCurrentSnapshot();
  E.pages.forEach((p, i) => {
    if (!p.snapshot) return;
    setTimeout(() => download(p.snapshot, `qalam-page-${String(i + 1).padStart(2, '0')}.png`), i * 220);
  });
  say(`تصدير ${E.pages.length} صفحة`);
});

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */
function openOverview() {
  E.syncCurrentSnapshot();
  renderOverview();
  overview.classList.remove('hidden');
}
function closeOverview() { overview.classList.add('hidden'); }

$('openOverview').addEventListener('click', openOverview);
$('openOverview2').addEventListener('click', openOverview);
ovClose.addEventListener('click', closeOverview);
ovNew.addEventListener('click', async () => { await E.addPage(); renderOverview(); closeOverview(); say('صفحة جديدة'); });

function renderOverview() {
  ovGrid.innerHTML = '';
  ovCount.textContent = `${E.pages.length} ${E.pages.length === 1 ? 'صفحة' : 'صفحات'}`;

  E.pages.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'ov-card';

    const thumb = document.createElement('div');
    thumb.className = 'ov-thumb' + (i === E.index ? ' is-current' : '');
    if (p.snapshot) {
      const img = document.createElement('img');
      img.src = p.snapshot;
      img.alt = `الصفحة ${i + 1}`;
      thumb.appendChild(img);
    }
    thumb.addEventListener('click', async () => { await E.goTo(i); closeOverview(); });

    const meta = document.createElement('div');
    meta.className = 'ov-meta';
    const label = document.createElement('span');
    label.textContent = String(i + 1).padStart(2, '0');
    const del = document.createElement('button');
    del.className = 'ov-del';
    del.title = 'حذف الصفحة';
    del.innerHTML = '<i data-lucide="trash-2"></i>';
    del.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await E.removePage(i);
      renderOverview();
    });
    meta.append(label, del);
    card.append(thumb, meta);
    ovGrid.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

/* ------------------------------------------------------------------ *
 * Keyboard
 * ------------------------------------------------------------------ */
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  const meta = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; }
  if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); E.redo(); return; }
  if (meta && (k === '=' || k === '+')) { e.preventDefault(); E.zoomBy(1.25); updateZoomUI(); return; }
  if (meta && k === '-') { e.preventDefault(); E.zoomBy(0.8); updateZoomUI(); return; }
  if (meta && k === '0') { e.preventDefault(); E.zoomReset(); updateZoomUI(); return; }
  if (meta) return;

  if (e.key === 'Escape') { closeOverview(); closePops(null); return; }
  if (e.key === 'Tab') { e.preventDefault(); overview.classList.contains('hidden') ? openOverview() : closeOverview(); return; }

  const map = { q: 'qalam', e: 'eraser' };
  if (map[k]) { setTool(map[k]); return; }
  if (k === 'n') { e.preventDefault(); E.addPage().then(() => say('صفحة جديدة')); return; }
  if (k === 's') { e.preventDefault(); exportBtn.click(); return; }
  if (k === 'g') { e.preventDefault(); guideBtn.click(); return; }
  if (e.key === 'ArrowLeft') { E.goTo(E.index + 1); return; }   // forward in RTL
  if (e.key === 'ArrowRight') { E.goTo(E.index - 1); return; }  // backward in RTL
  if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); E.clearPage(); say('مُسحَت الصفحة'); return; }
  if (k === '[') { setSize(E.state.size - (E.state.size > 12 ? 4 : 1)); return; }
  if (k === ']') { setSize(E.state.size + (E.state.size >= 12 ? 4 : 1)); return; }
  if (k === '-') { setAngle(E.state.angle - 5); return; }
  if (k === '=') { setAngle(E.state.angle + 5); return; }
});

/* ------------------------------------------------------------------ *
 * Sync UI with engine
 * ------------------------------------------------------------------ */
function syncUI() {
  undoBtn.disabled = !E.canUndo();
  redoBtn.disabled = !E.canRedo();
  pageNum.textContent = String(E.index + 1).padStart(2, '0');
  pageTotal.textContent = String(E.pages.length).padStart(2, '0');
  prevBtn.disabled = E.index === 0;
  nextBtn.disabled = E.index === E.pages.length - 1;
  if (!overview.classList.contains('hidden')) renderOverview();
  updateZoomUI();
}
E.onChange(syncUI);

/* ------------------------------------------------------------------ *
 * Resize
 * ------------------------------------------------------------------ */
let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { E.resizeCanvas(true); E.syncCurrentSnapshot(); }, 160);
});

/* ------------------------------------------------------------------ *
 * Init
 * ------------------------------------------------------------------ */
function init() {
  if (window.lucide) lucide.createIcons();
  E.resizeCanvas(false);
  setTool('qalam');
  setSize(8);
  setAngle(40);
  setColor('#221c14');
  E.commit();
  syncUI();
  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}
requestAnimationFrame(init);
