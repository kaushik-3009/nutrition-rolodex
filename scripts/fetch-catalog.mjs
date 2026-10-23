import { spawnSync } from "node:child_process";

// Safe compatibility entrypoint: the former live search workflow selected the
// top fuzzy API result and could replace the catalog with mismatched records.
// All catalog builds now go through the checksum-verified source importer.
const archive = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || process.env.FDC_SR_LEGACY_ARCHIVE;
if (!archive) {
  throw new Error(
    "Fuzzy USDA API lookup has been removed. Download the official SR Legacy CSV archive, then run " +
    "node scripts/import-sr-legacy.mjs /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip"
  );
}

const result = spawnSync(process.execPath, ["scripts/import-sr-legacy.mjs", archive, ...process.argv.slice(2).filter((arg) => arg.startsWith("--"))], {
  stdio: "inherit"
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
