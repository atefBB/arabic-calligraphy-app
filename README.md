# قلم. — Arabic calligraphy canvas

An Arabic calligraphy writing app in the browser: a **cut-reed qalam nib** that lays true flat, angled strokes like a real Naskh pen, traditional **nuqta practice guides**, and instant PNG export. Runs **fully offline**.

Built with plain HTML, CSS and vanilla JavaScript — no build tools, no framework: `js/engine.js` for the canvas/brush engine and `js/app.js` for the UI.

## Live demo

Deployed to GitHub Pages: <https://atefbb.github.io/arabic-calligraphy-app/>

## Features

- **Qalam tool** — simulates a cut reed nib: stroke width follows the writing direction relative to a fixed nib angle, giving the classic thick/thin modulation of Arabic calligraphy. Strokes are rendered as the *swept nib edge*, so every start and end is a crisp flat cut at the pen's angle — just like a real قصب. Press harder with a stylus for a fuller line.
- **True Naskh cut** — the nib angle defaults to 40° (the 35–45° range used for النّسخ، وأمّا 25° للرقعة والأقلام اللينة); quick presets (25/35/40/45/60/90) plus a full 0–90° slider for other scripts.
- **Nuqta dot-grid guides** — the classic practice grid, scaled to your nib, toggleable (hidden in exported PNGs)
- **Ink palette** — black, sepia, sienna, charcoal, gold, rust plus a custom picker and opacity
- **Multiple pages** with thumbnails and a grid overview
- **Undo / Redo** per page, clear page, export current page or all pages as PNG
- **Offline-first PWA** — all scripts, icons and styles are bundled locally and cached by a service worker; no internet required after first load
- Fully **RTL interface** in Arabic

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Q` | Qalam |
| `E` | Eraser |
| `[` / `]` | Decrease / increase nib length |
| `-` / `=` | Decrease / increase nib angle |
| `G` | Toggle nuqta guide dots |
| `⌘Z` / `⇧⌘Z` | Undo / Redo (also `Ctrl+Y`) |
| `N` | New page |
| `S` | Export current page as PNG |
| `Tab` | Toggle all-pages overview |
| `←` / `→` | Next / previous page (RTL) |
| `⌫` / `Delete` | Clear current page |
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
git push
```

GitHub rebuilds Pages automatically within a minute or two.

## License

Not specified.

---

وقف لله تعالى