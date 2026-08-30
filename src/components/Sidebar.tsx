import * as ESG from "../data/esg";
import type { Palette } from "../data/esg";
import { PALETTES } from "../data/esg";
import type { MetricKey } from "../types";
import type { ViewId } from "../App";
import { Icon } from "../ui/Icon";
import { LAYERS } from "../layers";
import { fmtDate } from "../lib/format";

function fmtClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

const NAV: { id: ViewId | "map"; label: string; icon: string }[] = [
  { id: "map", label: "Map", icon: "map" },
  { id: "rankings", label: "Rankings", icon: "rank" },
  { id: "trends", label: "Regional trends", icon: "arrowUp" },
  { id: "explore", label: "Explore", icon: "compare" },
  { id: "scorelab", label: "Score Lab", icon: "target" },
  { id: "validate", label: "Validation", icon: "doc" },
  { id: "compare", label: "Compare", icon: "layers" },
  { id: "about", label: "Methodology", icon: "info" },
];

export function Sidebar({ view, setView, metric, setMetric, palette, setPalette }: {
  view: ViewId | null;
  setView: (v: ViewId | null) => void;
  metric: MetricKey;
  setMetric: (m: MetricKey) => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
}) {
  return (
    <aside className="esg-sidebar" style={{ background: "var(--panel)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "20px 16px 16px", overflowY: "auto", minHeight: 0 }}>
      <div className="esg-brand" style={{ display: "flex", alignItems: "center", gap: 14, padding: "2px 6px 20px" }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ESGMap logo" className="esg-brand-logo" />
        <div>
          <div className="esg-brand-name">ESGMap</div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", letterSpacing: ".02em" }}>Global Sustainability Atlas</div>
          <div className="esg-endorsement">Part of Monarch Castle Technologies.</div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = view === n.id || (n.id === "map" && view === null);
          return (
            <button key={n.id} onClick={() => setView(n.id === "map" ? null : (n.id as ViewId))}
              style={{
                display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 8, border: "none",
                background: active ? "var(--elev)" : "transparent", color: active ? "var(--text)" : "var(--text-2)",
                fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: "left", transition: "background .15s, color .15s",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--panel-2)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={n.icon} size={17} style={{ color: active ? "var(--accent)" : "var(--text-3)" }} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div style={{ height: 1, background: "var(--border)", margin: "18px 6px" }} />

      <div style={{ padding: "0 6px" }}>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 10 }}>Map layer</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LAYERS.map((l) => {
            const active = metric === l.value;
            return (
              <button key={l.value} onClick={() => setMetric(l.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "10px 11px", borderRadius: 9,
                  border: "1px solid " + (active ? "var(--border-2)" : "transparent"),
                  background: active ? "var(--panel-2)" : "transparent", textAlign: "left", transition: "background .15s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--panel-2)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 30, height: 30, borderRadius: 7, display: "grid", placeItems: "center", flex: "0 0 auto", background: active ? "rgba(95,191,127,.13)" : "var(--elev)", color: active ? "var(--accent)" : "var(--text-3)" }}>
                  <Icon name={l.icon} size={16} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "var(--text)" : "var(--text-2)" }}>{l.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{l.desc}</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* palette (colourblind-safe / print) */}
      <div style={{ padding: "0 6px 12px" }}>
        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 6 }}>Palette</div>
        <div style={{ display: "flex", gap: 4 }}>
          {PALETTES.map((p) => (
            <button key={p.id} onClick={() => setPalette(p.id)} title={p.note}
              style={{ flex: 1, fontSize: 10.5, padding: "5px 4px", borderRadius: 6, border: "1px solid " + (palette === p.id ? "var(--border-2)" : "transparent"), background: palette === p.id ? "var(--panel-2)" : "transparent", color: palette === p.id ? "var(--text)" : "var(--text-3)" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="esg-freshness" role="status" aria-live="polite" style={{ padding: "0 6px", fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.55 }}>
        {ESG.LIVE_COUNT > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ position: "relative", width: 6, height: 6 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--accent)" }} />
              <span className="live-pulse" style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--accent)" }} />
            </span>
            {ESG.LIVE_COUNT} live now{ESG.LIVE_GENERATED_AT ? ` · ${fmtClock(ESG.LIVE_GENERATED_AT)}` : ""}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)" }} />
            Dataset updated · {fmtDate(ESG.META.generatedAt)}
          </div>
        )}
        <div>Edition {ESG.YEAR_MAX} · {ESG.META.territories} territories</div>
        <div>Annual indicators and optional live overlays are dated separately.</div>
        <a href="https://github.com/MonarchCastleTech/esgmap/blob/master/DATA_SOURCES.md"
          target="_blank" rel="noopener noreferrer">Sources and methodology</a>
      </div>
    </aside>
  );
}
