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
export const NO_DATA = "#222a26";

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

/** d3 color scales per metric (RGB interpolation, clamped). */
export function buildScales(): Scales {
  const mk = (domain: number[], range: string[]): ColorScale =>
    scaleLinear<string>()
      .domain(domain)
      .range(range)
      .clamp(true)
      .interpolate(interpolateRgb);
  return {
    renewable: mk([0, 20, 40, 60, 80, 100], ["#7a4a1e", "#a06a22", "#c2982e", "#9bbf4a", "#5aae54", "#2f9e57"]),
    carbon: mk([0, 150, 300, 600, 900, 1200], ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"]),
    score: mk([20, 40, 60, 80, 95], ["#b34334", "#d4823c", "#e0c542", "#7fb35a", "#2f9e57"]),
    co2pc: mk([0, 2, 6, 12, 20, 35], ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"]),
    pm25: mk([0, 10, 25, 40, 60, 100], ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#d4503e", "#7a2d28"]),
    forest: mk([0, 15, 35, 55, 80], ["#8a6a3a", "#bfa24a", "#9bbf4a", "#4fa85a", "#1f7a44"]),
    climate: mk([15, 30, 45, 60, 80], ["#2f9e57", "#9bbf4a", "#e0c542", "#e08a3c", "#b34334"]),
  };
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
  META, all, byName, lookupByName, buildScales, METRICS, valueAt, regionalTrend,
  YEAR_MIN, YEAR_MAX, NO_DATA,
};
