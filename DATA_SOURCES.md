# Data sources & licensing

ESGMap's numeric headline metrics are ingested from authoritative open datasets by
[`scripts/build-data.mjs`](scripts/build-data.mjs). Each source is normalised on ISO-3166
alpha-3 codes, mapped to the Natural Earth `name` used by the map, and stamped with the date it
was retrieved. The full provenance table (with retrieval dates) is also rendered live in the
app's **Methodology** view.

Countries with no upstream value for a metric are emitted as `null` and render grey / "no data"
in the UI — figures are never fabricated.

## Live, ingested metrics

| Metric(s) | Source | Endpoint | License |
|---|---|---|---|
| Renewable electricity share, grid carbon intensity, electricity use per capita, electricity mix, 2000→latest history | **Our World in Data — Energy** (compiled from Ember and the Energy Institute Statistical Review) | `raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv` | CC BY 4.0 |
| CO₂ per capita | **Our World in Data — CO₂ & Greenhouse Gas Emissions** (Global Carbon Project) | `raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv` | CC BY 4.0 |
| Forest cover (% land) | **World Bank** `AG.LND.FRST.ZS` (FAO Forest Resources Assessment) | `api.worldbank.org/v2/country/all/indicator/AG.LND.FRST.ZS` | CC BY 4.0 |
| Air quality (PM2.5, µg/m³) | **World Bank** `EN.ATM.PM25.MC.M3` (WHO / IHME Global Burden of Disease) | `api.worldbank.org/v2/country/all/indicator/EN.ATM.PM25.MC.M3` | CC BY 4.0 |

## Near-real-time layer (hourly overlay)

Countries covered by a free national grid-operator API also carry a **live** renewable-share
reading (and grid carbon where published), ingested by
[`scripts/build-live.mjs`](scripts/build-live.mjs) into `src/data/live.json` and refreshed hourly
by the deploy workflow. This is a snapshot of instantaneous generation mix — labelled distinctly
from the annual share, never blended into it.

| Source | Coverage | Endpoint | Token | License |
|---|---|---|---|---|
| **National Energy System Operator (UK)** | United Kingdom | `api.carbonintensity.org.uk/generation` + `/intensity` | none | CC BY 4.0 |
| **U.S. EIA Grid Monitor** | United States | `api.eia.gov/v2/electricity/rto/fuel-type-data` | `EIA_KEY` (free) | Public domain (US Gov) |
| **ENTSO-E Transparency Platform** | ~25 European countries (incl. zone-summed Norway/Sweden/Denmark) | `web-api.tp.entsoe.eu` (A75/A16) | `ENTSOE_TOKEN` (free) | © ENTSO-E, reuse permitted with attribution |

Renewable classification: UK = biomass + hydro + solar + wind; EIA = SUN + WND + WAT; ENTSO-E =
PSR B01/B09/B11/B12/B13/B15/B16/B18/B19 (excludes B10/B25 storage and B17 waste). Multi-bidding-zone
countries (Norway, Sweden, Denmark) are summed across their price zones; Iceland is an isolated grid
with no ENTSO-E feed and keeps its annual value.

**Live grid carbon (gCO₂/kWh):** measured directly for the UK (NESO); for EIA and ENTSO-E it is
*estimated* by weighting the live generation mix with lifecycle emission factors (IPCC AR5 medians —
e.g. lignite 1050, hard coal 820, gas 490, oil 700, biomass 230, solar 45, hydro 24, wind 11,
nuclear 12). Estimated values are shown with a leading “~”. Factors live in
`scripts/live-sources.mjs` (`ENTSOE_EMISSION`, `EIA_EMISSION`).

## Curated, dated layer (slow-moving / categorical)

These fields update rarely and are maintained as a curated JSON
([`scripts/country-meta.json`](scripts/country-meta.json)), compiled from the cited public
authorities. They are versioned in-repo and carry the same retrieval stamp.

| Field(s) | Authority |
|---|---|
| Paris Agreement status, 2030 NDC target | UNFCCC NDC Registry; Climate Watch (WRI) |
| Net-zero target year | Net Zero Tracker (Oxford / ECIU); Climate Watch |
| IFRS S1 / S2 adoption, ESG regime | IFRS Foundation jurisdiction profiles; IOSCO |
| EV sales share | IEA Global EV Outlook |
| Climate-risk exposure (0–100) | ND-GAIN Country Index |
| Region, capital, tier | Compiled reference metadata |

## Derived metric

**Sustainability score (0–100)** — a transparent composite, not a third-party index. It is a
weighted blend of normalised sub-scores, renormalised over whichever are available per country:

| Weight | Sub-score | Transform |
|---|---|---|
| 30% | Clean-power share | renewable % (0–100) |
| 25% | Grid carbon | `100 × (1 − min(carbon / 800, 1))` |
| 20% | CO₂ per capita | `100 × (1 − min(co2pc / 25, 1))` |
| 15% | Disclosure readiness | blend of Paris ratification, net-zero pledge, IFRS S1/S2 (rich tier only) |
| 10% | Climate risk | `100 − climate` |

The exact weights live in `scripts/build-data.mjs` (`SCORE_WEIGHTS`) and are surfaced in the
Methodology view.

## Map geometry

- **Natural Earth 110m** country boundaries via [`world-atlas`](https://github.com/topojson/world-atlas)
  `countries-110m.json`, self-hosted at `public/geo/countries-110m.json`. Public domain (Natural Earth).

## Attribution

When publishing, retain attribution to Our World in Data, the World Bank, and the policy
authorities above. OWID and World Bank data are released under Creative Commons BY 4.0; cite the
source and the retrieval date shown in the Methodology view.

## Reproducing the dataset

```bash
npm run build:data     # re-ingest the annual feeds → src/data/countries.json
npm run build:live     # refresh the live overlay → src/data/live.json (UK with no token)
npm run build:meta     # regenerate the curated layer from the design handoff (rarely needed)
```
