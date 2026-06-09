import { useState } from "react";
import type { CountryRecord } from "../types";
import type { Scales } from "../data/esg";
import { OverlayCard } from "./OverlayCard";
import { SectionLabel } from "../components/CountryPanel";
import { ScoreRing } from "../ui/ScoreRing";
import { LineChart } from "../ui/LineChart";
import { Segmented } from "../ui/Segmented";
import { Icon } from "../ui/Icon";

type RowKey = "renewable" | "carbon" | "co2pc" | "pm25" | "forest" | "score";
const ROWS: { k: RowKey; label: string; better: "high" | "low"; fmt: (v: number | null) => string }[] = [
  { k: "renewable", label: "Renewable power", better: "high", fmt: (v) => (v != null ? Math.round(v) + "%" : "—") },
  { k: "carbon", label: "Grid carbon", better: "low", fmt: (v) => (v != null ? String(Math.round(v)) : "—") },
  { k: "co2pc", label: "CO₂ / capita", better: "low", fmt: (v) => (v != null ? String(v) : "—") },
  { k: "pm25", label: "Air quality (PM2.5)", better: "low", fmt: (v) => (v != null ? String(Math.round(v)) : "—") },
  { k: "forest", label: "Forest cover", better: "high", fmt: (v) => (v != null ? Math.round(v) + "%" : "—") },
  { k: "score", label: "Sustainability score", better: "high", fmt: (v) => (v != null ? String(Math.round(v)) : "—") },
];

const H_COLOR = { a: "#5fbf7f", b: "#3b8fd4" };

export function CompareOverlay({ pinned, scales, onClose, onRemove }: {
  pinned: CountryRecord[];
  scales: Scales;
  onClose: () => void;
  onRemove: (c: CountryRecord) => void;
}) {
  const [cm, setCm] = useState<"renewable" | "carbon">("renewable");
  const a = pinned[0], b = pinned[1];
  if (!a || !b) {
    return (
      <OverlayCard title="Compare" icon="compare" onClose={onClose} width={520}>
        <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-3)" }}>Pin two countries from the map or rankings to compare them.</div>
      </OverlayCard>
    );
  }

  const Col = ({ c, tone }: { c: CountryRecord; tone: string }) => (
    <div style={{ flex: 1, textAlign: "center", position: "relative" }}>
      <button aria-label={`Remove ${c.name} from comparison`} onClick={() => onRemove(c)} style={{ position: "absolute", top: -4, right: 0, width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel-2)", color: "var(--text-3)", display: "grid", placeItems: "center" }}><Icon name="close" size={12} /></button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: tone }} />
        <div style={{ fontSize: 16, fontWeight: 600 }}>{c.name}</div>
        <ScoreRing value={c.score} color={c.score != null ? scales.score(c.score) : "var(--text)"} size={64} />
      </div>
    </div>
  );

  const carbMax = Math.max(200, Math.ceil(Math.max(...histVals(a, "carbon"), ...histVals(b, "carbon")) / 100) * 100);

  return (
    <OverlayCard title="Compare countries" icon="compare" onClose={onClose} width={620}>
      <div style={{ display: "flex", gap: 16, padding: "4px 0 18px" }}>
        <Col c={a} tone={H_COLOR.a} /><div style={{ width: 1, background: "var(--border)" }} /><Col c={b} tone={H_COLOR.b} />
      </div>
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {ROWS.map((r) => {
          const va = a[r.k], vb = b[r.k];
          const aBetter = va != null && vb != null && (r.better === "high" ? va > vb : va < vb);
          const bBetter = va != null && vb != null && (r.better === "high" ? vb > va : vb < va);
          return (
            <div key={r.k} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
              <span className="mono tnum" style={{ fontSize: 16, fontWeight: 600, textAlign: "right", color: aBetter ? "var(--accent)" : "var(--text-2)" }}>{r.fmt(va)}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-3)", padding: "0 18px", textAlign: "center", whiteSpace: "nowrap" }}>{r.label}</span>
              <span className="mono tnum" style={{ fontSize: 16, fontWeight: 600, textAlign: "left", color: bBetter ? "var(--accent)" : "var(--text-2)" }}>{r.fmt(vb)}</span>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ textAlign: "right", fontSize: 12.5, color: "var(--text-2)" }}>{a.netZero || "—"}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-3)", padding: "0 18px" }}>Net-zero year</span>
          <span style={{ textAlign: "left", fontSize: 12.5, color: "var(--text-2)" }}>{b.netZero || "—"}</span>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel icon="rank" text="Historical trend" noMargin />
          <Segmented size="sm" value={cm} onChange={setCm} options={[{ value: "renewable", label: "Renewables" }, { value: "carbon", label: "Carbon" }]} />
        </div>
        {a.history && b.history && (
          <LineChart width={560} height={150}
            series={[
              { years: a.history.years, values: a.history[cm], color: H_COLOR.a, label: a.name },
              { years: b.history.years, values: b.history[cm], color: H_COLOR.b, label: b.name },
            ]}
            yMax={cm === "renewable" ? 100 : carbMax} />
        )}
        <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: H_COLOR.a, borderRadius: 2 }} />{a.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: H_COLOR.b, borderRadius: 2 }} />{b.name}</span>
        </div>
      </div>
    </OverlayCard>
  );
}

function histVals(c: CountryRecord, key: "renewable" | "carbon"): number[] {
  const v = c.history ? c.history[key].filter((x): x is number => x != null) : [];
  return v.length ? v : [200];
}
