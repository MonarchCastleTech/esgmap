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
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ENTSOE_DOMAINS, ENTSOE_RENEWABLE_PSR, ESO_RENEWABLE, EIA_RENEWABLE,
  EIA_RESPONDENT, ESO_COUNTRY,
} from "./live-sources.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function fetchText(url, opts = {}) {
  const res = await fetch(url, { headers: { "user-agent": "esgmap-live/1.0" }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.split("?")[0]}`);
  return await res.text();
}
const round1 = (v) => Math.round(v * 10) / 10;

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
  return { renewable: round1(renew), carbon, source: "National Energy System Operator (UK)", at: gen.data.to };
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
  let total = 0, renew = 0;
  for (const r of hour) {
    const v = +r.value;
    if (!Number.isFinite(v) || v < 0) continue;
    total += v;
    if (EIA_RENEWABLE.has(r.fueltype)) renew += v;
  }
  if (total <= 0) throw new Error("EIA: zero total");
  return { renewable: round1((renew / total) * 100), carbon: null, source: "U.S. EIA Grid Monitor", at: `${latest}:00Z` };
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

// Sum the latest interval's quantity per PSR type from the A75 XML.
function parseEntsoe(xml) {
  const byType = {};
  const series = xml.split("<TimeSeries>").slice(1);
  for (const ts of series) {
    const psr = (ts.match(/<psrType>([^<]+)<\/psrType>/) || [])[1];
    if (!psr) continue;
    // collect points, keep the highest position (latest interval)
    let bestPos = -1, bestQty = null;
    const pointRe = /<Point>\s*<position>(\d+)<\/position>\s*<quantity>([\d.]+)<\/quantity>/g;
    let m;
    while ((m = pointRe.exec(ts))) {
      const pos = +m[1];
      if (pos > bestPos) { bestPos = pos; bestQty = +m[2]; }
    }
    if (bestQty != null) byType[psr] = (byType[psr] || 0) + bestQty;
  }
  let total = 0, renew = 0;
  for (const [psr, q] of Object.entries(byType)) {
    if (psr === "B10") continue; // pumped-storage generation excluded
    total += q;
    if (ENTSOE_RENEWABLE_PSR.has(psr)) renew += q;
  }
  if (total <= 0) throw new Error("ENTSO-E: zero total");
  return round1((renew / total) * 100);
}

async function fetchEntsoe(token, domain) {
  const { periodStart, periodEnd } = entsoeWindow();
  const url = `https://web-api.tp.entsoe.eu/api?securityToken=${token}`
    + `&documentType=A75&processType=A16&in_Domain=${domain}`
    + `&periodStart=${periodStart}&periodEnd=${periodEnd}`;
  const xml = await fetchText(url);
  if (xml.includes("Acknowledgement_MarketDocument")) throw new Error("ENTSO-E: acknowledgement (no data / bad token)");
  return { renewable: parseEntsoe(xml), carbon: null, source: "ENTSO-E Transparency Platform", at: `${periodEnd.slice(0, 8)}T${periodEnd.slice(8, 12)}Z` };
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

main().catch((e) => { console.error(e); process.exit(1); });
