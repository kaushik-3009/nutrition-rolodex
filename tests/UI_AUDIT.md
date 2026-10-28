# Detailed UI audit

Revisited both the catalog and About page using fresh browser sessions, screenshot
inspection, keyboard navigation, native dropdowns, multiple tabs, invalid drafts,
missing data downloads, and font loading. Four Luna agents independently inspected
visual layout, accessibility/search, menu editing/persistence, and browser engines.

## Fixed findings

- External Google Fonts failed to load in the browser. Bundled fonts with OFL
  licenses now load from the same origin; no font CDN requests are required.
- Portion dropdowns reset to a placeholder immediately after selection. Keep the
  selected source measure visible, display its full description below the control,
  and clear it when the amount changes or is reset.
- Enter on the second results page selected a food from the first page. Keyboard
  selection and the selected-food panel now follow the displayed results page.
- Punctuation-only searches displayed the entire catalog; non-Latin terms were
  stripped. Keep Unicode letters/numbers and show no matches for punctuation-only input.
- Skip links did not transfer focus into the content and could sit behind the
  sticky header. Targets are focusable, with the skip link above the header.
- Quantity buttons clipped keyboard focus; input focus was difficult to see.
  Added focus rings and inset button outlines. Removed redundant native quantity
  steppers that crowded the digits at narrow widths.
- Small accent/metadata text had weak contrast; nutrient/serving rows could collide
  at enlarged text sizes. Improved colors, wrapping, and narrow header layout.
- Adding/removing another food silently discarded invalid menu quantity drafts.
  Preserve drafts and warnings until corrected or explicitly removed/cleared.
- Changes in another tab could be overwritten by a stale menu. Synchronize saved
  changes between tabs and discard obsolete undo snapshots.
- The large catalog could still be loading when search/add controls appeared
  actionable. Show loading/failure feedback and disable initial actions until ready.
- Added a favicon to remove the browser's missing-icon request.

## Validation

- Chromium screenshots and interactions at 320, 390, 640, 768, 1024 and 1440 CSS px.
- Index and About reflow at 200% text enlargement; desktop 200% zoom equivalent
  (640 CSS px). Both pages have no document-level horizontal overflow in these checks.
- Five-food entry loops, live totals, quantity keyboard entry, remove/undo,
  download, persistence, multiple invalid drafts and cross-tab synchronization.
- Native group/portion selects, longest group label, selected portion retention,
  pagination keyboard behavior, skip focus, empty searches and failed catalog loading.
- Local fonts loaded; new audit browser flow reports no failed or external requests.
- Existing Node tests and catalog validation remain part of the checks.

Commands and executable overrides are documented in README.md. Firefox and WebKit
binaries downloaded, but this cloud machine lacks their required shared libraries;
those engines were not validated. Mobile checks emulate viewports in Chromium,
not physical iOS/Android devices. These checks do not establish that every possible
browser, assistive technology, or interaction is defect-free.
