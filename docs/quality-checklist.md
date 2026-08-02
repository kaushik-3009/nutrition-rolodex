# Quality checklist

Use this checklist after changing the catalog generator, data, or label UI.

## Data checks

```sh
node --check app.js
node --check scripts/fetch-catalog.mjs
node --check data/catalog-data.js
```

Then inspect the generated records:

- Count records and check duplicate IDs.
- Confirm every record has a group, one of `raw`, `dry`, `canned`, or `frozen`, an FDC ID, and nutrient data.
- Read every `sourceDescription` for wrong varieties, cooked/prepared variants, recipe products, and category/state mismatches.
- Confirm canned and frozen records have a cup conversion or an intentional source portion.
- Confirm household defaults match the food: oats at `1/2 cup`, dry pulses at `1/4 cup`, seeds/oils by tablespoon, and produce by a sensible cup amount where applicable.
- Confirm household measures carry provenance in the data record, while the interface keeps the lookup focused on the measure and gram equivalent.
- Confirm no branded record is presented as verified without a package-backed source.

## UI checks

- Type in the catalog search and confirm cards filter without page navigation.
- Confirm the catalog shows a bounded page of 12 cards and Previous/Next controls for longer result sets.
- Change the group or state filter and confirm the selected detail follows the visible result set instead of showing a food from the previous filter.
- Select a card and confirm the label beside the results updates without scrolling.
- Change grams, cups, and tablespoons where available; confirm the gram equivalent, calories, nutrient values, and Daily Values all update together.
- Confirm the amount control and compact measurement toggles share one horizontal control row on desktop; the row may stack on narrow screens. Countable foods should expose their food-specific unit when available.
- Change an amount and unit, then confirm the small reset control returns the food to its configured default measure.
- Confirm the default amount is food-specific and visibly includes its gram equivalent.
- Confirm state and ingredient type are together above the label; source and record are below it.
- Confirm an empty search has a useful message and does not leave stale cards visible.
- Check keyboard focus, narrow screens, and long food names.
