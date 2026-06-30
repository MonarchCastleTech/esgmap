<div align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/monarchcastletech/esgmap/master/docs/logo-dark.png"><img src="docs/logo.png" alt="ESG Map logo" width="140"></picture>
  <!-- CODEX: generate a clean product logo here — a minimalist dark-navy emblem combining a stylized globe/world-map graticule with a sustainability/leaf or energy motif; cividis-accented (teal→amber) on near-black; corporate, flat, square-safe, works at 140px. -->

  # ESG Map
  ### Interactive atlas of national sustainability indicators

  ![status](https://img.shields.io/badge/status-active-brightgreen)
  ![division](https://img.shields.io/badge/Energy%20Intelligence-0b1f3a)
  ![Monarch Castle](https://img.shields.io/badge/Monarch%20Castle-Holdings-1f6feb)
  ![license](https://img.shields.io/badge/license-see%20LICENSE-lightgrey)
</div>

> **Executive summary** — ESG Map is an interactive, dark-themed world-map atlas that recolours by national sustainability indicators and opens a decision-grade detail panel for any country: its energy mix, disclosure posture, environmental indicators, and a 25-year historical trend. It is wired to real, dated open data from Our World in Data and the World Bank, augmented with an hourly near-real-time grid-operator layer, and ships as a fully static site for analysts, researchers, and educators who need provenance-first sustainability intelligence they can cite.

## ✨ Highlights
- **Real data, never invented.** Headline metrics are ingested from Our World in Data and the World Bank by a reproducible build script; missing values render grey / "no data" and are emitted as explicit `NA` — never fabricated, never zero.
- **Seven map layers** — renewable power share, grid carbon intensity, CO₂ per capita, air quality (PM2.5), forest cover, climate-risk exposure, and a documented composite sustainability score.
- **D3 world atlas** — `geoMercator`, full-bleed, latitude-clipped to remove polar smear, with zoom/pan, hover tooltips, and click-to-select fly-to that centres on a country's largest landmass.
- **Near-real-time grid layer** — hourly live renewable-share and grid-carbon readings from national grid operators (UK, US, ~25 European countries), labelled distinctly from annual values and never blended into them.
- **Built to be cited** — per-country and dataset-level BibTeX / RIS / APA export, a `CITATION.cff`, deep-link permalinks that encode full app state, a static per-resource JSON "API", and a JSON Schema codebook.
- **Reproducible & verifiable** — content hash + version + git SHA + `build-manifest.json` stamp every edition; the whole dataset can be regenerated with one command and the site deploys with no network access.
- **Accessible & offline** — screen-reader data-table fallback for the map, keyboard focus rings, colourblind-safe (cividis) and greyscale palettes, a print stylesheet, and an installable PWA with a service worker.

## 🖼️ Preview
![ESG Map — world map, renewable layer](design_handoff_esgmap/screenshots/01-map-renewable.png)
![ESG Map — country detail panel](design_handoff_esgmap/screenshots/02-country-panel.png)
![ESG Map — rankings table](design_handoff_esgmap/screenshots/04-rankings.png)
![ESG Map — methodology & provenance](design_handoff_esgmap/screenshots/06-methodology.png)

## 🧭 What it does
ESG Map turns scattered open sustainability datasets into a single, navigable atlas. Pick one of seven map layers and the world recolours by that metric; click any country to open a detail panel with its energy mix, disclosure status, environmental indicators, and a 2000→latest historical trend. A time slider scrubs the renewable and carbon layers across history.

Supporting views extend the map into an analytical workbench:

- **Rankings** — a sortable table across any metric, with explicit accounting of how many indicators each country was scored on.
- **Regional trends** — an overlay tracing metric trajectories by world region.
- **Compare** — a two-country side-by-side view.
- **Methodology** — every source documented with its retrieval date, the composite-score formula, and one-click citation export.
- **Score Lab** — re-weight the composite with live sliders and watch the ranking move, without ever overwriting the published score.
- **Explore** — scatter any two indicators, coloured by region, with explicit missing-data accounting; plus a Spearman correlation matrix among sub-indicators and convergent-validity checks against the Yale EPI.

The full app state — layer, year, selected country, pins, view, and palette — lives in the URL hash, so any view is a shareable, citable, embeddable link.

## 🗂️ Data & provenance
Per Monarch Castle doctrine — **evidence before assertion**. Every value in ESG Map is traceable to a named source and stamped with the date it was retrieved, and that provenance is rendered live in the in-app **Methodology** view. Countries with no upstream value for a metric are emitted as `null` and shown as "no data" — figures are never invented.

**Ingested annual metrics** (`scripts/build-data.mjs`):

| Metric(s) | Source | License |
|---|---|---|
| Renewable share, grid carbon intensity, electricity use per capita, electricity mix, 2000→latest history | Our World in Data — Energy (Ember + Energy Institute Statistical Review) | CC BY 4.0 |
| CO₂ per capita | Our World in Data — CO₂ & GHG (Global Carbon Project) | CC BY 4.0 |
| Forest cover (% land) | World Bank `AG.LND.FRST.ZS` (FAO FRA) | CC BY 4.0 |
| Air quality (PM2.5, µg/m³) | World Bank `EN.ATM.PM25.MC.M3` (WHO / IHME GBD) | CC BY 4.0 |

**Near-real-time overlay** (`scripts/build-live.mjs`, refreshed hourly via cron) — instantaneous generation-mix snapshots from national grid operators, labelled distinctly from annual figures:

| Source | Coverage | Token |
|---|---|---|
| National Energy System Operator (UK) | United Kingdom | none |
| U.S. EIA Grid Monitor | United States | `EIA_KEY` (free, instant) |
| ENTSO-E Transparency Platform | ~25 European countries | `ENTSOE_TOKEN` (free, email request) |

**Curated, dated layer** — slow-moving categorical fields (Paris status, 2030 NDC target, net-zero year, IFRS S1/S2 adoption, EV sales share, ND-GAIN climate-risk exposure) maintained as versioned JSON with retrieval stamps, compiled from UNFCCC, Climate Watch (WRI), the Net Zero Tracker, the IFRS Foundation, and the IEA.

**Derived metric** — the 0–100 sustainability score is a transparent, weighted composite (clean-power 30%, grid carbon 25%, CO₂ per capita 20%, disclosure readiness 15%, climate risk 10%), renormalised over whichever sub-scores are available per country. It is documented, not borrowed from a third-party index; the exact weights live in `scripts/build-data.mjs` and are surfaced in the Methodology view.

The committed dataset lets the app build and deploy without network access; CI attempts a fresh ingest on each deploy and falls back to the committed copy if a feed is down. Full provenance, licensing, renewable-classification rules, and emission factors are documented in **[DATA_SOURCES.md](DATA_SOURCES.md)**; the maintenance model and responsible-use posture are in **[GOVERNANCE.md](GOVERNANCE.md)**.

```
OWID Energy CSV  ─┐
OWID CO₂ CSV     ─┤
World Bank API   ─┼─►  build-data.mjs  ─►  src/data/countries.json  ─►  app
curated layer    ─┘     (ISO-3 join, derive score, stamp dates)
```

## 🛠️ Tech stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 (static output, relative `base` for Pages) |
| Map / scales | `d3-geo`, `d3-zoom`, `d3-scale`, `d3-selection`, `d3-transition`, `d3-interpolate`, `d3-ease`, `topojson-client` |
| Geometry | Natural Earth 110m (`world-atlas`), self-hosted under `public/geo/` |
| Fonts | IBM Plex Sans + IBM Plex Mono |
| Data | Our World in Data, World Bank, national grid operators, curated policy layer |
| Automation | GitHub Actions — build + hourly live-data refresh (cron) |
| Hosting | GitHub Pages (fully static, no backend) |

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

**Live site:** <https://monarchcastletech.github.io/esgmap/>

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run build:data` | Re-ingest the annual open-data feeds → `src/data/countries.json` |
| `npm run build:live` | Refresh the near-real-time overlay → `src/data/live.json` (UK works with no token) |
| `npm run build:meta` | Regenerate the curated policy layer from the design handoff |

### Enabling US / EU live data
Add repository secrets under **Settings → Secrets and variables → Actions**:

- `EIA_KEY` — register instantly at <https://www.eia.gov/opendata/register.php>
- `ENTSOE_TOKEN` — email `transparency@entsoe.eu` (subject "RESTful API access"), then generate the token in your account settings.

```bash
npm run build:live                                  # UK only (no token)
EIA_KEY=... ENTSOE_TOKEN=... npm run build:live      # full coverage
```

### Deployment (GitHub Pages)
The repo ships `.github/workflows/deploy.yml`. Push to `master`, set **Settings → Pages → Source = GitHub Actions**, and the workflow installs, optionally refreshes data, builds, and publishes `dist/`. `vite.config.ts` uses `base: "./"` and `public/.nojekyll` is included, so the same build works at both a user page and a project page with no config change.

## 🧱 Part of Monarch Castle
> A product of **Energy Intelligence** · **Monarch Castle Technologies** — an operating company of **[Monarch Castle Holdings](https://github.com/MonarchCastleHoldings)**.
> Sister companies: [Monarch Castle Technologies](https://github.com/monarchcastletech) · [Strategic Data Company of Ankara](https://github.com/SDCofA)

## 📜 License
Application code: MIT. Upstream datasets retain their own licenses — see [`DATA_SOURCES.md`](DATA_SOURCES.md) and `LICENSE`. © 2026 Monarch Castle Holdings · Ankara, Türkiye.

<div align="center"><sub>🏰 Monarch Castle Holdings — turning open-source noise into lawful, verified, decision-grade intelligence.</sub></div>
