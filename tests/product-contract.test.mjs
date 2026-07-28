import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const app = read("src/App.tsx");
const sidebar = read("src/components/Sidebar.tsx");
const map = read("src/components/WorldMap.tsx");
const css = read("src/index.css");
const html = read("index.html");
const workflow = read(".github/workflows/deploy.yml");
const license = read("LICENSE");

test("ESGMap uses the approved local product logo and exact masterbrand endorsement", () => {
  assert.match(sidebar, /src=\{`\$\{import\.meta\.env\.BASE_URL\}logo\.png`\}/);
  assert.match(sidebar, /alt="ESGMap logo"/);
  assert.ok(sidebar.includes("Part of Monarch Castle Technologies."));
  const publicLogo = readFileSync(resolve(root, "public/logo.png"));
  const approvedLogo = readFileSync(resolve(root, "docs/logo-dark.png"));
  assert.equal(
    createHash("sha256").update(publicLogo).digest("hex"),
    createHash("sha256").update(approvedLogo).digest("hex"),
    "the runtime logo must remain the approved repository logo",
  );
});

test("shared portfolio tokens and responsive application geometry are explicit", () => {
  for (const token of [
    "--bg: #15130f",
    "--panel: #191711",
    "--panel-2: #1f1c16",
    "--border: #2c2820",
    "--text: #ece6d8",
    "--text-2: #9a9284",
    "--accent: #c9a24b",
    '--serif: "Spectral"',
    "--radius: 1px",
  ]) assert.ok(css.includes(token), `missing shared token: ${token}`);
  assert.match(app, /className="esg-app"/);
  assert.match(sidebar, /className="esg-sidebar"/);
  assert.match(css, /@media\s*\(max-width:\s*800px\)/);
  assert.match(css, /\.esg-app[\s\S]*flex-direction:\s*column/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.ok(!css.includes("100vw"));
});

test("map controls, fallback data, and search remain keyboard-accessible", () => {
  assert.match(map, /id="esg-world-map"/);
  assert.match(map, /role="region"/);
  assert.match(map, /aria-label="Interactive world sustainability map"/);
  for (const label of ["Zoom in", "Zoom out", "Reset view"]) {
    assert.match(map, new RegExp(`aria-label="${label}"[^>]*aria-controls="esg-world-map"`));
  }
  assert.match(map, /className="map-controls"/);
  assert.match(app, /<MapDataTable metric=\{metric\} year=\{year\} \/>/);
  assert.match(app, /id="esg-search"/);
  assert.match(app, /Skip to map search and controls/);
});

test("visible source and freshness status identifies the edition without overstating recency", () => {
  assert.match(sidebar, /role="status"/);
  assert.match(sidebar, /aria-live="polite"/);
  assert.ok(sidebar.includes("Dataset updated"));
  assert.ok(sidebar.includes("Edition"));
  assert.match(sidebar, /DATA_SOURCES\.md/);
  assert.ok(sidebar.includes("Source register"));
  assert.ok(sidebar.includes("Annual indicators and optional live overlays are dated separately."));
});

test("public interface contains no prohibited accuracy, authority, or advice claims", () => {
  const publicCopy = [html, app, sidebar, map].join("\n").toLowerCase();
  for (const phrase of [
    "guaranteed accurate",
    "most accurate",
    "official government intelligence",
    "investment advice",
    "decision-grade",
  ]) assert.ok(!publicCopy.includes(phrase), `prohibited public claim: ${phrase}`);
  assert.ok(publicCopy.includes("analytical"));
});

test("master remains the documented deployment branch and MIT meaning is preserved", () => {
  const adrPath = resolve(root, "docs/adr/0001-default-branch-and-deployment.md");
  assert.ok(existsSync(adrPath), "deployment ADR must exist");
  const adr = readFileSync(adrPath, "utf8");
  assert.match(adr, /Status:\s*Accepted/);
  assert.match(adr, /default branch remains `master`/i);
  assert.match(adr, /do not rename/i);
  assert.match(adr, /GitHub Pages/i);
  assert.match(workflow, /branches:\s*\[master\]/);
  assert.ok(!workflow.includes("branches: [main, master]"));
  for (const phrase of [
    "MIT License",
    "Permission is hereby granted, free of charge",
    'THE SOFTWARE IS PROVIDED "AS IS"',
    "Bundled datasets",
    "DATA_SOURCES.md",
  ]) assert.ok(license.includes(phrase), `license meaning missing: ${phrase}`);
});

