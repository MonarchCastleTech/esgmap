/* ESGMap — interactive D3 world map (imperative inside React). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, geoGraticule10, type GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { easeCubicInOut } from "d3-ease";
import "d3-transition";
import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import * as ESG from "../data/esg";
import type { CountryRecord, MetricKey } from "../types";
import { Icon } from "../ui/Icon";

const TOPO_URL = `${import.meta.env.BASE_URL}geo/countries-110m.json`;

function fitMap(proj: ReturnType<typeof geoMercator>, w: number, h: number) {
  // Fill the full width with the −180..180 lon range, then centre the lat band vertically.
  proj.scale(w / (2 * Math.PI)).translate([w / 2, h / 2]);
  const yT = proj([0, 73])![1], yB = proj([0, -56])![1];
  const bandH = yB - yT;
  const cur = proj.translate();
  proj.translate([cur[0], cur[1] + ((h - bandH) / 2 - yT)]);
}

function applyClip(proj: ReturnType<typeof geoMercator>, rectNode: SVGRectElement | null) {
  proj.clipExtent(null);
  const topY = proj([0, 73])![1];
  const botY = proj([0, -56])![1];
  const leftX = proj([-179.9, 0])![0];
  const rightX = proj([179.9, 0])![0];
  const x0 = Math.floor(Math.min(leftX, rightX)), x1 = Math.ceil(Math.max(leftX, rightX));
  const y0 = Math.floor(Math.min(topY, botY)), y1 = Math.ceil(Math.max(topY, botY));
  proj.clipExtent([[x0, y0], [x1, y1]]);
  if (rectNode) {
    rectNode.setAttribute("x", String(x0)); rectNode.setAttribute("y", String(y0));
    rectNode.setAttribute("width", String(Math.max(0, x1 - x0)));
    rectNode.setAttribute("height", String(Math.max(0, y1 - y0)));
  }
}

/** Bounds of a feature's largest landmass (so France centres on metropolitan France). */
function flyBounds(feat: Feature, pathGen: ReturnType<typeof geoPath>): [[number, number], [number, number]] {
  const g = feat.geometry;
  if (g.type === "MultiPolygon" && g.coordinates.length > 1) {
    let best: Geometry | null = null, bestArea = -1;
    for (const poly of g.coordinates) {
      const piece: Geometry = { type: "Polygon", coordinates: poly };
      const a = pathGen.area({ type: "Feature", properties: {}, geometry: piece } as GeoPermissibleObjects);
      if (a > bestArea) { bestArea = a; best = piece; }
    }
    if (best) return pathGen.bounds({ type: "Feature", properties: {}, geometry: best } as GeoPermissibleObjects);
  }
  return pathGen.bounds(feat as GeoPermissibleObjects);
}

interface PathNode extends SVGPathElement {
  __rec: CountryRecord | null;
  __name: string;
  __feat: Feature;
}

export interface WorldMapProps {
  metric: MetricKey;
  year: number;
  selected: string | null;
  pinned: string[];
  onSelect: (rec: CountryRecord | null, name: string) => void;
  onHover?: (rec: CountryRecord | null, name: string | null) => void;
  flyTo: { name: string; token: number } | null;
}

interface Tip { x: number; y: number; rec: CountryRecord | null; name: string }

export function WorldMap(props: WorldMapProps) {
  const { metric, year, selected, pinned, flyTo } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const projRef = useRef<ReturnType<typeof geoMercator> | null>(null);
  const pathGenRef = useRef<ReturnType<typeof geoPath> | null>(null);
  const selByName = useRef<Record<string, PathNode>>({});
  const sizeRef = useRef({ w: 0, h: 0 });
  const roFirstRef = useRef(true);
  const clipRectRef = useRef<SVGRectElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tip, setTip] = useState<Tip | null>(null);

  const scales = useMemo(() => ESG.buildScales(), []);

  const colorOf = useCallback((rec: CountryRecord | null) => {
    const p = propsRef.current;
    if (!rec) return ESG.NO_DATA;
    const v = ESG.valueAt(rec, p.metric, p.year);
    if (v == null) return ESG.NO_DATA;
    return scales[p.metric](v);
  }, [scales]);

  const paint = useCallback(() => {
    const sel = selByName.current;
    for (const name of Object.keys(sel)) {
      const node = sel[name];
      node.setAttribute("fill", colorOf(node.__rec));
    }
  }, [colorOf]);

  const repaintHighlight = useCallback(() => {
    const p = propsRef.current;
    const sel = selByName.current;
    for (const name of Object.keys(sel)) {
      const node = sel[name];
      node.classList.toggle("selected", name === p.selected);
      node.classList.toggle("pinned", p.pinned.indexOf(name) >= 0);
    }
  }, []);

  const fit = useCallback(() => {
    const wrap = wrapRef.current, proj = projRef.current, pathGen = pathGenRef.current;
    if (!wrap || !proj || !pathGen) return false;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return false;
    sizeRef.current = { w, h };
    fitMap(proj, w, h);
    applyClip(proj, clipRectRef.current);
    const g = select(gRef.current);
    g.select<SVGPathElement>("path.graticule").attr("d", pathGen(geoGraticule10()));
    g.selectAll<SVGPathElement, Feature>("path.country").attr("d", (d) => pathGen(d as GeoPermissibleObjects));
    return true;
  }, []);

  /* ----- build once ----- */
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const feats = (feature(topo, topo.objects.countries) as unknown as { features: Feature[] }).features
          .filter((f) => f.properties && (f.properties as { name?: string }).name && (f.properties as { name?: string }).name !== "Antarctica");

        const svg = select(svgRef.current!);
        const g = select(gRef.current!);
        const wrap = wrapRef.current!;
        const w = wrap.clientWidth, h = wrap.clientHeight;
        sizeRef.current = { w, h };

        const projection = geoMercator();
        projRef.current = projection;
        const pathGen = geoPath(projection);
        pathGenRef.current = pathGen;
        fitMap(projection, w, h);
        applyClip(projection, clipRectRef.current);

        g.append("path").attr("class", "graticule").attr("d", pathGen(geoGraticule10()));

        const nodes: Record<string, PathNode> = {};
        const gc = g.append("g").attr("class", "countries");
        gc.selectAll<SVGPathElement, Feature>("path.country")
          .data(feats)
          .enter()
          .append("path")
          .attr("class", "country")
          .attr("d", (d) => pathGen(d as GeoPermissibleObjects))
          .each(function (d) {
            const node = this as PathNode;
            const fname = (d.properties as { name: string }).name;
            const rec = ESG.lookupByName(fname);
            node.__rec = rec;
            node.__name = rec ? rec.match : fname;
            node.__feat = d;
            if (!rec) node.classList.add("nodata");
            node.setAttribute("fill", colorOf(rec));
            nodes[node.__name] = node;
          })
          .on("mousemove", function (ev: MouseEvent, d) {
            const node = this as PathNode;
            const rect = wrapRef.current!.getBoundingClientRect();
            setTip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, rec: node.__rec, name: (d.properties as { name: string }).name });
            if (!node.classList.contains("selected")) node.classList.add("hover");
            propsRef.current.onHover?.(node.__rec, (d.properties as { name: string }).name);
          })
          .on("mouseleave", function () {
            (this as PathNode).classList.remove("hover");
            setTip(null);
            propsRef.current.onHover?.(null, null);
          })
          .on("click", function (ev: MouseEvent, d) {
            ev.stopPropagation();
            const node = this as PathNode;
            propsRef.current.onSelect(node.__rec || null, (d.properties as { name: string }).name);
          });
        selByName.current = nodes;

        const zoom = d3zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 9])
          .on("zoom", (ev) => { g.attr("transform", ev.transform.toString()); });
        zoomRef.current = zoom;
        svg.call(zoom);
        svg.on("click", () => propsRef.current.onSelect(null, ""));
        svg.on("dblclick.zoom", null);

        setStatus("ready");
        requestAnimationFrame(() => {
          paint(); repaintHighlight();
          requestAnimationFrame(() => { fit(); });
        });
        setTimeout(() => { fit(); }, 120);
      })
      .catch((err) => { console.error("topojson load failed", err); if (!cancelled) setStatus("error"); });

    // Idempotent teardown: under StrictMode the effect runs mount→cleanup→mount, so
    // remove any appended geometry and detach svg listeners rather than relying on
    // fetch timing to avoid double-built paths / stacked handlers.
    return () => {
      cancelled = true;
      if (gRef.current) select(gRef.current).selectAll("*").remove();
      if (svgRef.current) select(svgRef.current).on(".zoom", null).on("click", null);
      selByName.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- resize ----- */
  useEffect(() => {
    if (status !== "ready") return;
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      const first = roFirstRef.current;
      roFirstRef.current = false;
      if (!first && Math.abs(w - sizeRef.current.w) < 2 && Math.abs(h - sizeRef.current.h) < 2) return;
      fit();
      select(svgRef.current!).call(zoomRef.current!.transform, zoomIdentity);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [status, fit]);

  useEffect(() => { if (status === "ready") paint(); }, [metric, year, status, paint]);
  useEffect(() => { if (status === "ready") repaintHighlight(); }, [selected, pinned, status, repaintHighlight]);

  /* ----- fly to country ----- */
  useEffect(() => {
    if (status !== "ready" || !flyTo || !flyTo.name) return;
    const node = selByName.current[flyTo.name];
    if (!node) return;
    const pathGen = pathGenRef.current!;
    const b = flyBounds(node.__feat, pathGen);
    const { w, h } = sizeRef.current;
    const dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1];
    const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2;
    const scale = Math.max(1.9, Math.min(7, 0.55 / Math.max(dx / w, dy / h)));
    const tx = w / 2 - scale * cx, ty = h / 2 - scale * cy;
    const target = zoomIdentity.translate(tx, ty).scale(scale);
    select(svgRef.current!).transition().duration(760).ease(easeCubicInOut)
      .call(zoomRef.current!.transform, target);
    // safety net for throttled rAF (backgrounded tab): snap to target.
    const svgNode = svgRef.current!;
    const safety = setTimeout(() => {
      const cur = (svgNode as unknown as { __zoom?: { k: number } }).__zoom;
      if (!cur || Math.abs(cur.k - scale) > 0.02) {
        select(svgNode).call(zoomRef.current!.transform, target);
      }
    }, 820);
    // Clear the pending snap if flyTo changes again (rapid selections) or on unmount,
    // so a stale target can't jump the map after the user has navigated elsewhere.
    return () => clearTimeout(safety);
  }, [flyTo, status]);

  const zoomBy = (k: number) => {
    select(svgRef.current!).transition().duration(250).call(zoomRef.current!.scaleBy, k);
  };
  const resetZoom = () => {
    select(svgRef.current!).transition().duration(500).call(zoomRef.current!.transform, zoomIdentity);
  };

  const tipRec = tip && tip.rec;
  const tipVal = tipRec ? ESG.valueAt(tipRec, metric, year) : null;
  const M = ESG.METRICS[metric];

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "var(--bg-map)", overflow: "hidden" }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ display: "block", cursor: "grab" }}>
        <defs>
          <clipPath id="esg-mapclip"><rect ref={clipRectRef} x={0} y={0} width={0} height={0} /></clipPath>
        </defs>
        <g clipPath="url(#esg-mapclip)">
          <g ref={gRef} />
        </g>
      </svg>

      {/* zoom controls */}
      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow)" }}>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.5)} style={ZBTN}><Icon name="plus" size={17} /></button>
          <div style={{ height: 1, background: "var(--border)" }} />
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} style={ZBTN}><Icon name="minus" size={17} /></button>
        </div>
        <button aria-label="Reset view" onClick={resetZoom} title="Reset view" style={{ ...ZBTN, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel)", boxShadow: "var(--shadow)" }}><Icon name="globe" size={17} /></button>
      </div>

      {/* tooltip */}
      {tip && (
        <div style={{
          position: "absolute", left: Math.min(tip.x + 16, sizeRef.current.w - 190), top: Math.max(10, tip.y - 14),
          pointerEvents: "none", background: "rgba(16,21,18,.96)", border: "1px solid var(--border-2)",
          borderRadius: 9, padding: "9px 12px", minWidth: 150, boxShadow: "var(--shadow)", zIndex: 5, backdropFilter: "blur(4px)",
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: tipRec ? 5 : 0 }}>{tipRec ? tipRec.name : tip.name}</div>
          {tipRec ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span className="mono tnum" style={{ fontSize: 19, fontWeight: 600, color: tipVal != null ? scales[metric](tipVal) : "var(--text-3)" }}>{M.fmt(tipVal)}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{M.unit !== "%" ? M.unit : ""} {M.short}</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>No coverage in dataset</div>
          )}
          {tipRec && tipRec.live && (metric === "renewable" || metric === "carbon") && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, marginTop: 5, color: "var(--accent)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)" }} />
              LIVE {tipRec.live.renewable != null ? Math.round(tipRec.live.renewable) + "% now" : ""}
            </div>
          )}
          {tipRec && <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>{tipRec.region} · click for detail</div>}
        </div>
      )}

      {/* loading / error overlay */}
      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--text-3)" }}>
          {status === "loading"
            ? <div className="mono" style={{ fontSize: 13, letterSpacing: ".08em" }}>LOADING WORLD GEOMETRY…</div>
            : <div style={{ textAlign: "center" }}><div className="mono" style={{ color: "var(--bad)" }}>MAP DATA FAILED TO LOAD</div><div style={{ fontSize: 12, marginTop: 6 }}>Check that geo/countries-110m.json is served.</div></div>}
        </div>
      )}
    </div>
  );
}

const ZBTN: React.CSSProperties = {
  width: 38, height: 38, display: "grid", placeItems: "center",
  background: "var(--panel)", border: "none", color: "var(--text-2)", transition: "color .15s, background .15s",
};
