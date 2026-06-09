/* Runtime smoke test: load the built app, assert it renders, exercise core
 * interactions, and screenshot each view. Run against `npm run preview`.
 *
 * Optional dev tool — requires Playwright (not an app dependency):
 *   npx playwright install chromium && npm i --no-save playwright
 *   npm run preview -- --port 4317 &  node scripts/verify.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4317/";
const shots = "scripts/.verify";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const assert = (cond, msg) => { if (!cond) { console.error("✗ " + msg); process.exitCode = 1; } else console.log("✓ " + msg); };

await page.goto(BASE, { waitUntil: "networkidle" });

// 1. App chrome mounts
await page.waitForSelector("text=ESGMap", { timeout: 8000 });
assert(await page.locator("text=Global Sustainability Atlas").count() > 0, "sidebar brand renders");

// 2. Map geometry draws (countries painted with non-grey fills)
await page.waitForSelector("path.country", { timeout: 10000 });
const countryCount = await page.locator("path.country").count();
assert(countryCount > 150, `world geometry rendered (${countryCount} country paths)`);
const colored = await page.evaluate(() => {
  const grey = new Set(["#222a26", "#2c352d"]);
  let n = 0;
  document.querySelectorAll("path.country").forEach((p) => {
    const f = (p.getAttribute("fill") || "").toLowerCase();
    if (f && !grey.has(f)) n++;
  });
  return n;
});
assert(colored > 70, `countries recoloured by active layer (${colored} non-grey)`);
await page.screenshot({ path: `${shots}/01-map.png` });

// 3. Switch layer → legend label updates
await page.locator("button:has-text('Carbon intensity')").first().click();
await page.waitForTimeout(400);
assert(await page.locator("text=Grid carbon intensity").count() > 0, "layer switch updates legend/chip");
await page.screenshot({ path: `${shots}/02-carbon.png` });

// 4. Select a country via search → panel opens
await page.locator("input[placeholder^='Search']").fill("Brazil");
await page.waitForTimeout(300);
await page.locator("button:has-text('Brazil')").first().click();
await page.waitForSelector("text=Sustainability score", { timeout: 5000 });
assert(await page.locator("text=Electricity mix").count() > 0, "country panel opens with detail");
await page.screenshot({ path: `${shots}/03-panel.png` });

// 4b. Live overlay: UK panel shows a LIVE banner with a "renewables now" reading
await page.locator("input[placeholder^='Search']").fill("United Kingdom");
await page.waitForTimeout(300);
await page.locator("button:has-text('United Kingdom')").first().click();
await page.waitForSelector("text=Sustainability score", { timeout: 5000 });
const liveBanner = await page.locator("text=renewables now").count();
assert(liveBanner > 0, "live (near-real-time) banner renders on a grid-covered country");
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

// 5. Open each overlay
for (const [nav, marker, name] of [
  ["Rankings", "sorted by", "rankings"],
  ["Regional trends", "by region", "trends"],
  ["Methodology", "data provenance", "methodology"],
]) {
  await page.locator(`button:has-text("${nav}")`).first().click();
  await page.waitForTimeout(400);
  assert(await page.locator(`text=${marker}`).count() > 0, `${nav} overlay renders`);
  await page.screenshot({ path: `${shots}/04-${name}.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

assert(errors.length === 0, `no console/page errors${errors.length ? " → " + errors.join(" | ") : ""}`);

await browser.close();
console.log(process.exitCode ? "\nVERIFY FAILED" : "\nVERIFY PASSED");
