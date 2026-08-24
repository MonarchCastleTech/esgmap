/* ESGMap — root state & composition. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ESG from "./data/esg";
import type { Palette } from "./data/esg";
import type { CountryRecord, MetricKey } from "./types";
import { LAYERS } from "./layers";
import { parseHash, toHash, permalink, type ViewId } from "./lib/urlState";
import { Icon } from "./ui/Icon";
import { WorldMap } from "./components/WorldMap";
import { Sidebar } from "./components/Sidebar";
import { SearchBox } from "./components/SearchBox";
import { Legend } from "./components/Legend";
import { TimeSlider } from "./components/TimeSlider";
import { CompareBar } from "./components/CompareBar";
import { CountryPanel } from "./components/CountryPanel";
import { MapDataTable } from "./components/MapDataTable";
import { RankingsOverlay } from "./overlays/Rankings";
import { RegionTrendsOverlay } from "./overlays/RegionalTrends";
import { CompareOverlay } from "./overlays/Compare";
import { AboutOverlay } from "./overlays/Methodology";
import { ScoreLabOverlay } from "./overlays/ScoreLab";
import { ValidationOverlay } from "./overlays/Validation";
import { ExploreOverlay } from "./overlays/Explore";

export type { ViewId };

export default function App() {
  const init = useRef(parseHash(typeof location !== "undefined" ? location.hash : "")).current;

  const [metric, setMetric] = useState<MetricKey>(init.metric ?? "renewable");
  const [year, setYear] = useState<number>(init.year ?? ESG.YEAR_MAX);
  const [selRec, setSelRec] = useState<CountryRecord | null>(init.selected ? ESG.lookupByName(init.selected) : null);
  const [pins, setPins] = useState<string[]>(init.pins ?? []);
  const [flyTo, setFlyTo] = useState<{ name: string; token: number } | null>(
    init.selected && ESG.lookupByName(init.selected) ? { name: ESG.lookupByName(init.selected)!.match, token: 1 } : null,
  );
  const [view, setView] = useState<ViewId | null>(init.view ?? null);
  const [palette, setPalette] = useState<Palette>(init.palette ?? "default");
  const scales = useMemo(() => ESG.buildScales(palette), [palette]);

  // Keep the URL hash in sync so every view is a citable, shareable permalink.
  useEffect(() => {
    const hash = toHash({ metric, year, selected: selRec?.match ?? null, pins, view, palette });
    history.replaceState(null, "", location.pathname + location.search + hash);
  }, [metric, year, selRec, pins, view, palette]);

  const selectRec = useCallback((rec: CountryRecord | null) => {
    if (!rec) { setSelRec(null); return; }
    setSelRec(rec);
    setFlyTo({ name: rec.match, token: Date.now() });
    setView(null);
  }, []);

  const onMapSelect = useCallback((rec: CountryRecord | null) => { setSelRec(rec || null); }, []);

  const togglePin = useCallback((rec: CountryRecord) => {
    setPins((prev) =>
      prev.indexOf(rec.match) >= 0
        ? prev.filter((m) => m !== rec.match)
        : prev.length >= 2 ? [prev[1], rec.match] : [...prev, rec.match],
    );
  }, []);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    const url = permalink({ metric, year, selected: selRec?.match ?? null, pins, view, palette });
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  }, [metric, year, selRec, pins, view, palette]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view) setView(null); else if (selRec) setSelRec(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, selRec]);

  const pinnedRecs = pins.map((m) => ESG.byName[m]).filter(Boolean);
  const panelOpen = !!selRec;
  const activeLayer = LAYERS.find((l) => l.value === metric)!;

  return (
    <div className="esg-app">
      <a href="#esg-search" className="sr-only sr-only-focusable">Skip to map search and controls</a>
      <Sidebar view={view} setView={setView} metric={metric} setMetric={setMetric} palette={palette} setPalette={setPalette} />
      <main className="esg-main" style={{ position: "relative", flex: 1, minWidth: 0 }} aria-label={`World map — ${ESG.METRICS[metric].label}`}>
        <WorldMap metric={metric} year={year} selected={selRec ? selRec.match : null} pinned={pins}
          onSelect={onMapSelect} flyTo={flyTo} palette={palette} />
        <MapDataTable metric={metric} year={year} />

        {/* top-left search */}
        <div id="esg-search" className="esg-search" tabIndex={-1} style={{ position: "absolute", top: 18, left: 18, zIndex: 12, outline: "none" }}>
          <SearchBox onPick={selectRec} metric={metric} year={year} scales={scales} />
        </div>

        {/* active-layer chip + copy-link top-center */}
        <div className="esg-top-controls" style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(19,24,21,.86)", border: "1px solid var(--border)", borderRadius: 99, padding: "7px 15px", fontSize: 12.5, boxShadow: "var(--shadow)", backdropFilter: "blur(6px)" }}>
            <Icon name={activeLayer.icon} size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>{ESG.METRICS[metric].label}</span>
            <span style={{ color: "var(--text-3)" }}>·</span>
            <span className="mono" title="Annual map values retain each country's true observation vintage" style={{ color: "var(--text-3)" }}>{ESG.METRICS[metric].hasHistory ? year : ESG.YEAR_MAX}</span>
            <span style={{ color: "var(--text-3)", fontSize: 10.5 }}>vintages shown per country</span>
          </div>
          <button onClick={copyLink} title="Copy a permalink to this exact view" aria-label="Copy link to this view"
            style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 99, border: "1px solid var(--border)", background: "rgba(19,24,21,.86)", color: copied ? "var(--accent)" : "var(--text-2)", fontSize: 12, boxShadow: "var(--shadow)", backdropFilter: "blur(6px)" }}>
            <Icon name={copied ? "check" : "pin"} size={14} />{copied ? "Copied" : "Link"}
          </button>
        </div>

        {/* bottom-left: compare bar + time slider */}
        <div className="esg-bottom-controls" style={{ position: "absolute", left: 18, bottom: 18, zIndex: 12, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
          <CompareBar pinned={pinnedRecs} onOpen={() => setView("compare")} onClear={() => setPins([])} />
          <TimeSlider year={year} setYear={setYear} metric={metric} />
        </div>

        {/* bottom-right legend (shifts when panel open) */}
        <div className="esg-legend" style={{ position: "absolute", right: panelOpen ? 410 : 18, bottom: 18, zIndex: 12, transition: "right .32s cubic-bezier(.22,.61,.36,1)" }}>
          <Legend metric={metric} scales={scales} />
        </div>

        {/* country panel */}
        {selRec && (
          <CountryPanel rec={selRec} metric={metric} scales={scales} onClose={() => setSelRec(null)}
            onPin={togglePin} isPinned={pins.indexOf(selRec.match) >= 0} permalinkFor={() => permalink({ metric, year, selected: selRec.match, pins, view: null, palette })} />
        )}

        {/* overlays */}
        {view === "rankings" && <RankingsOverlay metric={metric} scales={scales} onPick={selectRec} onClose={() => setView(null)} />}
        {view === "trends" && <RegionTrendsOverlay onClose={() => setView(null)} />}
        {view === "compare" && <CompareOverlay pinned={pinnedRecs} scales={scales} onClose={() => setView(null)} onRemove={(c) => setPins((prev) => prev.filter((m) => m !== c.match))} />}
        {view === "scorelab" && <ScoreLabOverlay scales={scales} onPick={selectRec} onClose={() => setView(null)} />}
        {view === "validate" && <ValidationOverlay onClose={() => setView(null)} />}
        {view === "explore" && <ExploreOverlay onPick={selectRec} onClose={() => setView(null)} />}
        {view === "about" && <AboutOverlay onClose={() => setView(null)} />}
      </main>
    </div>
  );
}
