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

// ENTSO-E control-area / country EIC domains that report country-level
// "actual generation per production type" (documentType A75, processType A16).
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

// ENTSO-E PSR breakdown groups (sub-shares of the same generation total).
export const ENTSOE_FOSSIL_PSR = new Set([
  "B02", // Fossil Brown coal/Lignite
  "B03", // Fossil Coal-derived gas
  "B04", // Fossil Gas
  "B05", // Fossil Hard coal
  "B06", // Fossil Oil
  "B07", // Fossil Oil shale
  "B08", // Fossil Peat
]);
export const ENTSOE_NUCLEAR_PSR = new Set(["B14"]); // Nuclear
export const ENTSOE_WIND_PSR = new Set(["B18", "B19"]); // Wind Offshore + Onshore
export const ENTSOE_SOLAR_PSR = new Set(["B16"]); // Solar

// ESO (UK National Energy System Operator) generation-mix fuels counted as renewable.
export const ESO_RENEWABLE = new Set(["biomass", "hydro", "solar", "wind"]);
// ESO fossil fuels (wind/solar/nuclear are single literal fuel names in the mix).
export const ESO_FOSSIL = new Set(["coal", "gas", "oil"]);

// EIA RTO fuel-type ids counted as renewable. (Biomass/geothermal fall under the
// aggregated "OTH" bucket and are excluded to avoid over-counting.)
export const EIA_RENEWABLE = new Set(["SUN", "WND", "WAT"]);
// EIA fossil fuel-type ids (wind=WND, solar=SUN, nuclear=NUC are single ids).
export const EIA_FOSSIL = new Set(["COL", "NG", "OIL"]);

// match-name → EIA respondent (balancing-authority) code.
export const EIA_RESPONDENT = { "United States of America": "US" };

// match-name that ESO covers.
export const ESO_COUNTRY = "United Kingdom";
