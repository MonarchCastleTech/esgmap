import { useState } from "react";
import * as ESG from "../data/esg";
import { OverlayCard } from "./OverlayCard";
import { Icon } from "../ui/Icon";
import { citation, attributionBlock, type CiteFormat } from "../lib/cite";
import { fmtDate } from "../lib/format";

const BASE = import.meta.env.BASE_URL;
const datasetUrl = () => (typeof location !== "undefined" ? location.origin + location.pathname : "https://monarchcastletech.github.io/esgmap/");

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

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 24, marginBottom: 8, fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{children}</div>;
}

const LIMITATIONS = [
  "CO₂ per capita is production-based (territorial) — it excludes emissions embodied in imports, so trade-heavy economies look cleaner than consumption accounting would show.",
  "Grid carbon intensity covers electricity generation only, not whole-economy emissions (transport, heat, industry).",
  "The composite renormalises over whichever sub-scores a country has. Base-tier countries carry no disclosure sub-score, so their score reflects only energy/environment components and can read high despite weak governance — compare the “scored on N/5 indicators” note before ranking.",
  "Edition-year headline values may be the most recent observation carried forward (no new data that year). Each value shows its true observation year, and carried-forward history is drawn dashed.",
  "Different metrics resolve to different observation years (e.g. forest may be 2023 while renewables are 2025). Vintages are shown per value and never silently aligned.",
  "Live readings are an instantaneous generation snapshot, not an annual average; live grid carbon is measured for the UK and estimated from the mix (lifecycle factors) elsewhere.",
  "Net-zero contributes a credit graded by target year — a modelled proxy for ambition, not an official score.",
  "Sub-indicators are correlated (e.g. clean-power share and grid carbon) — see the Validation view; the composite is one defensible weighting, not the weighting. Use the Score Lab to test sensitivity.",
];

export function AboutOverlay({ onClose }: { onClose: () => void }) {
  const M = ESG.META;
  const { sources, generatedAt, yearMin, yearMax, scoreWeights } = M;
  const weightLine = Object.entries(scoreWeights).map(([k, w]) => `${Math.round(w * 100)}% ${labelFor(k)}`).join(" · ");
  const [fmt, setFmt] = useState<CiteFormat>("bibtex");
  const [copied, setCopied] = useState("");
  const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(""), 1400); });
  const citeText = citation(fmt, datasetUrl());

  const DL = [
    { href: BASE + "downloads/esgmap-wide.csv", label: "Wide table (CSV)", note: "one row per country" },
    { href: BASE + "downloads/esgmap-tidy-long.csv", label: "Tidy / long (CSV)", note: "country × metric, R/pandas-ready" },
    { href: BASE + "downloads/esgmap-history-long.csv", label: "History (CSV)", note: `${yearMin}–${yearMax}, interpolated flag` },
    { href: BASE + "downloads/esgmap-wide.json", label: "Full dataset (JSON)", note: "meta + countries" },
    { href: BASE + "downloads/data-dictionary.json", label: "Codebook (JSON)", note: "field-by-field dictionary" },
    { href: BASE + "schema/countries.schema.json", label: "JSON Schema", note: "draft 2020-12" },
    { href: BASE + "api/index.json", label: "API index (JSON)", note: "per-country & per-metric endpoints" },
    { href: BASE + "build-manifest.json", label: "Build manifest", note: "reproducibility provenance" },
  ];

  return (
    <OverlayCard title="Methodology, sources & data" icon="info" onClose={onClose} width={680}>
      <div style={{ overflowY: "auto", flex: 1, fontSize: 13.5, lineHeight: 1.62, color: "var(--text-2)" }}>
        <p style={{ marginTop: 0 }}>
          <b style={{ color: "var(--text)" }}>ESGMap</b> visualises national sustainability indicators on an interactive world map.
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
        <Def t="Sustainability score" d={`Composite 0–100 index. Weighted blend of normalised sub-scores (renormalised over whichever are available): ${weightLine}. Carbon, CO₂/capita and climate risk are inverted; disclosure blends Paris ratification, a year-graded net-zero pledge, and IFRS S1/S2 adoption. Test the weights in the Score Lab.`} src="ESGMap composite (derived from the variables above)" />
        <Def t="Paris Agreement, NDC & net-zero" d="Ratification of the 2015 Paris Agreement, the headline 2030 NDC target, and the national net-zero target year (curated, slow-moving)." src="UNFCCC NDC Registry; Climate Watch (WRI); Net Zero Tracker (Oxford / ECIU)" />
        <Def t="IFRS S1 / S2" d="Adoption status of the ISSB's IFRS S1 (general sustainability) and S2 (climate) disclosure standards (curated)." src="IFRS Foundation jurisdiction profiles; IOSCO" />

        {/* ---- Citation ---- */}
        <SectionHead>Cite this dataset</SectionHead>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["bibtex", "ris", "apa"] as CiteFormat[]).map((f) => (
            <button key={f} onClick={() => setFmt(f)} style={{ fontSize: 11.5, padding: "5px 11px", borderRadius: 7, border: "1px solid " + (fmt === f ? "var(--border-2)" : "transparent"), background: fmt === f ? "var(--panel-2)" : "transparent", color: fmt === f ? "var(--text)" : "var(--text-3)", textTransform: "uppercase" }}>{f}</button>
          ))}
          <button onClick={() => copy(citeText, "cite")} style={{ marginLeft: "auto", fontSize: 11.5, padding: "5px 11px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel-2)", color: copied === "cite" ? "var(--accent)" : "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name={copied === "cite" ? "check" : "doc"} size={13} />{copied === "cite" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mono" style={{ margin: 0, padding: "11px 13px", background: "#0c100e", border: "1px solid var(--border)", borderRadius: 9, fontSize: 11, color: "var(--text-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflow: "auto" }}>{citeText}</pre>

        {/* ---- Downloads & API ---- */}
        <SectionHead>Download data &amp; API <span style={{ fontWeight: 400, color: "var(--text-3)", fontSize: 11.5 }}>· CC BY 4.0</span></SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {DL.map((d) => (
            <a key={d.href} href={d.href} download style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--panel-2)", textDecoration: "none" }}>
              <Icon name="arrowDown" size={14} style={{ color: "var(--accent)", flex: "0 0 auto" }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text)" }}>{d.label}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>{d.note}</span>
              </span>
            </a>
          ))}
        </div>

        {/* ---- Limitations ---- */}
        <SectionHead>Limitations &amp; caveats</SectionHead>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
          {LIMITATIONS.map((l, i) => <li key={i} style={{ marginBottom: 6 }}>{l}</li>)}
        </ol>

        {/* ---- Responsible use ---- */}
        <div style={{ marginTop: 16, padding: "13px 15px", background: "rgba(224,162,60,.07)", border: "1px solid rgba(224,162,60,.28)", borderRadius: 10, fontSize: 12.5 }}>
          <b style={{ color: "var(--warn)" }}>Responsible use.</b> The composite encodes normative value choices (the weights); rankings are not objective verdicts on countries or their people. The inputs carry structural bias — disclosure data favours wealthier jurisdictions — so a low score reflects data and methodology as much as performance. Use the colourblind-safe / greyscale palettes for publication, and consult the primary sources for decisions. Not financial or policy advice.
        </div>

        {/* ---- Live layer ---- */}
        {ESG.LIVE_COUNT > 0 && (
          <div style={{ marginTop: 16, padding: "12px 15px", background: "rgba(95,191,127,.07)", border: "1px solid rgba(95,191,127,.28)", borderRadius: 10, fontSize: 12.5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--accent)", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} /> Near-real-time layer
            </span>
            <div style={{ marginTop: 5 }}>
              {ESG.LIVE_COUNT} countries carry a <b>live</b> renewable-share and grid-carbon reading from their national grid operator (UK NESO, U.S. EIA, ENTSO-E), refreshed hourly. A snapshot, not an annual average; carbon is measured for the UK and estimated (“~”) elsewhere.
            </div>
          </div>
        )}

        {/* ---- Sources + license + attribution ---- */}
        <SectionHead>Source provenance &amp; attribution</SectionHead>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {sources.map((s, i) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 13px", borderTop: i ? "1px solid var(--border)" : "none", background: "var(--panel-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>{s.label}</span>
                <span className="mono tnum" style={{ fontSize: 11, color: "var(--accent)", whiteSpace: "nowrap" }}>retrieved {s.retrievedAt}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.metrics.join(", ")} · {s.license}{s.lastUpdated ? ` · source updated ${s.lastUpdated}` : ""}</div>
            </div>
          ))}
        </div>
        <button onClick={() => copy(attributionBlock(), "attr")} style={{ marginTop: 8, fontSize: 11.5, padding: "6px 11px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel-2)", color: copied === "attr" ? "var(--accent)" : "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={copied === "attr" ? "check" : "doc"} size={13} />{copied === "attr" ? "Attribution copied" : "Copy full attribution block"}
        </button>

        {/* ---- Build provenance ---- */}
        <SectionHead>Build provenance &amp; reproducibility</SectionHead>
        <div style={{ fontSize: 12.5 }}>
          This edition was generated on <b>{fmtDate(generatedAt)}</b> from the cited feeds by <span className="mono">scripts/build-data.mjs</span>.
          <div className="mono" style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.7 }}>
            version &nbsp;<span style={{ color: "var(--text-2)" }}>{M.version}</span><br />
            content&nbsp;hash &nbsp;<span style={{ color: "var(--text-2)" }}>{M.contentHash.slice(0, 24)}…</span><br />
            {M.gitSha && <>git &nbsp;<span style={{ color: "var(--text-2)" }}>{M.gitSha}</span> · node {M.nodeVersion}<br /></>}
          </div>
          Re-running <span className="mono">npm run build:data</span> re-fetches the feeds; the content hash verifies an identical edition.
        </div>
      </div>
    </OverlayCard>
  );
}

function labelFor(k: string): string {
  return { renew: "clean power", carbon: "grid carbon", co2: "CO₂/capita", disclosure: "disclosure", climate: "climate risk" }[k] || k;
}
