/**
 * ESGMap — live-source configuration.
 *
 * Maps the territories in the dataset to the free, official grid feeds that
 * publish near-real-time generation, plus the renewable-fuel classification
 * each one uses. Sources requiring a token activate only when that token is
 * present in the environment (see build-live.mjs); UK (ESO) needs none.
 *
 *   ESO  (api.carbonintensity.org.uk)  → United Kingdom            no key
 *   EIA  (api.eia.gov v2 RTO)          → United States             EIA_KEY
 *   ENTSO-E (web-api.tp.entsoe.eu)     → ~European single-zone TSOs ENTSOE_TOKEN
 *
 * Multi-bidding-zone countries (Norway, Sweden, Denmark, Italy macro-zones)
 * are intentionally omitted — country-level generation can't be read from a
 * single ENTSO-E domain without zone aggregation — so they keep their annual
 * value and are labelled "annual". Coverage can be widened later.
 */

// ENTSO-E control-area / country EIC domains that report "actual generation per
// production type" (documentType A75, processType A16). A value may be a single
// domain string or an array of bidding-zone domains that are summed to recover a
// country-level figure (Norway, Sweden, Denmark are split into price zones).
export const ENTSOE_DOMAINS = {
  France: "10YFR-RTE------C",
  Germany: "10Y1001A1001A82H", // DE-LU
  Spain: "10YES-REE------0",
  Portugal: "10YPT-REN------W",
  Belgium: "10YBE----------2",
  Netherlands: "10YNL----------L",
  Austria: "10YAT-APG------L",
  Switzerland: "10YCH-SWISSGRIDZ",
  Poland: "10YPL-AREA-----S",
  Czechia: "10YCZ-CEPS-----N",
  Italy: "10YIT-GRTN-----B",
  Greece: "10YGR-HTSO-----Y",
  Romania: "10YRO-TEL------P",
  Hungary: "10YHU-MAVIR----U",
  Slovakia: "10YSK-SEPS-----K",
  Bulgaria: "10YCA-BULGARIA-R",
  Croatia: "10YHR-HEP------M",
  Finland: "10YFI-1--------U",
  Ireland: "10Y1001A1001A59C", // SEM (all-island)
  Turkey: "10YTR-TEIAS----W",
  Ukraine: "10Y1001C--00003F", // Ukraine IPS (ENTSO-E synchronous since 2022)
  Serbia: "10YCS-SERBIATSOV",
  // multi-bidding-zone countries — summed across price zones
  Norway: ["10YNO-1--------2", "10YNO-2--------T", "10YNO-3--------J", "10YNO-4--------9", "10Y1001A1001A48H"],
  Sweden: ["10Y1001A1001A44P", "10Y1001A1001A45N", "10Y1001A1001A46L", "10Y1001A1001A47J"],
  Denmark: ["10YDK-1--------W", "10YDK-2--------M"],
};

// Lifecycle CO₂-equivalent emission factors (gCO₂eq/kWh), keyed by ENTSO-E PSR
// code, used to ESTIMATE live grid carbon from the generation mix (IPCC AR5
// median lifecycle values; biomass and waste are approximate by nature).
export const ENTSOE_EMISSION = {
  B01: 230,  // Biomass
  B02: 1050, // Fossil Brown coal / Lignite
  B03: 820,  // Fossil Coal-derived gas
  B04: 490,  // Fossil Gas
  B05: 820,  // Fossil Hard coal
  B06: 700,  // Fossil Oil
  B07: 900,  // Fossil Oil shale
  B08: 1000, // Fossil Peat
  B09: 38,   // Geothermal
  B11: 24,   // Hydro Run-of-river
  B12: 24,   // Hydro Water Reservoir
  B13: 17,   // Marine
  B14: 12,   // Nuclear
  B15: 30,   // Other renewable
  B16: 45,   // Solar
  B17: 580,  // Waste
  B18: 11,   // Wind Offshore
  B19: 11,   // Wind Onshore
  B20: 700,  // Other (assumed fossil-ish)
};

// Same idea for EIA RTO fuel-type ids.
export const EIA_EMISSION = {
  COL: 820, NG: 490, NUC: 12, OIL: 700, SUN: 45, WAT: 24, WND: 11, OTH: 400,
};

// ENTSO-E PSR (production-source) type codes counted as renewable.
// Excludes B10 Hydro Pumped Storage (storage) and B17 Waste (mixed origin).
export const ENTSOE_RENEWABLE_PSR = new Set([
  "B01", // Biomass
  "B09", // Geothermal
  "B11", // Hydro Run-of-river and poundage
  "B12", // Hydro Water Reservoir
  "B13", // Marine
  "B15", // Other renewable
  "B16", // Solar
  "B18", // Wind Offshore
  "B19", // Wind Onshore
]);

// ESO (UK National Energy System Operator) generation-mix fuels counted as renewable.
export const ESO_RENEWABLE = new Set(["biomass", "hydro", "solar", "wind"]);

// EIA RTO fuel-type ids counted as renewable. (Biomass/geothermal fall under the
// aggregated "OTH" bucket and are excluded to avoid over-counting.)
export const EIA_RENEWABLE = new Set(["SUN", "WND", "WAT"]);

// match-name → EIA respondent (balancing-authority) code.
export const EIA_RESPONDENT = { "United States of America": "US" };

// match-name that ESO covers.
export const ESO_COUNTRY = "United Kingdom";
