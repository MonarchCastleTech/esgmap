/* ESGMap — typed data layer.
 *
 * Mirrors the prototype's `window.ESG` contract against the real, ingested
 * dataset (src/data/countries.json, produced by scripts/build-data.mjs).
 */
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import raw from "./countries.json";
import liveRaw from "./live.json";
import type {
  CountryRecord, Dataset, LiveOverlay, MetricKey, MetricMeta, RegionTrend, Region,
} from "../types";

const data = raw as unknown as Dataset;

export const META = data.meta;
export const all: CountryRecord[] = data.countries;
export const YEAR_MIN = data.meta.yearMin;
export const YEAR_MAX = data.meta.yearMax;
export const NO_DATA = "#2c352d"; // matches the --no-data design-handoff token

// Merge the near-real-time overlay (generated hourly by scripts/build-live.mjs,
// baked into the deployed build). Absent/empty in normal local builds.
const liveOverlay = liveRaw as unknown as LiveOverlay;
for (const c of all) c.live = liveOverlay.countries[c.match] ?? null;

export const LIVE_GENERATED_AT = liveOverlay.generatedAt;
export const LIVE_COUNT = Object.keys(liveOverlay.countries).length;

/** matchName → record */
export const byName: Record<string, CountryRecord> = {};
for (const c of all) byName[c.match] = c;

// Common alias spellings → Natural Earth match name (the ingestion pipeline
// normalises on ISO-3, so this only catches feature-name variants at lookup).
const ALIAS: Record<string, string> = {
  "United States of America": "United States of America",
  USA: "United States of America",
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "Republic of Korea": "South Korea",
  Korea: "South Korea",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "DR Congo": "Dem. Rep. Congo",
  "Congo (Kinshasa)": "Dem. Rep. Congo",
  "Türkiye": "Turkey",
  "Russian Federation": "Russia",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
};

export function lookupByName(n: string | null | undefined): CountryRecord | null {
  if (!n) return null;
  if (byName[n]) return byName[n];
  if (ALIAS[n] && byName[ALIAS[n]]) return byName[ALIAS[n]];
  return null;
}

export type ColorScale = ScaleLinear<string, string>;
export type Scales = Record<MetricKey, ColorScale>;
export type Palette = "default" | "cividis" | "mono";

export const PALETTES: { id: Palette; label: string; note: string }[] = [
  { id: "default", label: "Default", note: "green → red" },
  { id: "cividis", label: "Colourblind-safe", note: "cividis (CVD-safe)" },
  { id: "mono", label: "Greyscale", note: "print / monochrome" },
];

// Per-metric domain breakpoints + the hand-tuned default ranges + good-direction.
const SCALE_DEFS: Record<MetricKey, { domain: number[]; range: string[]; better: "high" | "low" }> = {
  renewable: { domain: [0, 20, 40, 60, 80, 100], range: ["#7a4a1e", "#a06a22", "#c2982e", "#9bbf4a", "#5aae54", "#2f9e57"], better: "high" },
  carbon: { domain: [0, 150, 300, 600, 900, 1200], range: ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"], better: "low" },
  score: { domain: [20, 40, 60, 80, 95], range: ["#b34334", "#d4823c", "#e0c542", "#7fb35a", "#2f9e57"], better: "high" },
  co2pc: { domain: [0, 2, 6, 12, 20, 35], range: ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"], better: "low" },
  pm25: { domain: [0, 10, 25, 40, 60, 100], range: ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"], better: "low" },
  forest: { domain: [0, 15, 35, 55, 80], range: ["#8a6a3a", "#bfa24a", "#9bbf4a", "#4fa85a", "#1f7a44"], better: "high" },
  climate: { domain: [15, 30, 45, 60, 80], range: ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#b34334"], better: "low" },
};

// Sequential ramps, dark (bad) → bright (good). Both are CVD-/print-robust.
const CIVIDIS = ["#00204d", "#26456e", "#576770", "#a69d75", "#ffea46"];
const MONO = ["#39433b", "#5e685f", "#8a948c", "#bcc6bd", "#eef3ee"];

/** d3 color scales per metric. palette: hand-tuned 'default', CVD-safe 'cividis', or 'mono' greyscale. */
export function buildScales(palette: Palette = "default"): Scales {
  const ramp = (stops: string[]) =>
    scaleLinear<string>().domain(stops.map((_, i) => i / (stops.length - 1))).range(stops).interpolate(interpolateRgb);
  const out = {} as Scales;
  for (const key of Object.keys(SCALE_DEFS) as MetricKey[]) {
    const def = SCALE_DEFS[key];
    let range = def.range;
    if (palette !== "default") {
      const stops = palette === "cividis" ? CIVIDIS : MONO;
      const r = ramp(stops);
      const lo = def.domain[0], hi = def.domain[def.domain.length - 1];
      range = def.domain.map((d) => {
        const t = (d - lo) / (hi - lo);
        return r(def.better === "high" ? t : 1 - t); // good end → bright
      });
    }
    out[key] = scaleLinear<string>().domain(def.domain).range(range).clamp(true).interpolate(interpolateRgb);
  }
  return out;
}

/** Recompute the composite from a country's stored sub-scores under arbitrary weights
 *  (the same renormalise-over-available logic as the build). Used by the Score Lab. */
export function scoreWith(subscores: CountryRecord["subscores"], weights: Record<string, number>): number | null {
  let wsum = 0, acc = 0;
  for (const k of Object.keys(weights)) {
    const v = subscores[k as keyof typeof subscores];
    if (v == null) continue;
    wsum += weights[k];
    acc += weights[k] * v;
  }
  return wsum ? Math.round(acc / wsum) : null;
}

export const METRICS: Record<MetricKey, MetricMeta> = {
  renewable: { key: "renewable", label: "Renewable electricity", short: "Renewables", unit: "%", domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], hasHistory: true, better: "high", fmt: (v) => (v == null ? "—" : Math.round(v) + "%") },
  carbon: { key: "carbon", label: "Grid carbon intensity", short: "Carbon intensity", unit: "gCO₂/kWh", domain: [0, 1200], ticks: [0, 300, 600, 900, 1200], hasHistory: true, better: "low", fmt: (v) => (v == null ? "—" : Math.round(v) + "") },
  co2pc: { key: "co2pc", label: "CO₂ emissions per capita", short: "CO₂ / capita", unit: "t/yr", domain: [0, 35], ticks: [0, 10, 20, 30], hasHistory: false, better: "low", fmt: (v) => (v != null ? v : "—") + "" },
  pm25: { key: "pm25", label: "Air quality (PM2.5)", short: "Air quality", unit: "µg/m³", domain: [0, 100], ticks: [0, 25, 50, 75, 100], hasHistory: false, better: "low", fmt: (v) => (v != null ? Math.round(v) : "—") + "" },
  forest: { key: "forest", label: "Forest cover", short: "Forest", unit: "% land", domain: [0, 100], ticks: [0, 25, 50, 75, 100], hasHistory: false, better: "high", fmt: (v) => (v != null ? Math.round(v) : "—") + "%" },
  climate: { key: "climate", label: "Climate-risk exposure", short: "Climate risk", unit: "/100", domain: [0, 100], ticks: [0, 25, 50, 75, 100], hasHistory: false, better: "low", fmt: (v) => (v != null ? Math.round(v) : "—") + "" },
  score: { key: "score", label: "Sustainability score", short: "Sustainability", unit: "/100", domain: [0, 100], ticks: [0, 25, 50, 75, 100], hasHistory: false, better: "high", fmt: (v) => (v == null ? "—" : Math.round(v) + "") },
};

/** Current or historical value (null when no data). History exists for renewable & carbon. */
export function valueAt(
  rec: CountryRecord | null,
  metricKey: MetricKey,
  year: number | null,
): number | null {
  if (!rec) return null;
  if ((metricKey === "renewable" || metricKey === "carbon") && rec.history && year != null && year < YEAR_MAX) {
    const i = Math.max(0, Math.min(rec.history.years.length - 1, year - YEAR_MIN));
    return rec.history[metricKey][i];
  }
  const v = rec[metricKey];
  return v == null ? null : (v as number);
}

/** Explain which upstream observation backs a displayed map value. */
export function vintageAt(rec: CountryRecord | null, metricKey: MetricKey, year: number | null): string | null {
  if (!rec) return null;
  if ((metricKey === "renewable" || metricKey === "carbon") && rec.history && year != null) {
    const i = Math.max(0, Math.min(rec.history.years.length - 1, year - YEAR_MIN));
    if (rec.history[metricKey][i] == null) return null;
    return rec.history.interpolated[metricKey][i]
      ? `carried forward from ${rec.history.lastRealYear[metricKey] ?? "an earlier observation"}`
      : `observed ${rec.history.years[i]}`;
  }
  const observedYear = rec.years?.[metricKey as keyof typeof rec.years];
  return observedYear == null ? null : `observed ${observedYear}`;
}

const REGIONS: Region[] = ["Europe", "Asia", "Americas", "Africa", "Middle East", "Oceania", "Eurasia"];

/** Average a history metric across the rich-tier members of each region, per year. */
export function regionalTrend(metricKey: "renewable" | "carbon"): RegionTrend[] {
  const years: number[] = [];
  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) years.push(y);
  const out: RegionTrend[] = [];
  for (const rg of REGIONS) {
    const members = all.filter((c) => c.region === rg && c.tier === "rich" && c.history);
    if (!members.length) continue;
    const values = years.map((_, i) => {
      let s = 0, n = 0;
      for (const c of members) {
        const v = c.history![metricKey][i];
        if (v != null) { s += v; n++; }
      }
      return n ? Math.round((s / n) * 10) / 10 : 0;
    });
    out.push({ region: rg, years, values, n: members.length });
  }
  return out;
}

export const ESG = {
  META, all, byName, lookupByName, buildScales, METRICS, valueAt, vintageAt, regionalTrend,
  YEAR_MIN, YEAR_MAX, NO_DATA,
};
