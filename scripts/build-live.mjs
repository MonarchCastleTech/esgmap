/**
 * ESGMap — live (near-real-time) renewable-share ingestion.
 *
 * Reads the committed annual dataset, queries the free official grid feeds for
 * the territories they cover, and writes `src/data/live.json` — a small overlay
 * the app merges on load to show a "LIVE" reading next to the annual figure.
 *
 *   Run locally :  npm run build:live            (UK works with no token)
 *   In CI       :  ENTSOE_TOKEN / EIA_KEY are read from GitHub Actions secrets.
 *
 * Design choices:
 *   • Each source is guarded by its token — absent token ⇒ that source is
 *     skipped, never an error. UK (ESO) needs no token, so there is always at
 *     least one live country.
 *   • Per-country failures are caught individually; one bad response can't sink
 *     the run. Anything not freshly fetched simply stays "annual" in the UI.
 *   • The overlay is regenerated each hour by the live workflow and baked into
 *     the deployed artifact — it is NOT committed (the repo keeps an empty
 *     placeholder), so live data never spams git history.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ENTSOE_DOMAINS, ENTSOE_RENEWABLE_PSR, ENTSOE_EMISSION, ESO_RENEWABLE,
  EIA_RENEWABLE, EIA_EMISSION, EIA_RESPONDENT, ESO_COUNTRY,
} from "./live-sources.mjs";

// PSR codes excluded from the generation total (storage, not generation).
const ENTSOE_STORAGE = new Set(["B10", "B25"]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function fetchText(url, opts = {}) {
  const res = await fetch(url, { headers: { "user-agent": "esgmap-live/1.0" }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.split("?")[0]}`);
  return await res.text();
}
const round1 = (v) => Math.round(v * 10) / 10;
const clampPct = (v) => Math.max(0, Math.min(100, v));

// Normalise an ENTSO-E <end> ("2026-06-09T13:00Z") or a compact "yyyymmddHHMM"
// to a full ISO instant so the UI's new Date(at) always parses.
function isoMinuteZ(s) {
  if (!s) return null;
  if (/^\d{12}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00Z`;
  const m = s.match(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d)(?::\d\d)?Z$/);
  return m ? `${m[1]}T${m[2]}:00Z` : s;
}

// ---- ESO (UK) — no key -----------------------------------------------------
async function fetchEso() {
  const gen = JSON.parse(await fetchText("https://api.carbonintensity.org.uk/generation"));
  const mix = gen.data.generationmix;
  const renew = mix.filter((m) => ESO_RENEWABLE.has(m.fuel)).reduce((s, m) => s + m.perc, 0);
  let carbon = null;
  try {
    const ci = JSON.parse(await fetchText("https://api.carbonintensity.org.uk/intensity"));
    carbon = ci.data?.[0]?.intensity?.actual ?? ci.data?.[0]?.intensity?.forecast ?? null;
  } catch { /* carbon is optional */ }
  return { renewable: round1(clampPct(renew)), carbon, carbonEstimated: false, source: "National Energy System Operator (UK)", at: gen.data.to };
}

// ---- EIA (US) — needs EIA_KEY ----------------------------------------------
async function fetchEia(key, respondent) {
  const url = `https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/?api_key=${key}`
    + `&frequency=hourly&data[0]=value&facets[respondent][]=${respondent}`
    + `&sort[0][column]=period&sort[0][direction]=desc&length=200`;
  const json = JSON.parse(await fetchText(url));
  const rows = json?.response?.data || [];
  if (!rows.length) throw new Error("EIA: no rows");
  const latest = rows[0].period;
  const hour = rows.filter((r) => r.period === latest);
  let total = 0, renew = 0, emis = 0;
  for (const r of hour) {
    const v = +r.value;
    if (!Number.isFinite(v) || v < 0) continue;
    total += v;
    if (EIA_RENEWABLE.has(r.fueltype)) renew += v;
    emis += v * (EIA_EMISSION[r.fueltype] ?? 400);
  }
  if (total <= 0) throw new Error("EIA: zero total");
  return {
    renewable: round1(clampPct((renew / total) * 100)),
    carbon: Math.round(emis / total),
    carbonEstimated: true,
    source: "U.S. EIA Grid Monitor",
    at: `${latest}:00Z`,
  };
}

// ---- ENTSO-E (EU) — needs ENTSOE_TOKEN -------------------------------------
function entsoeWindow() {
  // last 24h, yyyymmddHHMM in UTC, derived without Date.now() restrictions
  const now = new Date();
  const fmt = (d) => d.getUTCFullYear().toString()
    + String(d.getUTCMonth() + 1).padStart(2, "0")
    + String(d.getUTCDate()).padStart(2, "0")
    + String(d.getUTCHours()).padStart(2, "0") + "00";
  const start = new Date(now.getTime() - 24 * 3600 * 1000);
  return { periodStart: fmt(start), periodEnd: fmt(now) };
}

// Extract one coherent latest-interval snapshot per PSR type from a single zone's
// A75 XML. ENTSO-E commonly returns MULTIPLE <TimeSeries> for the same psrType in
// one response (per-day or curveType splits, or out-bidding-zone consumption). These
// must NOT be summed — we keep, per psrType, the quantity from the TimeSeries whose
// <Period> ends latest (and the highest position within it). Returns the freshest
// snapshot for one zone; callers sum ACROSS zones, not across a zone's TimeSeries.
export function entsoeByType(xml) {
  const perPsr = {}; // psr -> { end, pos, qty }
  let latestEnd = "";
  const series = xml.split("<TimeSeries>").slice(1);
  for (const ts of series) {
    const psr = (ts.match(/<psrType>([^<]+)<\/psrType>/) || [])[1];
    if (!psr) continue;
    const end = (ts.match(/<timeInterval>[\s\S]*?<end>([^<]+)<\/end>[\s\S]*?<\/timeInterval>/) || [])[1] || "";
    // highest-position (latest) point within this TimeSeries, parsed per <Point>
    let bestPos = -1, bestQty = null;
    for (const pt of ts.split("<Point>").slice(1)) {
      const pos = Number((pt.match(/<position>(\d+)<\/position>/) || [])[1]);
      const qty = parseFloat((pt.match(/<quantity>([\d.eE+-]+)<\/quantity>/) || [])[1]);
      if (Number.isFinite(pos) && Number.isFinite(qty) && pos > bestPos) { bestPos = pos; bestQty = qty; }
    }
    if (bestQty == null) continue;
    const cur = perPsr[psr];
    if (!cur || end > cur.end || (end === cur.end && bestPos > cur.pos)) {
      perPsr[psr] = { end, pos: bestPos, qty: bestQty };
    }
    if (end > latestEnd) latestEnd = end;
  }
  const byType = {};
  for (const [psr, v] of Object.entries(perPsr)) byType[psr] = v.qty;
  return { byType, latestEnd };
}

// Renewable share (%) + estimated grid carbon (gCO₂/kWh) from merged PSR totals.
export function computeEntsoe(byType) {
  let total = 0, renew = 0, emis = 0;
  for (const [psr, q] of Object.entries(byType)) {
    if (ENTSOE_STORAGE.has(psr)) continue; // storage, not generation
    total += q;
    if (ENTSOE_RENEWABLE_PSR.has(psr)) renew += q;
    emis += q * (ENTSOE_EMISSION[psr] ?? 700);
  }
  if (total <= 0) throw new Error("ENTSO-E: zero total");
  return { renewable: round1(clampPct((renew / total) * 100)), carbon: Math.round(emis / total) };
}

async function fetchEntsoe(token, domain) {
  const domains = Array.isArray(domain) ? domain : [domain];
  const { periodStart, periodEnd } = entsoeWindow();
  const byType = {}; // summed ACROSS zones (each zone's snapshot deduped internally)
  let ok = 0, latestEnd = "";
  for (const d of domains) {
    const url = `https://web-api.tp.entsoe.eu/api?securityToken=${token}`
      + `&documentType=A75&processType=A16&in_Domain=${d}`
      + `&periodStart=${periodStart}&periodEnd=${periodEnd}`;
    try {
      const xml = await fetchText(url);
      if (xml.includes("Acknowledgement_MarketDocument")) continue; // this zone had no data
      const { byType: zb, latestEnd: ze } = entsoeByType(xml);
      if (!Object.keys(zb).length) continue;
      for (const [psr, q] of Object.entries(zb)) byType[psr] = (byType[psr] || 0) + q;
      if (ze > latestEnd) latestEnd = ze;
      ok++;
    } catch { /* skip this zone, keep others */ }
  }
  // Require a quorum of zones for multi-zone countries so a partial response can't
  // masquerade as a complete country figure; otherwise keep the annual value.
  const needed = domains.length > 1 ? Math.ceil(domains.length / 2) : 1;
  if (ok < needed) throw new Error(`ENTSO-E: only ${ok}/${domains.length} zones returned data (need ${needed})`);
  const { renewable, carbon } = computeEntsoe(byType);
  return {
    renewable, carbon, carbonEstimated: true,
    source: domains.length > 1 ? "ENTSO-E Transparency Platform (zones)" : "ENTSO-E Transparency Platform",
    at: isoMinuteZ(latestEnd) || isoMinuteZ(periodEnd),
  };
}

// ---- main ------------------------------------------------------------------
async function main() {
  const data = JSON.parse(readFileSync(resolve(root, "src", "data", "countries.json"), "utf8"));
  const names = new Set(data.countries.map((c) => c.match));
  const live = {};
  const tally = [];

  const add = (name, rec) => { if (names.has(name)) { live[name] = rec; tally.push(`${name} ${rec.renewable}% (${rec.source.split(" ")[0]})`); } };
  const tryOne = async (name, fn) => {
    try { add(name, await fn()); }
    catch (e) { console.warn(`  – ${name}: ${e.message}`); }
  };

  // ESO — always (no key)
  console.log("• ESO (UK) …");
  await tryOne(ESO_COUNTRY, fetchEso);

  // EIA — if key present
  const eiaKey = process.env.EIA_KEY;
  if (eiaKey) {
    console.log("• EIA (US) …");
    for (const [name, respondent] of Object.entries(EIA_RESPONDENT)) {
      await tryOne(name, () => fetchEia(eiaKey, respondent));
    }
  } else console.log("• EIA skipped (no EIA_KEY)");

  // ENTSO-E — if token present
  const token = process.env.ENTSOE_TOKEN;
  if (token) {
    console.log("• ENTSO-E (EU) …");
    for (const [name, domain] of Object.entries(ENTSOE_DOMAINS)) {
      await tryOne(name, () => fetchEntsoe(token, domain));
    }
  } else console.log("• ENTSO-E skipped (no ENTSOE_TOKEN)");

  const out = {
    generatedAt: new Date().toISOString(),
    countries: live,
  };
  writeFileSync(resolve(root, "src", "data", "live.json"), JSON.stringify(out) + "\n");
  console.log(`\n✓ wrote src/data/live.json — ${Object.keys(live).length} live territories`);
  if (tally.length) console.log("  " + tally.join("  ·  "));
}

// Run only when invoked directly (not when imported for testing).
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
