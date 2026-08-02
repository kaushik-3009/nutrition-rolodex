# Data model

## Catalog record

Each record in `data/catalog-data.js` contains:

| Field | Meaning |
| --- | --- |
| `id` | Stable local identifier combining source type and display name. |
| `name` | User-facing ingredient or product name. |
| `aliases` | Search terms and alternate names. |
| `group` | Primary browse group, including `Pulses`, `Dairy & eggs`, and `Milk & alternatives`. |
| `state` | One of `raw`, `dry`, `canned`, or `frozen`. |
| `sourceType` | `generic` or `branded`. |
| `source` | Human-readable provenance label. |
| `fdcId` | USDA FoodData Central identifier. |
| `sourceDescription` | Exact USDA source description selected for the record. |
| `publishedDate` | Source publication or release date when present. |
| `servingGrams` | Initial display serving in grams. |
| `cupGrams` / `tbspGrams` | Household conversion weights when USDA provides them or a curated common-serving fallback is approved. |
| `cupSource` / `tbspSource` | Whether the household weight comes from USDA or a curated common-serving fallback. |
| `defaultUnit` / `defaultAmount` | Food-specific default household display, such as `0.5 cup` for oats or `0.25 cup` for dry pulses. |
| `countMeasure` | Optional piece-based measure such as `1 egg`, `1 slice`, `1 apple`, or `1 leaf`, including its gram conversion and singular/plural labels. |
| `portionOptions` | Source household portions retained for data review and future UI work. The current interface exposes only the reviewed grams, cups, tablespoons, and count measures. |
| `per100g` | Nutrient values normalized to the source's per-100-gram basis. |

## Nutrient normalization

The generator maps USDA nutrient IDs to stable application keys such as `protein`, `fat`, `fiber`, `calcium`, `iron`, `vitaminC`, and `folate`. Each value retains its unit. The interface scales those values from 100 g to the selected amount.

This prevents a custom amount from being confused with the source serving and keeps raw, dry, canned, and frozen records separate. A UI label must always show the state beside the serving size.

Household defaults are selected per food. Staple grains and pulses use common fractional cup servings; produce, canned foods, and frozen foods use cup amounts when a cup is a meaningful way to scoop the ingredient; oils and seeds use tablespoon servings where appropriate. Countable foods can also expose a piece measure such as egg, slice, leaf, fruit, bean, or nut. The gram equivalent is always shown in brackets. Whole cuts of meat and fish remain gram-first when a piece conversion would imply false precision.

The interface presents category, ingredient/product type, and food state together above the label. Source and record identifiers appear below the label as provenance, so they remain available without competing with serving and nutrient information.

## Daily Values

The display uses the current U.S. Daily Value reference amounts for a 2,000-calorie diet. `%DV` is computed only for nutrients with a defined reference amount and a source value. Protein and sugars display a dash when the label convention does not establish a Daily Value for the displayed record.

Missing source nutrients remain `—`; they are not treated as zero. A numeric zero is only used when the source explicitly reports zero.

## Product records

Branded records require a product identity, brand name, package serving size, label values, source URL or FDC identifier, and verification date. A generic USDA ingredient must not be silently presented as a Walmart product.
