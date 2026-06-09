/* ESGMap — shared domain types. */

export type Region =
  | "Europe" | "Asia" | "Africa" | "Americas" | "Middle East" | "Oceania" | "Eurasia";

export type Tier = "rich" | "base";

export type ParisStatus = "ratified" | "signed" | "withdrawn" | "none";
export type IfrsStatus = "mandatory" | "adopting" | "roadmap" | "consulting" | "none";
export type DisclosureStatus = ParisStatus | IfrsStatus;

/** Map layers that recolor the world (a subset of all record fields). */
export type MetricKey =
  | "renewable" | "carbon" | "co2pc" | "pm25" | "forest" | "climate" | "score";

export interface EnergyMix {
  hydro: number; wind: number; solar: number;
  nuclear: number; fossil: number; other: number;
}

/** Near-real-time reading from a national grid operator (overlay on the annual value). */
export interface LivePoint {
  renewable: number | null;
  carbon: number | null;
  /** True when carbon is estimated from the mix (not measured by the operator). */
  carbonEstimated?: boolean;
  source: string;
  /** ISO timestamp of the upstream interval. */
  at: string;
}

export interface History {
  years: number[];
  /** Real annual points; null where a year has no upstream observation. */
  renewable: (number | null)[];
  carbon: (number | null)[];
  /** True when one or more gaps were carried forward from the previous year. */
  gapFilled: boolean;
}

export interface CountryRecord {
  name: string;
  /** Natural Earth `properties.name` used to match the TopoJSON feature. */
  match: string;
  iso3: string;
  region: Region;
  tier: Tier;
  capital: string | null;

  // real numeric headline metrics (null = no upstream data)
  renewable: number | null;
  carbon: number | null;
  co2pc: number | null;
  energy: number | null;
  mix: EnergyMix | null;
  pm25: number | null;
  forest: number | null;
  climate: number | null;
  ev: number | null;
  score: number | null;

  // curated policy / disclosure (rich tier)
  paris: ParisStatus | null;
  parisYear: number | null;
  ndc: string | null;
  netZero: number | null;
  ifrsS1: IfrsStatus | null;
  ifrsS2: IfrsStatus | null;
  esg: string | null;

  history: History | null;
  /** Optional near-real-time overlay (present only for grid-operator-covered countries). */
  live?: LivePoint | null;
}

export interface LiveOverlay {
  generatedAt: string | null;
  countries: Record<string, LivePoint>;
}

export interface MetricMeta {
  key: MetricKey;
  label: string;
  short: string;
  unit: string;
  domain: [number, number];
  ticks: number[];
  hasHistory: boolean;
  better: "high" | "low";
  fmt: (v: number | null) => string;
}

export interface SourceMeta {
  id: string;
  label: string;
  url: string;
  license: string;
  retrievedAt: string;
  lastUpdated?: string | null;
  metrics: string[];
}

export interface DatasetMeta {
  generatedAt: string;
  yearMin: number;
  yearMax: number;
  territories: number;
  scoreWeights: Record<string, number>;
  sources: SourceMeta[];
}

export interface Dataset {
  meta: DatasetMeta;
  countries: CountryRecord[];
}

export interface RegionTrend {
  region: Region;
  years: number[];
  values: number[];
  n: number;
}
