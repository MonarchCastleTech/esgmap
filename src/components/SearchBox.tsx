import { useEffect, useMemo, useRef, useState } from "react";
import * as ESG from "../data/esg";
import type { CountryRecord, MetricKey } from "../types";
import type { Scales } from "../data/esg";
import { Icon } from "../ui/Icon";
import { regionFlagTone } from "../ui/tokens";

export function SearchBox({ onPick, metric, year, scales }: {
  onPick: (c: CountryRecord) => void;
  metric: MetricKey;
  year: number;
  scales: Scales;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.trim().toLowerCase();
    return ESG.all
      .filter((c) => c.name.toLowerCase().includes(s) || c.region.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const M = ESG.METRICS[metric];

  return (
    <div ref={ref} style={{ position: "relative", width: 340 }}>
      <div className="search-wrap" style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: "rgba(19,24,21,.92)", border: "1px solid var(--border-2)", borderRadius: 11, boxShadow: "var(--shadow)", backdropFilter: "blur(6px)" }}>
        <Icon name="search" size={17} style={{ color: "var(--text-3)" }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          aria-label="Search countries and regions"
          placeholder={`Search ${ESG.META.territories} countries & regions`} spellCheck={false}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 14 }} />
        {q && <button aria-label="Clear search" onClick={() => { setQ(""); setOpen(false); }} style={{ border: "none", background: "transparent", color: "var(--text-3)", display: "grid", placeItems: "center" }}><Icon name="close" size={15} /></button>}
      </div>
      {open && results.length > 0 && (
        <div className="fadein" style={{ position: "absolute", top: 50, left: 0, right: 0, background: "var(--panel)", border: "1px solid var(--border-2)", borderRadius: 11, boxShadow: "var(--shadow)", overflow: "hidden", zIndex: 30 }}>
          {results.map((c) => {
            const v = ESG.valueAt(c, metric, year);
            return (
              <button key={c.match} onClick={() => { onPick(c); setQ(""); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border)", background: "transparent", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: regionFlagTone(c.region), flex: "0 0 auto" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.region}{c.tier === "rich" ? "" : " · limited"}</div>
                </span>
                <span className="mono tnum" style={{ fontSize: 13, color: v != null ? scales[metric](v) : "var(--text-3)", fontWeight: 600 }}>{M.fmt(v)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
