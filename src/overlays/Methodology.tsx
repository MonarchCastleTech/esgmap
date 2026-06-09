import * as ESG from "../data/esg";
import { OverlayCard } from "./OverlayCard";

function Def({ t, d, src }: { t: string; d: string; src?: string }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>{t}</div>
      <div style={{ marginTop: 2 }}>{d}</div>
      {src && (
        <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6, fontSize: 11.5 }}>
          <span style={{ color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", flex: "0 0 auto" }}>Source</span>
          <span style={{ color: "var(--accent)" }}>{src}</span>
        </div>
      )}
    </div>
  );
}

export function AboutOverlay({ onClose }: { onClose: () => void }) {
  const { sources, generatedAt, yearMin, yearMax, scoreWeights } = ESG.META;
  const weightLine = Object.entries(scoreWeights)
    .map(([k, w]) => `${Math.round(w * 100)}% ${labelFor(k)}`)
    .join(" · ");

  return (
    <OverlayCard title="Methodology & sources" icon="info" onClose={onClose} width={640}>
      <div style={{ overflowY: "auto", flex: 1, fontSize: 13.5, lineHeight: 1.62, color: "var(--text-2)" }}>
        <p style={{ marginTop: 0 }}>
          <b style={{ color: "var(--text)" }}>ESGMap</b> visualises national sustainability indicators on an interactive world map.
          Choose a <b style={{ color: "var(--text)" }}>map layer</b> in the sidebar, then click any country for its full profile, energy mix, disclosure status and historical trend.
          Numeric metrics are ingested from the open datasets below; a country with no upstream value renders grey and reads <b>“no data”</b> — figures are never invented.
        </p>

        <Def t="Renewable electricity" d="Share of national electricity generation from hydro, wind, solar, geothermal and other renewables. Nuclear is shown in the mix but excluded from the renewable share." src="Our World in Data — Energy (Ember, Energy Institute)" />
        <Def t="Grid carbon intensity" d="CO₂ emitted per kWh of electricity generated, gCO₂/kWh. Lower is cleaner." src="Our World in Data — Energy (carbon_intensity_elec)" />
        <Def t="CO₂ per capita" d="Annual production-based CO₂ emissions divided by population, in tonnes per person." src="Our World in Data — CO₂ & Greenhouse Gas Emissions (Global Carbon Project)" />
        <Def t="Air quality (PM2.5)" d="Population-weighted annual mean concentration of fine particulate matter, µg/m³." src="World Bank EN.ATM.PM25.MC.M3 (WHO / IHME GBD)" />
        <Def t="Forest cover" d="Forest area as a share of total land area." src="World Bank AG.LND.FRST.ZS (FAO Forest Resources Assessment)" />
        <Def t="Electricity use per capita" d="Annual electricity generation per person, kWh." src="Our World in Data — Energy (per_capita_electricity)" />
        <Def t="EV adoption" d="Battery-electric & plug-in hybrid share of new car sales (curated)." src="IEA Global EV Outlook" />
        <Def t="Climate-risk exposure" d="A 0–100 index blending physical climate vulnerability with adaptive readiness — higher means more exposed and less prepared. Lower is better (curated)." src="ND-GAIN Country Index" />
        <Def t="Sustainability score" d={`Composite 0–100 index. Weighted blend of normalised sub-scores (renormalised over whichever are available): ${weightLine}. Carbon and CO₂/capita are inverted; climate risk is inverted; disclosure readiness blends Paris ratification, a net-zero pledge, and IFRS S1/S2 adoption.`} src="ESGMap composite (derived from the variables above)" />
        <Def t="Paris Agreement, NDC & net-zero" d="Ratification of the 2015 Paris Agreement, the headline 2030 NDC target, and the national net-zero target year (curated, slow-moving)." src="UNFCCC NDC Registry; Climate Watch (WRI); Net Zero Tracker (Oxford / ECIU)" />
        <Def t="IFRS S1 / S2" d="Adoption status of the ISSB's IFRS S1 (general sustainability) and S2 (climate) disclosure standards: mandatory, adopting, roadmap, consulting, or none (curated)." src="IFRS Foundation jurisdiction profiles; IOSCO" />

        {ESG.LIVE_COUNT > 0 && (
          <div style={{ marginTop: 18, padding: "12px 15px", background: "rgba(95,191,127,.07)", border: "1px solid rgba(95,191,127,.28)", borderRadius: 10, fontSize: 12.5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--accent)", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} /> Near-real-time layer
            </span>
            <div style={{ marginTop: 5 }}>
              {ESG.LIVE_COUNT} countries also carry a <b>live</b> renewable-share reading from their national grid operator,
              refreshed hourly and shown beside the annual figure on the country panel. Sources: National Energy System
              Operator (UK), U.S. EIA Grid Monitor, and the ENTSO-E Transparency Platform (Europe). Instantaneous mix
              differs from the annual share by design — it's a snapshot, not a yearly average.
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Annual data provenance</div>
        <div style={{ marginTop: 8, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {sources.map((s, i) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 13px", borderTop: i ? "1px solid var(--border)" : "none", background: "var(--panel-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>{s.label}</span>
                <span className="mono tnum" style={{ fontSize: 11, color: "var(--accent)", whiteSpace: "nowrap" }}>retrieved {s.retrievedAt}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {s.metrics.join(", ")} · {s.license}
                {s.lastUpdated ? ` · source updated ${s.lastUpdated}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: "13px 15px", background: "rgba(95,191,127,.08)", border: "1px solid rgba(95,191,127,.3)", borderRadius: 10, color: "var(--text-2)", fontSize: 12.5 }}>
          <b style={{ color: "var(--accent)" }}>Live data.</b> Headline metrics (renewable, carbon, CO₂/capita, PM2.5, forest, electricity use, mix and the {yearMin}–{yearMax} history) are ingested directly from the open datasets above by <span className="mono">scripts/build-data.mjs</span> and stamped with the retrieval dates shown — this edition was generated on <b>{generatedAt}</b>. Slow-moving policy fields (Paris/NDC/net-zero, IFRS S1/S2, EV share, climate-risk) are a curated, dated layer compiled from the cited authorities. Re-running the ingestion script regenerates the dataset reproducibly.
        </div>
      </div>
    </OverlayCard>
  );
}

function labelFor(k: string): string {
  return { renew: "clean power", carbon: "grid carbon", co2: "CO₂/capita", disclosure: "disclosure", climate: "climate risk" }[k] || k;
}
