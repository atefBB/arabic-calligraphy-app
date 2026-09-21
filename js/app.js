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

const colorBtn   = $('colorBtn');
const colorPop   = $('colorPop');
const colorRow   = $('colorRow');
const colorInput = $('colorInput');
const colorDot   = $('colorDot');
const opacityR   = $('opacityRange');

const fontBtn   = $('fontBtn');
const fontPop   = $('fontPop');
const fontRow   = $('fontRow');
const fontBadge = $('fontBadge');

const textBar   = $('textBar');
const textInput = $('textInput');
const textHint  = $('textHint');
const textOk    = $('textOk');
const textCancel = $('textCancel');

const overview  = $('overview');
const ovGrid    = $('ovGrid');
const ovCount   = $('ovCount');
const ovClose   = $('ovClose');
const ovNew     = $('ovNew');
const ovExportAll = $('ovExportAll');

const INKS  = ['#221c14', '#3a2416', '#4a2c12', '#0f172a', '#6b4f1d', '#7b2f24'];
const SIZES = [4, 6, 8, 12, 18, 26];

const FONTS = [
  { css: 'Amiri, serif',        name: 'أميري',   sub: 'نسخ' },
  { css: 'Aref Ruqaa, serif',   name: 'أريف',    sub: 'رقعة' },
  { css: 'Reem Kufi, sans-serif', name: 'ريم',   sub: 'كوفي' },
  { css: 'Scheherazade New, serif', name: 'شهرزاد', sub: 'نصّ' },
  { css: 'Noto Naskh Arabic, serif', name: 'نوتو نسخ', sub: 'نسخ' },
];

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
  cursorEl.classList.toggle('hide', tool === 'text');
  if (tool === 'text') closeTextBar();
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

FONTS.forEach((f) => {
  const btn = document.createElement('button');
  btn.className = 'font-chip';
  btn.dataset.font = f.css;
  btn.innerHTML = `${f.name}<small>${f.sub}</small>`;
  btn.style.fontFamily = f.css;
  btn.addEventListener('click', () => setFont(f.css, f.name));
  fontRow.appendChild(btn);
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
}

function setColor(hex) {
  E.state.color = hex;
  colorInput.value = hex;
  [...colorRow.children].forEach((c) => c.classList.toggle('is-active', c.dataset.color.toLowerCase() === hex.toLowerCase()));
  if (E.state.tool === 'eraser') setTool('qalam');
  paintPreviews();
}

function setFont(css, name) {
  E.state.font = css;
  E.state.fontName = name;
  fontBadge.textContent = name;
  fontBadge.style.fontFamily = css;
  [...fontRow.children].forEach((c) => c.classList.toggle('is-active', c.dataset.font === css));
  if (E.state.text) E.renderTextOverlay();
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
  if (E.state.text) E.renderTextOverlay();
});

/* popovers */
function closePops(except) {
  [sizePop, anglePop, colorPop, fontPop].forEach((p) => { if (p !== except) p.classList.remove('open'); });
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
fontBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(fontPop, fontBtn); });
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('.tool.wide')) closePops(null);
});

/* ------------------------------------------------------------------ *
 * Cursor ring
 * ------------------------------------------------------------------ */
function updateCursorSize() {
  const d = Math.max(6, E.state.size);
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
function pressureOf(e) {
  return e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1;
}

board.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  closePops(null);
  const p = pos(e);

  if (E.state.tool === 'text') {
    E.state.textPos = p;
    openTextBar();
    return;
  }

  board.setPointerCapture(e.pointerId);
  E.state.start = p;
  if (E.state.tool === 'qalam' || E.state.tool === 'eraser') {
    E.startStroke(p, pressureOf(e));
  }
});

board.addEventListener('pointermove', (e) => {
  if (!E.state.drawing) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) E.extendStroke(pos(ev), pressureOf(ev));
});

function finish() {
  if (!E.state.drawing) return;
  E.endStroke();
  E.commit();
}
board.addEventListener('pointerup', finish);
board.addEventListener('pointercancel', () => { E.endStroke(); });

/* ------------------------------------------------------------------ *
 * Text tool
 * ------------------------------------------------------------------ */
function openTextBar() {
  textBar.classList.remove('hidden');
  textInput.value = '';
  E.state.text = '';
  E.renderTextOverlay();
  textInput.focus();
  E.syncCurrentSnapshot();
}
function closeTextBar() {
  textBar.classList.add('hidden');
  E.state.text = '';
  E.state.textPos = null;
  E.clearOverlay();
}
function confirmText() {
  E.commitText();
  E.commit();
  closeTextBar();
  say('أُدرج النص');
}
textInput.addEventListener('input', () => {
  E.state.text = textInput.value;
  E.renderTextOverlay();
  textHint.textContent = E.state.text ? `${E.state.text.length} حرف — الخط: ${E.state.fontName}` : '';
});
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); confirmText(); }
  if (e.key === 'Escape') { e.preventDefault(); closeTextBar(); setTool('qalam'); }
});
textOk.addEventListener('click', confirmText);
textCancel.addEventListener('click', () => { closeTextBar(); setTool('qalam'); });

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
  E.refresh();
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
  if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; }
  if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); E.redo(); return; }
  if (meta) return;

  const k = e.key.toLowerCase();

  if (e.key === 'Escape') { closeOverview(); closePops(null); closeTextBar(); return; }
  if (e.key === 'Tab') { e.preventDefault(); overview.classList.contains('hidden') ? openOverview() : closeOverview(); return; }

  const map = { q: 'qalam', t: 'text', e: 'eraser' };
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
  setAngle(50);
  setColor('#221c14');
  setFont(FONTS[0].css, FONTS[0].name);
  E.commit();
  syncUI();
}
requestAnimationFrame(init);