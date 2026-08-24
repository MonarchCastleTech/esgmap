/**
 * ESGMap — derived-artifact emitter.
 *
 * From the in-memory dataset, writes the citable / FAIR outputs that make the
 * atlas reusable by researchers and machines (all static, copied into dist/ by
 * Vite from public/):
 *   public/downloads/   esgmap-wide.csv|json, esgmap-tidy-long.csv|json,
 *                       esgmap-history-long.csv|json, data-dictionary.json
 *   public/schema/      countries.schema.json  (JSON Schema draft 2020-12)
 *   public/api/         index.json, country/<ISO3>.json, metric/<key>.json
 *   public/build-manifest.json   reproducibility provenance
 *   src/data/changelog.json      revision diff vs the previous edition
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ---- field metadata (single source of truth for codebook + schema + exports) ----
const FIELDS = [
  { key: "iso3", label: "ISO-3166 alpha-3 code", unit: "", type: "string", source: "reference" },
  { key: "name", label: "Country (Natural Earth name)", unit: "", type: "string", source: "reference" },
  { key: "region", label: "World region", unit: "", type: "string", source: "esgmap-curated" },
  { key: "tier", label: "Coverage tier (rich = full policy detail)", unit: "", type: "enum", domain: ["rich", "base"], source: "esgmap-curated" },
  { key: "capital", label: "Capital city", unit: "", type: "string", source: "esgmap-curated" },
  { key: "renewable", label: "Renewable electricity share", unit: "%", type: "number", source: "owid-energy", betterHigh: true, hasYear: true },
  { key: "carbon", label: "Grid carbon intensity", unit: "gCO2/kWh", type: "number", source: "owid-energy", betterHigh: false, hasYear: true },
  { key: "co2pc", label: "CO2 emissions per capita", unit: "t/yr", type: "number", source: "owid-co2", betterHigh: false, hasYear: true },
  { key: "energy", label: "Electricity use per capita", unit: "kWh/yr", type: "number", source: "owid-energy", hasYear: true },
  { key: "forest", label: "Forest cover", unit: "% land", type: "number", source: "wb-forest", betterHigh: true, hasYear: true },
  { key: "pm25", label: "Air quality (PM2.5 annual mean)", unit: "µg/m³", type: "number", source: "wb-pm25", betterHigh: false, hasYear: true },
  { key: "climate", label: "Climate-risk exposure (ND-GAIN)", unit: "/100", type: "number", source: "esgmap-curated", betterHigh: false },
  { key: "ev", label: "EV share of new car sales", unit: "%", type: "number", source: "esgmap-curated" },
  { key: "score", label: "ESGMap sustainability composite", unit: "/100", type: "number", source: "derived", betterHigh: true, transform: "weighted, renormalised blend of normalised renewable / inverted carbon / inverted CO2pc / disclosure / inverted climate sub-scores" },
  { key: "paris", label: "Paris Agreement status", unit: "", type: "enum", domain: ["ratified", "signed", "withdrawn", "none"], source: "esgmap-curated" },
  { key: "netZero", label: "Net-zero target year", unit: "year", type: "number", source: "esgmap-curated" },
  { key: "ifrsS1", label: "IFRS S1 adoption", unit: "", type: "enum", domain: ["mandatory", "adopting", "roadmap", "consulting", "none"], source: "esgmap-curated" },
  { key: "ifrsS2", label: "IFRS S2 adoption", unit: "", type: "enum", domain: ["mandatory", "adopting", "roadmap", "consulting", "none"], source: "esgmap-curated" },
];
const NUMERIC = FIELDS.filter((f) => f.type === "number");

// ---- CSV helpers -----------------------------------------------------------
const cell = (v) => {
  if (v == null) return "NA";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n";

export function emitArtifacts(out, { root, SCORE_WEIGHTS, prev, prevChangelog }) {
  const { meta, countries } = out;
  const pub = (...p) => resolve(root, "public", ...p);
  const ensure = (...p) => { mkdirSync(resolve(root, "public", ...p), { recursive: true }); };
  ensure("downloads"); ensure("schema"); ensure("api", "country"); ensure("api", "metric");

  const provenanceHeader =
    `# ESGMap ${meta.version} · generated ${meta.generatedAt} · edition year ${meta.yearMax} · CC BY 4.0\n` +
    `# Sources: ${meta.sources.map((s) => `${s.label} (retrieved ${s.retrievedAt})`).join("; ")}\n` +
    `# 'NA' = no upstream value (never fabricated / never 0).\n`;

  // ---- wide CSV/JSON (one row per country) ----
  const mixKeys = ["hydro", "wind", "solar", "nuclear", "fossil", "other"];
  // categorical policy columns (netZero is numeric → already in NUMERIC, don't repeat)
  const wideCols = ["iso3", "name", "region", "tier", "capital",
    ...NUMERIC.flatMap((f) => (f.hasYear ? [f.key, `${f.key}_year`] : [f.key])),
    "paris", "ifrsS1", "ifrsS2", ...mixKeys.map((k) => `mix_${k}`)];
  const wideRows = countries.map((c) => [
    c.iso3, c.name, c.region, c.tier, c.capital,
    ...NUMERIC.flatMap((f) => (f.hasYear ? [c[f.key], c.years?.[f.key] ?? null] : [c[f.key]])),
    c.paris, c.ifrsS1, c.ifrsS2, ...mixKeys.map((k) => c.mix?.[k] ?? null),
  ]);
  writeFileSync(pub("downloads", "esgmap-wide.csv"), provenanceHeader + toCsv(wideCols, wideRows));
  writeFileSync(pub("downloads", "esgmap-wide.json"), JSON.stringify({ meta, countries }, null, 0) + "\n");

  // ---- tidy long CSV/JSON (one row per country × metric) ----
  const tidyCols = ["iso3", "name", "region", "metric", "value", "year", "unit", "source"];
  const tidyRows = [];
  for (const c of countries) {
    for (const f of NUMERIC) {
      // only stamp a year on metrics that actually carry an observation vintage
      tidyRows.push([c.iso3, c.name, c.region, f.key, c[f.key], f.hasYear ? (c.years?.[f.key] ?? null) : null, f.unit, f.source]);
    }
  }
  writeFileSync(pub("downloads", "esgmap-tidy-long.csv"), provenanceHeader + toCsv(tidyCols, tidyRows));
  writeFileSync(pub("downloads", "esgmap-tidy-long.json"),
    JSON.stringify(tidyRows.map((r) => Object.fromEntries(tidyCols.map((k, i) => [k, r[i]]))), null, 0) + "\n");

  // ---- history long CSV/JSON (annual renewable & carbon, with interpolated flag) ----
  const histCols = ["iso3", "name", "year", "metric", "value", "interpolated"];
  const histRows = [];
  for (const c of countries) {
    if (!c.history) continue;
    c.history.years.forEach((y, i) => {
      for (const m of ["renewable", "carbon"]) {
        histRows.push([c.iso3, c.name, y, m, c.history[m][i], c.history.interpolated?.[m]?.[i] ? 1 : 0]);
      }
    });
  }
  writeFileSync(pub("downloads", "esgmap-history-long.csv"), provenanceHeader + toCsv(histCols, histRows));
  writeFileSync(pub("downloads", "esgmap-history-long.json"),
    JSON.stringify(histRows.map((r) => Object.fromEntries(histCols.map((k, i) => [k, r[i]]))), null, 0) + "\n");

  // ---- data dictionary / codebook ----
  writeFileSync(pub("downloads", "data-dictionary.json"), JSON.stringify({
    dataset: "ESGMap — Global Sustainability Atlas",
    version: meta.version,
    generatedAt: meta.generatedAt,
    license: "CC BY 4.0 (data); MIT (code)",
    temporalCoverage: `${meta.yearMin}–${meta.yearMax}`,
    nullSemantics: "null / 'NA' means no upstream value — never fabricated, never 0.",
    scoreWeights: SCORE_WEIGHTS,
    fields: FIELDS,
    sources: meta.sources,
  }, null, 2) + "\n");

  // ---- JSON Schema (draft 2020-12) for one country record ----
  const numProp = { type: ["number", "null"] };
  const enumProp = (vals) => ({ type: ["string", "null"], enum: [...vals, null] });
  writeFileSync(pub("schema", "countries.schema.json"), JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://monarchcastletech.github.io/esgmap/schema/countries.schema.json",
    title: "ESGMap dataset",
    type: "object",
    required: ["meta", "countries"],
    properties: {
      meta: { type: "object" },
      countries: {
        type: "array",
        items: {
          type: "object",
          required: ["iso3", "name", "region", "tier", "score"],
          properties: {
            iso3: { type: "string", pattern: "^[A-Z]{3}$" },
            name: { type: "string" },
            match: { type: "string" },
            region: { type: "string" },
            tier: { type: "string", enum: ["rich", "base"] },
            capital: { type: ["string", "null"] },
            renewable: numProp, carbon: numProp, co2pc: numProp, energy: numProp,
            forest: numProp, pm25: numProp, climate: numProp, ev: numProp, score: numProp,
            paris: enumProp(["ratified", "signed", "withdrawn", "none"]),
            netZero: { type: ["number", "null"] },
            ifrsS1: enumProp(["mandatory", "adopting", "roadmap", "consulting", "none"]),
            ifrsS2: enumProp(["mandatory", "adopting", "roadmap", "consulting", "none"]),
            mix: { type: ["object", "null"] },
            years: { type: ["object", "null"] },
            subscores: { type: ["object", "null"] },
            subscoresUsed: { type: "array", items: { type: "string" } },
            history: { type: ["object", "null"] },
          },
        },
      },
    },
  }, null, 2) + "\n");

  // ---- static "API": addressable per-resource JSON ----
  for (const c of countries) {
    writeFileSync(pub("api", "country", `${c.iso3}.json`), JSON.stringify({ meta: { version: meta.version, generatedAt: meta.generatedAt, license: "CC BY 4.0" }, country: c }) + "\n");
  }
  for (const f of NUMERIC) {
    writeFileSync(pub("api", "metric", `${f.key}.json`), JSON.stringify({
      metric: f.key, label: f.label, unit: f.unit, source: f.source, version: meta.version,
      values: countries.map((c) => ({ iso3: c.iso3, name: c.name, value: c[f.key], year: f.hasYear ? (c.years?.[f.key] ?? null) : null })),
    }) + "\n");
  }
  writeFileSync(pub("api", "index.json"), JSON.stringify({
    dataset: "ESGMap", version: meta.version, generatedAt: meta.generatedAt, license: "CC BY 4.0",
    base: "https://monarchcastletech.github.io/esgmap/api/",
    endpoints: {
      countries: "../downloads/esgmap-wide.json",
      country: countries.map((c) => `country/${c.iso3}.json`),
      metric: NUMERIC.map((f) => `metric/${f.key}.json`),
      schema: "../schema/countries.schema.json",
      dictionary: "../downloads/data-dictionary.json",
    },
  }, null, 2) + "\n");

  // ---- reproducibility manifest ----
  writeFileSync(pub("build-manifest.json"), JSON.stringify({
    dataset: "ESGMap", version: meta.version, contentHash: meta.contentHash,
    gitSha: meta.gitSha, nodeVersion: meta.nodeVersion, generatedAt: meta.generatedAt,
    yearMin: meta.yearMin, yearMax: meta.yearMax, territories: meta.territories,
    editionYearSelection: "latest year with renewables data for ≥50% of the curated universe",
    coverage: meta.coverage, scoreWeights: SCORE_WEIGHTS,
    sources: meta.sources.map((s) => ({ id: s.id, label: s.label, url: s.url, retrievedAt: s.retrievedAt, license: s.license })),
    reproduce: "npm ci && npm run build:data — re-fetches the cited feeds; the contentHash verifies an identical edition.",
  }, null, 2) + "\n");

  // ---- revision changelog (diff vs the previous edition, chained) ----
  const changelog = buildChangelog(prev, out, prevChangelog);
  writeFileSync(resolve(root, "src", "data", "changelog.json"), JSON.stringify(changelog) + "\n");

  const n = countries.length;
  console.log(`  ↳ emitted: 3 download tables (+JSON), codebook, JSON Schema, ${n} country + ${NUMERIC.length} metric API files, build-manifest, changelog`);
}

function buildChangelog(prev, out, prevChangelog) {
  const entry = {
    version: out.meta.version, generatedAt: out.meta.generatedAt, yearMax: out.meta.yearMax,
    previousVersion: prev?.meta?.version ?? null, added: [], removed: [], largestDeltas: [],
  };
  // Chain from the previously-written changelog.json (where editions actually live).
  const prevEditions = Array.isArray(prevChangelog?.editions) ? prevChangelog.editions : [];
  if (!prev?.countries) return { editions: [entry, ...prevEditions].slice(0, 20) };
  const prevByIso = Object.fromEntries(prev.countries.map((c) => [c.iso3, c]));
  const nowByIso = Object.fromEntries(out.countries.map((c) => [c.iso3, c]));
  entry.added = out.countries.filter((c) => !prevByIso[c.iso3]).map((c) => c.name);
  entry.removed = prev.countries.filter((c) => !nowByIso[c.iso3]).map((c) => c.name);
  const deltas = [];
  for (const c of out.countries) {
    const p = prevByIso[c.iso3];
    if (!p) continue;
    for (const k of ["renewable", "carbon", "co2pc", "forest", "pm25", "score"]) {
      if (c[k] != null && p[k] != null && c[k] !== p[k]) {
        deltas.push({ iso3: c.iso3, name: c.name, metric: k, from: p[k], to: c[k], delta: Math.round((c[k] - p[k]) * 100) / 100 });
      }
    }
  }
  entry.largestDeltas = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 25);
  // Don't duplicate the head entry if rebuilding the same edition.
  const tail = prevEditions.filter((e) => e.version !== entry.version);
  return { editions: [entry, ...tail].slice(0, 20) };
}
