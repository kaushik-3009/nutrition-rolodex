# Pantry Index design language

## Intent

Pantry Index should feel like a useful object kept near the kitchen, not a clinical dashboard or a dieting app. Its job is to make a food's nutrition label easy to find, easy to read, and difficult to misinterpret.

The visual language combines the clarity of a U.S. Nutrition Facts panel with the tactile, indexed feeling of a pantry card file. It is calm, specific, and practical.

## Principles

1. **Label truth before decoration.** Nutrition values, serving basis, food state, and source have the strongest visual hierarchy.
2. **Context is part of the value.** Every item visibly identifies whether it is dry, raw, canned, or frozen. A nutrient number without its serving and state is incomplete.
3. **Warm utility.** Use paper, pantry, and produce tones to avoid the sterile feel of a tracking application while retaining high contrast.
4. **One primary action.** Search is the center of the product. Browsing and future saved items stay secondary.
5. **A human measure beside a precise one.** Grams are canonical. Cups and tablespoons are supporting conversions, only when reliable for the specific food state.

## Core palette

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#172520` | Primary text, actions, label rules |
| Leaf | `#365945` | Ingredient cards, emphasis |
| Moss | `#78916A` | Quiet supporting details |
| Paper | `#F5F1E9` | Main background |
| Cream | `#FFFDF8` | Nutrition label surface |
| Paper deep | `#E9E1D2` | Secondary surfaces |
| Pantry orange | `#DF7147` | Small status and index accents |

The label panel deliberately remains near-black on cream, echoing the familiar printed Nutrition Facts panel. Decorative surfaces must not be used behind nutrition values.

## Typography

- **Fraunces:** display and food names. It adds a tactile, editorial quality without becoming precious.
- **DM Sans:** interface and explanatory copy. It stays readable at small sizes.
- **DM Mono:** source, state, filters, and compact metadata. It signals measured data without overwhelming the page.

Use sentence case for food names and UI labels. Use all caps only for compact metadata labels.

## Component patterns

### Search pill

One full-width search field, with an explicit Search button. It accepts ingredients and products. Popular searches are lightweight text buttons rather than competing cards.

The catalog also has a smaller live filter directly above the result cards. It is deliberately close to the foods it controls, so a user does not have to return to the hero search after every browse decision.

Results are paginated at 12 cards per page so the catalog remains scannable as more food groups are added.

### Food card

A colored card with a simple food illustration or, later, a carefully cropped package image. It holds the food identity, state, source, and a link to its detail view.

### Nutrition label

The label is a structured reference component, not a stylized approximation. It must show:

- label title
- source serving size, including grams
- calories
- available nutrients and percent Daily Value
- a clear notation for unavailable or not-established Daily Values
- a visible footnote explaining the Daily Value basis

The selected food heading aligns with the catalog heading. Category, product/ingredient type, and state sit in a compact context strip above the label. Source and record identifiers sit below the label as secondary provenance.

### Measurement extension

The selected quantity is shown in grams, cups, tablespoons, or a food-specific count such as egg, slice, leaf, or fruit. Switching units preserves the underlying gram amount. The amount field and compact unit toggles share one row on desktop. Food-specific defaults start with cups, tablespoons, or count measures when appropriate, and every household amount includes its gram equivalent in brackets. The product record decides which household units are available.

A small reset control sits beside the measurement heading. It returns the selected food to its configured default without adding another row or widening the main amount control.

## Responsive behavior

- On desktop, food context and label sit side by side for quick comparison.
- On small screens, the food card appears before the label and the navigation simplifies.
- The Nutrition Facts component keeps its printed-label hierarchy at every breakpoint; it should scroll naturally rather than shrink to unreadable text.

## Accessibility baseline

- Body text meets a 4.5:1 contrast ratio against its surface.
- Every visible interaction is keyboard accessible with a clear focus ring.
- Search has an explicit accessible label.
- Decorative food illustration is hidden from assistive technology.
- The toast is an ARIA live region.

## Non-goals for the first release

- Meal tracking and macro targets
- Weight-loss language or health claims
- Recipe nutrition calculations
- Barcode scanning
- Public user-submitted product records
