# قلم. — Arabic calligraphy canvas

An Arabic calligraphy writing app in the browser: a **qalam nib** that thickens and thins as the pen moves, RTL-aware **text**, traditional **nuqta practice guides**, and instant PNG export.

Built with plain HTML, CSS and vanilla JavaScript — no build tools, no framework. Same structure as the okso. drawing app: `js/engine.js` for the canvas/history engine and `js/app.js` for the UI.

## Live demo

Deployed to GitHub Pages: <https://atefbb.github.io/arabic-calligraphy-app/>

## Features

- **Qalam tool** — simulates a cut reed nib: stroke width follows the writing direction relative to a fixed nib angle, giving the classic thick/thin modulation of Arabic calligraphy. Own start point taper and stylus pressure are respected when available.
- **Adjustable nib angle** (0–90°) and stroke weight
- **RTL text tool** — click a spot, type Arabic; browser shaping applies; you pick a calligraphic font
- **Five bundled scripts** (Google Fonts, OFL): Amiri (Naskh), Aref Ruqaa (Ruqaa), Reem Kufi (Kufic), Scheherazade New, Noto Naskh Arabic
- **Nuqta dot-grid guides** — the classic practice grid, scaled to your nib, toggleable (hidden in exported PNGs)
- **Ink palette** — black, sepia, sienna, charcoal, gold, rust plus a custom picker and opacity
- **Multiple pages** with thumbnails and a grid overview
- **Undo / Redo** per page, clear page, export current page or all pages as PNG
- Fully **RTL interface** in Arabic

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Q` | Qalam |
| `T` | Text |
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
| `Esc` | Close overview / popovers / text |

## Project structure

```
.
├── index.html      # App shell, RTL toolbar, text bar, overview
├── styles.css      # All styling
├── icon.svg        # Favicon / app icon
├── manifest.json   # PWA manifest
└── js/
    ├── engine.js   # Canvas, qalam nib model, guides, history, pages, text
    └── app.js      # UI wiring, tools, popovers, keyboard, overview
```

## Run it locally

No dependencies or install step. Serve the folder with any static server:

```sh
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then open <http://localhost:8000>.

> Fonts (Google Fonts) and icons (lucide) are loaded from CDNs, so an internet connection is required for full functionality.

## The nib model

A cut-reed qalam has a thin, angled rectangle tip. When the tip moves perpendicular to its long edge it lays a broad stroke; moving along its long edge leaves a hairline. The engine computes the line width as:

```
width(θ) = L·|sin(θ − φ)| + w·|cos(θ − φ)|
```

where `L` is the nib length, `w` the nib width, `φ` the nib angle and `θ` the stroke direction. Strokes are smoothed with midpoint quadratic Béziers and drawn as per-segment ribbon strokes so the modulation follows the curve.

## Roadmap

- Preset compositions (بسم الله… أدعية) in each script
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