# قلم. — Arabic calligraphy canvas

An Arabic calligraphy writing app in the browser: a **cut-reed qalam nib** that lays true flat, angled strokes like a real Naskh pen, traditional **nuqta practice guides**, and instant PNG export. Runs **fully offline**.

Built with plain HTML, CSS and vanilla JavaScript — no build tools, no framework: `js/engine.js` for the canvas/brush engine and `js/app.js` for the UI.

## Live demo

Deployed to GitHub Pages: <https://atefbb.github.io/arabic-calligraphy-app/>

Current release: **v1.1.0** (tag [`v1.1.0`](https://github.com/atefBB/arabic-calligraphy-app/releases/tag/v1.1.0))

## Features

- **Qalam tool** — simulates a cut reed nib: stroke width follows the writing direction relative to a fixed nib angle, giving the classic thick/thin modulation of Arabic calligraphy. Strokes are rendered as the *swept nib edge*, so every start and end is a crisp flat cut at the pen's angle — just like a real قصب. Press harder with a stylus for a fuller line.
- **True paper sizes** — the nib is sized in real millimeters, like a physical qalam: 1, 1.5, 2, 2.5, … 6 mm (CSS reference 96dpi), with a continuous mm slider as well.
- **True Naskh cut** — the nib angle defaults to 40° (the 35–45° range used for النّسخ، وأمّا 25° للرقعة والأقلام اللينة); quick presets (25/35/40/45/60/90) plus a full 0–90° slider for other scripts.
- **Nuqta dot-grid guides** — the classic practice grid, scaled to your nib, toggleable (hidden in exported PNGs)
- **Ink palette** — black, sepia, sienna, charcoal, gold, rust plus a custom picker and opacity
- **Multiple pages** with thumbnails and a grid overview
- **Zoom** — wheel / pinch to zoom about the cursor, pan with a middle-button drag, buttons or `Ctrl + / − / 0`; strokes always land on the *paper*, and exports stay full-page regardless of zoom
- **Qalam cut direction** — toggle the nib's cut slant in the angle popover: thick descenders to the left (the classic Naskh way) or to the right
- **Undo / Redo** per page, clear page, export current page or all pages as PNG
- **Offline-first PWA** — all scripts, icons and styles are bundled locally and cached by a service worker; no internet required after first load
- Fully **RTL interface** in Arabic

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Q` | Qalam |
| `E` | Eraser |
| `[` / `]` | Decrease / increase nib size (mm, 0.5 steps) |
| `-` / `=` | Decrease / increase nib angle |
| `G` | Toggle nuqta guide dots |
| `⌘Z` / `⇧⌘Z` | Undo / Redo (also `Ctrl+Y`) |
| `N` | New page |
| `S` | Export current page as PNG |
| `Tab` | Toggle all-pages overview |
| `←` / `→` | Next / previous page (RTL) |
| `⌫` / `Delete` | Clear current page |
| `Ctrl =` / `Ctrl −` | Zoom in / out |
| `Ctrl 0` | Reset zoom to 100% |
| `Esc` | Close overview / popovers |

## Project structure

```
.
├── index.html      # App shell, RTL toolbar, popovers, overview
├── styles.css      # All styling
├── icon.svg        # Favicon / app icon
├── manifest.json   # PWA manifest
├── sw.js           # Service worker (offline caching)
└── js/
    ├── engine.js   # Canvas, qalam nib sweep, guides, history, pages
    ├── app.js      # UI wiring, tools, popovers, keyboard, overview
    └── vendor/
        └── lucide.min.js  # Icons, bundled locally (no CDN)
```

## Run it locally

No dependencies or install step. Serve the folder with any static server:

```sh
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then open <http://localhost:8000>. Load once online so the service worker installs; afterwards it works with the network off.

## The nib model

A cut-reed qalam is a thin, straight rectangle of ink — nib length `L` and belly width `w` — held at a fixed cut angle `φ` (the slant of the pen, 35–45° for Naskh). When the pen moves at direction `θ`, the exposed cross-section is

```
width(θ) = L·|sin(θ − φ)| + w·|cos(θ − φ)|
```

But a real pen does not print a rounded variable-width line. Because the nib is a rigid straight edge, each stroke is the **sweep of that edge**: the ink region is the path ⊕ nib segment. The engine fills the polygon whose two long sides are the trajectory shifted by ±(nib edge)/2 — the caps then close flat along the nib edge at the true cut angle, giving the sharp angled starts and ends of authentic qalam writing. A thin centre-line stroke adds the minimum belly `w` so strokes running parallel to the nib stay ink-true.

## Changelog

### v1.3.0 — mm nib sizes & solid return strokes (2026-09-22)
- Nib sized in real millimeters like a physical qalam: chips at 1, 1.5, 2, 2.5, … 6 mm plus a continuous mm slider; `[` / `]` step in 0.5 mm. (1 mm = 3.78 px at CSS reference 96 dpi.)
- Fix: letters written by *return strokes* over the same line (the ج head, loops in ع م، س، ص…) no longer dissolve the ink beneath. Strokes are now stamped from each consecutive nib-edge quad instead of one merged polygon, so the canvas winding rule can never hollow out the shape under a return. Single-pass strokes look unchanged.

### v1.2.0 — zoom & nib cut direction (2026-09-22)
- **Zoom & pan**: wheel or two-finger pinch zooms about the cursor; middle-button (or `Alt`+drag) pans; toolbar buttons and `Ctrl + / − / 0` too. Everything is drawn on a fixed full-page canvas and *viewed* through a scale/pan transform, so undo/redo, pages, the overview and PNG export are always the full page — zooming never crops history.
- **Qalam cut direction toggle** (`عكس اتجاه القطة`): flips the nib slope. With it off (default) the thick descenders fall to the **left** — the classic Naskh slant — flipping sends them to the right for other scripts or a left-handed hold.

### v1.1.0 — flat-cut qalam nib & offline-first (2026-09-22)
- **True reed-pen rendering**: strokes are now the *sweep of the rigid flat nib edge* instead of a rounded variable-width line — every stroke starts and ends with the crisp angled cut of a real قصب, and a tap prints a parallelogram نُقطة at the cut angle.
- **Authentic Naskh default**: nib angle defaults to **40°** (the 35–45° cut of خط النسخ) with quick presets `25 / 35 / 40 / 45 / 60 / 90°` plus the 0–90° slider for other scripts (تركيب القطع الأخرى؛ الكوفي لا يُرسم بهذا القلم).
- **Offline PWA**: lucide icons are bundled locally (`js/vendor/lucide.min.js`), Google Fonts CDN removed, and a service worker (`sw.js`) caches the whole app — it runs fully without internet after the first visit.
- **Fixed undo forever-wiping the page**: guide dots were drawn on the drawing board, so history snapshots/export captured a blank page. The dots now live on a separate transparent overlay; `#board` holds only ink, so undo/redo and PNG export reproduce the drawing faithfully.
- **Removed the text tool and font picker** (Amiri / Aref Ruqaa / Reem Kufi / …) — the app is a pure قلم workbench. No `T` shortcut anymore.

### v1.0.0 — initial release
- Qalam nib with thick/thin modulation, adjustable nib angle, nuqta dot-grid guides, ink palette, multiple pages, undo/redo, export, RTL Arabic interface, and an (online-dependent) text tool with Google Fonts and CDN icons.

## Roadmap

- Preset compositions (بسم الله… أدعية)
- Tashkeel / diacritic overlay while writing
- Paper textures and gold-leaf inks
- Mashq (tracing) practice mode over a faint model line

## Deploying to GitHub Pages

The site is published straight from the `main` branch root. To ship a new version:

```sh
git add .
git commit -m "describe your change"
git tag -a vX.Y.Z -m "vX.Y.Z — describe release"
git push origin main --follow-tags
```

GitHub rebuilds Pages automatically within a minute or two.

## License

Not specified.

---

وقف لله تعالى