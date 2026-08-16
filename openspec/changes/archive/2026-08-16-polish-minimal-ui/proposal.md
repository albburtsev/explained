## Why

The current interface presents a small knowledge base with oversized marketing-style headings, generous empty space, decorative graphics, and card treatments that compete with the content. A quieter, denser visual system will make courses and lessons easier to scan and read while giving the site a consistent identity across dark and light themes.

## What Changes

- Replace the spacious landing-page composition with a compact content-first course catalogue that begins immediately below the site header, without visible `Explained` or `Courses` headings in the content area.
- Remove decorative artwork and nonessential iconography so the logo is the only graphic element.
- Replace elevated course cards and navigation tiles with dense, typographic lists separated by subtle rules.
- Establish a small shared token system for color, typography, spacing, width, borders, and radii, and use it consistently across pages and components.
- Refine headings, body copy, metadata, code, search results, and lesson navigation into a restrained and readable typographic hierarchy.
- Give content an editorial serif voice while retaining compact sans-serif controls and metadata plus monospace code, using system stacks rather than an external font dependency.
- Remove the redundant footer divider so the final course entry is not followed by two adjacent horizontal rules.
- Reduce shared chrome by removing the `Courses` navigation item from the header and the `Built from Markdown with Astro.` message from the footer.
- Give lesson headings, article content, and lesson navigation the same outer width and horizontal gutters as the site header.
- Make dark mode the default theme, provide a warm light theme, and add a minimal theme switcher to the header with persisted user preference.
- Preserve the existing content model, routes, search behavior, responsive behavior, and accessibility semantics.

## Capabilities

### New Capabilities

- `site-interface`: Defines the content-first layout, shared visual system, responsive typography, and user-selectable dark and warm-light themes for the knowledge-base interface.

### Modified Capabilities

None.

## Impact

- Affects the shared Astro layout, page templates, reusable UI components, global CSS, and favicon/logo presentation.
- Adds client-side theme initialization and preference persistence but no server dependency or content-schema change.
- Does not change routes, Markdown content, search indexing, public APIs, or application dependencies; the typography uses locally available system stacks.
