# Pantry Index documentation

Pantry Index is a public, search-first nutrition rolodex for plain ingredients and selected grocery products. The current interface is a static catalog prototype with USDA-backed seed records.

## Current status

- 108 generated generic records across grains, Indian pulses and dals, vegetables, fruit, proteins, seafood, dairy and eggs, milk and alternatives, nuts and seeds, oils, canned foods, and frozen foods.
- Food states are explicit: `raw`, `dry`, `canned`, and `frozen`.
- Nutrients are stored per 100 g and scaled to the selected gram amount at display time.
- Grams are canonical, but the interface starts with a food-specific cup or tablespoon amount when that is useful for a kitchen lookup. The gram equivalent is always shown in brackets.
- Household defaults are food-specific: rolled oats use 1/2 cup, dry pulses use 1/4 cup, canned or frozen vegetables use familiar fractional-cup amounts, and countable foods can use measures such as egg, slice, leaf, or fruit. Every displayed household amount includes its gram equivalent.
- Great Value / Walmart branded records are an ingestion queue, not yet displayed as verified catalog entries.

## Documents

- [Design language](design-language.md) — visual principles, tokens, components, and accessibility baseline.
- [Data model](data-model.md) — catalog fields, nutrition normalization, states, servings, and provenance.
- [Ingestion notes](ingestion.md) — how records are selected, generated, validated, and promoted.
- [Quality checklist](quality-checklist.md) — repeatable data and interface checks before adding records.
- [Count measures](count-measures.md) — inventory of piece-based household measures and gram references.
- [Deployment](deployment.md) — GitHub Pages setup, workflow, and verification routes.
- [Roadmap](roadmap.md) — intentionally deferred product capabilities.

## Local preview

The prototype is dependency-free. Open `index.html` in a browser or serve the project directory with any static file server. The generated catalog is loaded by `data/catalog-data.js`.

The About page is a separate static route at `about.html`. The catalog keeps the useful lookup flow focused; the story, principles, and roadmap live there instead of taking space below the food results.

## Important data boundary

The interface is not a medical tool and does not infer health recommendations. Values need to remain tied to a source record, food state, serving basis, and release date. Do not add hand-entered product values to the catalog without retaining the label source and verification date.
