import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const dataset = JSON.parse(readFileSync(resolve("src", "data", "countries.json"), "utf8"));
const meta = dataset?.meta ?? {};
const countries = Array.isArray(dataset?.countries) ? dataset.countries : [];
const generatedAt = Date.parse(meta.generatedAt);
const ageDays = (Date.now() - generatedAt) / 86_400_000;
const contentHash = createHash("sha256").update(JSON.stringify(countries)).digest("hex");

if (countries.length < 90) throw new Error(`dataset coverage too small: ${countries.length}`);
if (meta.territories !== countries.length) throw new Error("dataset territory count does not match its metadata");
if (!Number.isFinite(generatedAt) || ageDays < -1 || ageDays > 45) {
  throw new Error(`committed dataset is outside the 45-day safety window: ${meta.generatedAt ?? "missing"}`);
}
if (!Array.isArray(meta.sources) || meta.sources.length < 5) throw new Error("dataset source register is incomplete");
if (meta.contentHash !== contentHash) throw new Error("dataset checksum does not match its country records");

console.log(`verified ${countries.length} territories; dataset age ${ageDays.toFixed(1)} days`);
