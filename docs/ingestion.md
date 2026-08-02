# Ingestion notes

## Source hierarchy

1. USDA FoodData Central generic records for plain ingredients.
2. USDA FoodData Central branded records for label-backed products.
3. A future admin workflow for product labels that are manually verified and retained with their evidence.

FoodData Central provides downloadable Foundation, SR Legacy, FNDDS, and Branded datasets. The current generator uses the Foundation, SR Legacy, and FNDDS JSON archives to avoid depending on a client-side API key or rate-limited browser request.

## Generator

`scripts/fetch-catalog.mjs` contains the curated priority list, source matching rules, nutrient-ID mapping, and output writer. It is run against a local USDA archive directory:

```sh
FDC_LOCAL_DIR=/path/to/fdc-archives node scripts/fetch-catalog.mjs
```

The generated output is `data/catalog-data.js`, which is intentionally browser-loadable without a bundler.

## Selection rules

- Search terms must match whole words in the USDA description, with an additional normalized-phrase preference so a query such as `cheese cheddar` does not select a snack containing the words “cheddar cheese.”
- Requested state words such as `raw`, `dry`, `canned`, and `frozen` are rewarded; a mismatched state is rejected or penalized.
- Cooked, prepared, sauced, sweetened, and flour variants are excluded when they do not match the requested ingredient.
- Every generated record retains its FDC ID and exact source description for later review.
- Household weights are marked as either USDA-provided or a curated common-serving fallback; the UI shows that distinction when a fallback is used.
- Canned and frozen records must be checked specifically for a scoopable cup equivalent. Missing USDA cup portions can use an explicit curated fallback, but the fallback must be recorded in `householdDefaults`.
- Do not trust a successful search alone: inspect the selected `sourceDescription` for every record. Similar words can select the wrong food, state, variety, or branded prepared item.

## Review checklist before publishing a product

- Confirm the source description matches the intended food and state.
- Confirm the record is not cooked or prepared when the catalog entry is intended to be raw or unprepared.
- Confirm the serving grams and household measures.
- Indian pulse records use the culinary name as the catalog label and retain the exact USDA source description. Current records include masoor, moong, toor, chana, kala chana, rajma, lobia, and moth beans where the archive has a matching raw or dry reference.
- Urad dal and horse gram are intentionally not represented by a guessed USDA proxy. They need an Indian Food Composition Tables source adapter before they can carry the same full nutrient coverage as the USDA-backed records.
- Milk expansion is limited to unflavored fluid references for this raw or uncooked catalog. Evaporated, powdered, sweetened, flavored, and cooked milk products remain out of scope.
- Confirm nutrient units and Daily Value behavior.
- Check that similar records are not duplicate variants.
- Record the USDA release or product-label verification date.
