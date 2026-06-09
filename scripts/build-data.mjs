/**
 * ESGMap — real-data ingestion.
 *
 * Downloads the authoritative open datasets, normalises them on ISO-3166
 * alpha-3 codes, maps ISO-3 → Natural Earth `name`, derives the sustainability
 * composite, and emits a single typed `src/data/countries.json` consumed by the
 * app. Every source is stamped with a `retrievedAt` date that the Methodology
 * view surfaces.
 *
 *   Sources
 *   -------
 *   renewable / carbon / energy / mix / history  →  Our World in Data — Energy
 *   co2pc                                         →  Our World in Data — CO₂ & GHG
 *   forest                                        →  World Bank  AG.LND.FRST.ZS  (FAO FRA)
 *   pm25                                          →  World Bank  EN.ATM.PM25.MC.M3  (WHO/IHME)
 *   region / capital / paris / ndc / netZero /    →  Curated, dated JSON maintained
 *   ifrsS1 / ifrsS2 / esg / ev / climate              in-repo (scripts/country-meta.json)
 *
 * Run:  npm run build:data       (or: node scripts/build-data.mjs)
 *
 * Re-running regenerates src/data/countries.json deterministically from the
 * live feeds. The numeric headline metrics are never invented — a country with
 * no upstream value is emitted as null and renders grey / "no data" in the UI.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SOURCES = {
  owidEnergy: {
    id: "owid-energy",
    label: "Our World in Data — Energy",
    url: "https://github.com/owid/energy-data",
    file: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv",
    license: "Creative Commons BY 4.0",
  },
  owidCo2: {
    id: "owid-co2",
    label: "Our World in Data — CO₂ and Greenhouse Gas Emissions",
    url: "https://github.com/owid/co2-data",
    file: "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv",
    license: "Creative Commons BY 4.0",
  },
  wbForest: {
    id: "wb-forest",
    label: "World Bank — Forest area (% of land), FAO FRA",
    url: "https://data.worldbank.org/indicator/AG.LND.FRST.ZS",
    file: "https://api.worldbank.org/v2/country/all/indicator/AG.LND.FRST.ZS?format=json&per_page=20000&date=2008:2024",
    license: "Creative Commons BY 4.0",
  },
  wbPm25: {
    id: "wb-pm25",
    label: "World Bank — PM2.5 mean annual exposure (WHO / IHME)",
    url: "https://data.worldbank.org/indicator/EN.ATM.PM25.MC.M3",
    file: "https://api.worldbank.org/v2/country/all/indicator/EN.ATM.PM25.MC.M3?format=json&per_page=20000&date=2008:2024",
    license: "Creative Commons BY 4.0",
  },
  curated: {
    id: "esgmap-curated",
    label:
      "ESGMap curated policy layer — UNFCCC NDC Registry; Climate Watch (WRI); " +
      "Net Zero Tracker (Oxford/ECIU); IFRS Foundation jurisdiction profiles; " +
      "IEA Global EV Outlook; ND-GAIN Country Index",
    url: "https://github.com/",
    license: "Compiled by ESGMap from cited public sources",
  },
};

const YEAR_MIN = 2000;

// ---- tiny utilities --------------------------------------------------------
function todayISO() {
  // Build stamp. Deterministic per run; surfaced as each source's retrievedAt.
  return new Date().toISOString().slice(0, 10);
}

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "esgmap-build/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

// RFC-4180-ish CSV line splitter (handles quoted fields with commas).
function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const header = splitCsvLine(lines[0]);
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));
  return { idx, rows: lines.slice(1).map(splitCsvLine) };
}

const num = (s) => {
  if (s == null || s === "") return null;
  const v = +s;
  return Number.isFinite(v) ? v : null;
};

// ---- ingestion -------------------------------------------------------------
async function ingestOwidEnergy() {
  const text = await fetchText(SOURCES.owidEnergy.file);
  const { idx, rows } = parseCsv(text);
  const col = {
    iso: idx.iso_code,
    year: idx.year,
    ren: idx.renewables_share_elec,
    carb: idx.carbon_intensity_elec,
    energy: idx.per_capita_electricity,
    hydro: idx.hydro_share_elec,
    wind: idx.wind_share_elec,
    solar: idx.solar_share_elec,
    nuclear: idx.nuclear_share_elec,
    fossil: idx.fossil_share_elec,
  };
  // iso3 -> { year -> {ren,carb,energy,mix} }
  const byIso = new Map();
  for (const r of rows) {
    const iso = r[col.iso];
    if (!iso || iso.length !== 3) continue; // skip aggregates ("OWID_WRL", regions)
    const year = num(r[col.year]);
    if (year == null || year < YEAR_MIN) continue;
    let m = byIso.get(iso);
    if (!m) byIso.set(iso, (m = new Map()));
    const hydro = num(r[col.hydro]), wind = num(r[col.wind]), solar = num(r[col.solar]),
      nuclear = num(r[col.nuclear]), fossil = num(r[col.fossil]);
    let mix = null;
    if ([hydro, wind, solar, nuclear, fossil].some((v) => v != null)) {
      const h = hydro ?? 0, w = wind ?? 0, s = solar ?? 0, n = nuclear ?? 0, f = fossil ?? 0;
      const other = Math.max(0, 100 - (h + w + s + n + f));
      mix = {
        hydro: round1(h), wind: round1(w), solar: round1(s),
        nuclear: round1(n), fossil: round1(f), other: round1(other),
      };
    }
    m.set(year, {
      ren: num(r[col.ren]),
      carb: num(r[col.carb]),
      energy: num(r[col.energy]),
      mix,
    });
  }
  return byIso;
}

async function ingestOwidCo2() {
  const text = await fetchText(SOURCES.owidCo2.file);
  const { idx, rows } = parseCsv(text);
  const ci = idx.iso_code, cy = idx.year, cv = idx.co2_per_capita;
  const byIso = new Map(); // iso3 -> latest {year,value}
  for (const r of rows) {
    const iso = r[ci];
    if (!iso || iso.length !== 3) continue;
    const year = num(r[cy]); const v = num(r[cv]);
    if (year == null || v == null) continue;
    const cur = byIso.get(iso);
    if (!cur || year > cur.year) byIso.set(iso, { year, value: v });
  }
  return byIso;
}

async function ingestWorldBank(src) {
  const text = await fetchText(src.file);
  const json = JSON.parse(text);
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  const lastUpdated = Array.isArray(json) && json[0] ? json[0].lastupdated : null;
  const byIso = new Map(); // iso3 -> latest {year,value}
  for (const r of rows) {
    const iso = r.countryiso3code;
    const v = r.value;
    const year = num(r.date);
    if (!iso || iso.length !== 3 || v == null || year == null) continue;
    const cur = byIso.get(iso);
    if (!cur || year > cur.year) byIso.set(iso, { year, value: v });
  }
  return { byIso, lastUpdated };
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- composite score (documented formula) ---------------------------------
// Transparent 0–100 blend of normalised sub-scores (higher = better).
// Weights are renormalised over whichever sub-scores are available for a country.
const SCORE_WEIGHTS = { renew: 0.3, carbon: 0.25, co2: 0.2, disclosure: 0.15, climate: 0.1 };

function disclosureSubScore(meta) {
  if (meta.tier !== "rich") return null; // policy detail curated for major economies only
  const parisMap = { ratified: 1, signed: 0.5, withdrawn: 0, none: 0 };
  const ifrsMap = { mandatory: 1, adopting: 0.8, roadmap: 0.5, consulting: 0.3, none: 0 };
  const paris = parisMap[meta.paris] ?? 0;
  // Graded by target-year ambition: a 2035 pledge ≈ full credit, a 2075 pledge ≈ none,
  // so an early net-zero date scores higher than a distant one (no pledge → 0).
  const netZero = meta.netZero == null ? 0 : clamp((2075 - meta.netZero) / (2075 - 2035), 0, 1);
  const ifrs = ((ifrsMap[meta.ifrsS1] ?? 0) + (ifrsMap[meta.ifrsS2] ?? 0)) / 2;
  return 100 * (0.34 * paris + 0.33 * netZero + 0.33 * ifrs);
}

function deriveScore(rec, meta) {
  const subs = [];
  if (rec.renewable != null) subs.push(["renew", clamp(rec.renewable, 0, 100)]);
  if (rec.carbon != null) subs.push(["carbon", 100 * (1 - clamp(rec.carbon / 800, 0, 1))]);
  if (rec.co2pc != null) subs.push(["co2", 100 * (1 - clamp(rec.co2pc / 25, 0, 1))]);
  const disc = disclosureSubScore(meta);
  if (disc != null) subs.push(["disclosure", disc]);
  if (rec.climate != null) subs.push(["climate", 100 - clamp(rec.climate, 0, 100)]);
  if (!subs.length) return null;
  let wsum = 0, acc = 0;
  for (const [k, v] of subs) { const w = SCORE_WEIGHTS[k]; wsum += w; acc += w * v; }
  return Math.round(acc / wsum);
}

// ---- history (real annual points, gap-filled by carry-forward) -------------
function buildHistory(energyByYear, yearMax) {
  if (!energyByYear) return null;
  const years = [], renewable = [], carbon = [];
  let lastRen = null, lastCarb = null;
  let gapFilled = false, any = false;
  for (let y = YEAR_MIN; y <= yearMax; y++) {
    const e = energyByYear.get(y);
    let rv = e && e.ren != null ? e.ren : null;
    let cv = e && e.carb != null ? e.carb : null;
    if (rv == null && lastRen != null) { rv = lastRen; gapFilled = true; }
    if (cv == null && lastCarb != null) { cv = lastCarb; gapFilled = true; }
    if (rv != null) lastRen = rv;
    if (cv != null) lastCarb = cv;
    if (rv != null || cv != null) any = true;
    years.push(y);
    renewable.push(rv == null ? null : round1(rv));
    carbon.push(cv == null ? null : Math.round(cv));
  }
  if (!any) return null;
  return { years, renewable, carbon, gapFilled };
}

function latestUpTo(byYear, yearMax, key) {
  if (!byYear) return null;
  for (let y = yearMax; y >= YEAR_MIN; y--) {
    const e = byYear.get(y);
    if (e && e[key] != null) return e[key];
  }
  return null;
}

// ---- main ------------------------------------------------------------------
async function main() {
  const retrievedAt = todayISO();
  console.log("• fetching Our World in Data — Energy …");
  const energy = await ingestOwidEnergy();
  console.log("• fetching Our World in Data — CO₂ …");
  const co2 = await ingestOwidCo2();
  console.log("• fetching World Bank — Forest cover …");
  const forest = await ingestWorldBank(SOURCES.wbForest);
  console.log("• fetching World Bank — PM2.5 …");
  const pm25 = await ingestWorldBank(SOURCES.wbPm25);

  const meta = JSON.parse(readFileSync(resolve(__dirname, "country-meta.json"), "utf8"));

  // Determine the headline edition year: the latest year for which renewables
  // data covers a majority of the curated universe (avoids a single-country tail).
  const isoSet = meta.map((m) => m.iso3);
  let yearMax = YEAR_MIN;
  for (let y = new Date().getFullYear(); y >= YEAR_MIN; y--) {
    const have = isoSet.filter((iso) => {
      const m = energy.get(iso);
      return m && m.get(y) && m.get(y).ren != null;
    }).length;
    if (have >= isoSet.length * 0.5) { yearMax = y; break; }
  }
  console.log(`• edition year (renewables majority coverage): ${yearMax}`);

  const countries = meta.map((m) => {
    const eByYear = energy.get(m.iso3) || null;
    const history = buildHistory(eByYear, yearMax);
    const renewable = history ? history.renewable[history.renewable.length - 1] : null;
    const carbon = history ? history.carbon[history.carbon.length - 1] : null;
    const energyPc = latestUpTo(eByYear, yearMax, "energy");
    const mix = latestUpTo(eByYear, yearMax, "mix");
    const co2pc = co2.get(m.iso3) ? round1(co2.get(m.iso3).value) : null;
    const forestV = forest.byIso.get(m.iso3) ? Math.round(forest.byIso.get(m.iso3).value * 10) / 10 : null;
    const pm25V = pm25.byIso.get(m.iso3) ? Math.round(pm25.byIso.get(m.iso3).value * 10) / 10 : null;

    const rec = {
      name: m.name,
      match: m.match,
      iso3: m.iso3,
      region: m.region,
      tier: m.tier,
      capital: m.capital ?? null,
      // real numeric headline metrics
      renewable,
      carbon,
      co2pc,
      energy: energyPc == null ? null : Math.round(energyPc),
      mix: mix ?? null,
      pm25: pm25V,
      forest: forestV,
      climate: m.climate ?? null,
      ev: m.ev ?? null,
      // curated policy / disclosure (rich tier)
      paris: m.paris ?? null,
      parisYear: m.parisYear ?? null,
      ndc: m.ndc ?? null,
      netZero: m.netZero ?? null,
      ifrsS1: m.ifrsS1 ?? null,
      ifrsS2: m.ifrsS2 ?? null,
      esg: m.esg ?? null,
      history,
    };
    rec.score = deriveScore(rec, m);
    return rec;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const covered = (k) => countries.filter((c) => c[k] != null).length;
  const out = {
    meta: {
      generatedAt: retrievedAt,
      yearMin: YEAR_MIN,
      yearMax,
      territories: countries.length,
      scoreWeights: SCORE_WEIGHTS,
      sources: [
        { ...pick(SOURCES.owidEnergy), retrievedAt, metrics: ["renewable", "carbon", "energy", "mix", "history"] },
        { ...pick(SOURCES.owidCo2), retrievedAt, metrics: ["co2pc"] },
        { ...pick(SOURCES.wbForest), retrievedAt, lastUpdated: forest.lastUpdated, metrics: ["forest"] },
        { ...pick(SOURCES.wbPm25), retrievedAt, lastUpdated: pm25.lastUpdated, metrics: ["pm25"] },
        { ...pick(SOURCES.curated), retrievedAt, metrics: ["region", "capital", "paris", "ndc", "netZero", "ifrsS1", "ifrsS2", "ev", "climate"] },
      ],
    },
    countries,
  };

  mkdirSync(resolve(root, "src", "data"), { recursive: true });
  writeFileSync(resolve(root, "src", "data", "countries.json"), JSON.stringify(out) + "\n");

  console.log("\n✓ wrote src/data/countries.json");
  console.log(`  territories : ${countries.length}`);
  for (const k of ["renewable", "carbon", "co2pc", "energy", "mix", "forest", "pm25", "score"])
    console.log(`  ${k.padEnd(11)}: ${covered(k)}/${countries.length} covered`);
}

function pick(s) {
  return { id: s.id, label: s.label, url: s.url, license: s.license };
}

main().catch((e) => { console.error(e); process.exit(1); });
