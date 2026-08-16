## 1. Establish the visual system

- [x] 1.1 Replace the current root variables in `src/styles/global.css` with semantic dark-default color tokens, a `data-theme="light"` warm palette, shared font roles, the `4/8/12/16/24/32/48px` spacing scale, content measures, borders, and small radii.
- [x] 1.2 Refactor global element and interaction styles to consume the new tokens, use one system sans stack plus system monospace, and remove hard-coded theme colors, oversized display typography, broad shadows, and motion-based hover effects.
- [x] 1.3 Tune both palettes so normal text, muted text, links, focus indicators, code, borders, selected search results, and form controls remain readable and visibly distinct.

## 2. Add persistent theme selection

- [x] 2.1 Add a guarded pre-paint theme initializer to `BaseLayout.astro` that reads one local-storage key, applies a saved light preference, defaults missing or invalid state to dark, and sets the matching browser `color-scheme`.
- [x] 2.2 Add a native text theme button to the shared header whose visible `Light` or `Dark` label describes the next action and whose accessible name, root theme state, browser color scheme, and saved preference stay synchronized.
- [x] 2.3 Handle unavailable local storage so toggling still works for the current page and a later unsaved load safely returns to dark.

## 3. Simplify shared navigation and search

- [x] 3.1 Recompose the shared header and footer into compact typographic rows while retaining the logo, search, theme access, skip link, and semantic landmarks.
- [x] 3.2 Remove the search SVG and restyle the input, keyboard hint, overlay, statuses, and result rows as compact text-first controls without changing the existing search loading, ranking, or keyboard behavior.
- [x] 3.3 Verify the logo and favicon are the only graphic elements and replace any remaining decorative or icon-led UI with text, rules, or typographic glyphs.

## 4. Convert pages to content-first layouts

- [x] 4.1 Remove the home hero, intro copy, eyebrow, CTA, availability message, and decorative hero treatment from `src/pages/index.astro`.
- [x] 4.2 Refactor `CourseCard.astro` and its catalogue styles into compact, full-row course entries with title, description, lesson count, textual tags, and hairline separators instead of card elevation or fixed height.
- [x] 4.3 Tighten breadcrumbs, page headings, tags, content spacing, and the course detail layout while converting the curriculum container into a ruled lesson list.
- [x] 4.4 Left-align lesson headings to the prose measure and convert previous/next lesson navigation into compact typographic rows with unchanged destinations and labels.

## 5. Complete responsive and accessibility behavior

- [x] 5.1 Update responsive rules so the header controls remain available, course and curriculum layouts collapse cleanly, long text wraps, prose stays readable, and code scrolls internally without horizontal page overflow.
- [x] 5.2 Provide consistent visible hover, selected, and keyboard-focus states plus practical hit areas for links, search, and theme selection in both themes.
- [x] 5.3 Retain reduced-motion handling, semantic headings and landmarks, breadcrumbs, search ARIA state, and keyboard navigation after the markup and style simplification.

## 6. Verify the change

- [x] 6.1 Run `pnpm check`, `pnpm test`, and `pnpm build` and resolve any regressions caused by the UI changes.
- [x] 6.2 Manually exercise the home, courses, course detail, and lesson routes at wide and narrow viewports in both themes, including search keyboard controls and previous/next navigation.
- [x] 6.3 Verify first-load dark mode, pre-paint restoration of each saved theme, updated toggle labels, reload/navigation persistence, and graceful behavior when local storage access fails.
- [x] 6.4 Check contrast for all semantic color roles in both themes and confirm there is no decorative artwork, non-logo icon, clipped control, or page-level horizontal overflow.

## 7. Follow-up interface reduction

- [x] 7.1 Remove the visible `Explained` and `Courses` headings from the home content area, retain a single screen-reader-only page heading, and start the ruled course list immediately below the shared header.
- [x] 7.2 Remove the `Courses` navigation item from `BaseLayout.astro`, rebalance the desktop and mobile header grids around logo, search, and theme controls, and verify the logo remains the catalogue entry point.
- [x] 7.3 Remove the `Built from Markdown with Astro.` footer message and simplify footer alignment while preserving the `View source` link and footer landmark.
- [x] 7.4 Make the lesson heading, article, code blocks, and lesson navigation use the shared shell width and the same responsive left and right gutters as the site header.
- [x] 7.5 Run the complete CI suite and exercise all routes at wide and narrow viewports in both themes, verifying accessible heading structure, header controls, source navigation, lesson alignment, search, theme persistence, contrast, and horizontal overflow.

## 8. Refine separators and editorial typography

- [x] 8.1 Add shared system serif, sans-serif, and monospace font-role tokens; apply serif to content headings, course and lesson titles, and long-form prose while keeping controls, navigation, metadata, and tags in sans-serif and code in monospace.
- [x] 8.2 Replace fractional font weights with standard role-appropriate weights, tune serif prose to a comfortable line height, and verify that the compact hierarchy remains readable without an external font request.
- [x] 8.3 Remove the footer's redundant top rule while preserving the course list's structural separator, so no more than one horizontal line appears after the final home-page course entry.
- [x] 8.4 Exercise the home, course, lesson, search, and navigation typography at wide and narrow viewports in both themes, then run `pnpm check`, `pnpm test`, and `pnpm build` and resolve any regressions.
