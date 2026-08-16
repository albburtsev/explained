## Context

See `proposal.md` for motivation and `specs/site-interface/spec.md` for observable requirements. The site is a static Astro application with one shared layout, four page templates, three reusable UI components, and a single global stylesheet. Search already has a small client script; there is no client framework, theme state, or loaded web font. The redesign should stay within this architecture and avoid turning a visual refinement into a component-system rewrite.

The current CSS mixes a small set of color variables with hard-coded colors, spacing, type sizes, radii, and shadows. The home page is structured as a marketing hero followed by cards, while course and lesson pages use similarly large headings and generous gaps. Existing semantic markup, content collection behavior, URLs, and search logic are sound constraints to retain.

## Goals / Non-Goals

**Goals:**

- Make content hierarchy, course scanning, and long-form reading the dominant visual experience.
- Make dark and warm-light themes two value sets for the same semantic system.
- Keep the implementation small enough to understand from the global stylesheet and existing Astro components.
- Apply the same density, type hierarchy, interaction states, and responsive rules throughout the site.
- Align lesson headings, article content, and navigation to the same shell edges as the shared header.
- Avoid a flash of the wrong theme and keep theme selection useful when storage fails.

**Non-Goals:**

- Introducing a UI framework, CSS preprocessor, client framework, or third-party theme package.
- Changing content schemas, routes, search ranking, or Markdown rendering.
- Creating illustrations, a new logo, or a broad brand system.
- Adding user accounts or synchronizing theme preferences across devices.
- Redesigning source content or adding new content types.

## Decisions

### 1. Use one compact semantic token layer

Keep the token layer in `global.css` and organize it by semantic role instead of component. The core set covers:

- color: background, surface, text, muted text, border, accent, accent-soft/focus, and code surface;
- typography: serif, sans-serif, and monospace stacks plus small, body, and three heading roles;
- layout: shell width, prose measure, and a `4/8/12/16/24/32/48px` spacing scale;
- shape: small and medium radii only.

Dark values live on `:root`; light values override only colors under an explicit `data-theme="light"` attribute. Components consume semantic variables and do not introduce theme-specific colors. A suitable starting palette is near-black green-gray (`#101311`) with soft off-white text in dark mode, and warm paper (`#f3efe6`) with olive-charcoal text in light mode. Final values must meet readable contrast for text, muted text, links, focus, and code in both themes.

No general elevation token is needed. Borders and surface changes express grouping; only the floating search results panel may use a restrained shadow to establish overlay depth.

Alternative considered: component-specific tokens. Rejected because the application is too small to justify a larger abstraction and the user explicitly wants style changes to remain limited in scope.

### 2. Use complementary system serif, sans-serif, and monospace roles

Define three truthful system stacks. The editorial role uses `ui-serif`, Charter, `Bitstream Charter`, `Sitka Text`, Cambria, Georgia, and generic `serif`; the interface role keeps the existing `ui-sans-serif` stack; code keeps the system monospace stack. Apply serif to content headings, course titles, lesson titles, and long-form prose. Apply sans-serif to search, theme controls, breadcrumbs, metadata, tags, and compact navigation labels. Directional navigation may use serif for its linked content title while retaining a sans-serif label. This creates a visible content/interface distinction without introducing a web-font request.

Use standard, widely available weights rather than fractional values: regular `400` and bold `700` for serif content, and regular `400` through semibold `600` for sans-serif interface roles. Hierarchy still comes primarily from restrained size, line height, and spacing. Target roles remain approximately 14px for compact UI and metadata, 16px for prose, 20px for tertiary headings, 28px for section headings, and a responsive page title capped around 44px. Serif prose uses a line height around `1.65`; UI uses tighter line heights. On lesson pages, the heading, article, and navigation retain the shared shell width rather than a separate `65–70ch` outer container.

Alternative considered: use serif for every element. Rejected because compact controls and metadata are clearer and denser in sans-serif. Bundling a variable or hosted serif was also rejected because it adds an asset, loading behavior, and licensing/deployment work that the system stack avoids.

### 3. Replace promotional and card composition with document-like lists

The home page begins with the course list immediately below the site header; it has no visible `Explained` or `Courses` heading, eyebrow, descriptive sentence, hero action, course count promotion, or decorative pseudo-element. Keep a single screen-reader-only page heading so the document retains an accessible heading hierarchy without adding visual chrome.

Course entries remain semantic articles and full-row links, but render as compact rows with title, description, lesson count, and textual tags separated by hairline rules. They have no minimum card height, rounded container, shadow, or hover translation. Curriculum entries and previous/next lesson navigation follow the same row language.

The course list owns its structural rules. The shared footer does not draw an additional top border: spacing and the muted source link are sufficient to separate it from page content. This prevents the final course row border and footer border from appearing as two adjacent lines on a sparse home page.

Course detail pages retain the useful content/curriculum relationship on wide screens, but the curriculum loses its card container and uses a ruled list. Lesson headings remain left-aligned, while the lesson heading, article, and lesson navigation all fill the same shared shell container as the site header so their left and right gutters match. Breadcrumb, header, and footer spacing is reduced consistently.

Alternative considered: keep cards but reduce their padding. Rejected because elevation and repeated containers still create more visual hierarchy than the small content model needs.

### 4. Treat the logo as the only graphic element

Retain the existing Explained logo/mark and favicon. Remove the decorative hero shape and the search SVG. Theme selection uses text rather than sun/moon artwork. Search kind, keyboard hint, course metadata, and lesson direction remain typographic; arrows may be plain text glyphs where they improve directional meaning.

Alternative considered: compact icon-only controls. Rejected because they contradict the logo-only graphic rule and require tooltips or more accessibility labeling to communicate the same action.

### 5. Use an explicit, persisted theme with a dark fallback

An inline initializer in the document head reads a dedicated local-storage key before visible paint and applies `data-theme="light"` only for a saved light choice. Missing, invalid, or inaccessible storage leaves `:root` in dark mode. The initializer also establishes the matching `color-scheme` so browser-provided controls follow the active theme.

The header contains a native text button. In dark mode its visible label is `Light`; in light mode it is `Dark`, describing the action rather than the current state. Its accessible name makes that action explicit. Activation updates the root attribute, browser color scheme, label, and stored value immediately. Storage access is wrapped so failure does not prevent the in-page toggle from working.

System preference is not used as the initial decision: honoring a light system preference would conflict with the explicit requirement that an unsaved first visit defaults to dark. The user's saved site choice always wins on later pages and sessions.

Alternative considered: CSS-only `prefers-color-scheme`. Rejected because it neither provides the requested header control nor gives the site a deterministic dark default.

### 6. Preserve behavior and accessibility while reducing chrome

Existing header landmarks, skip link, breadcrumb navigation, search combobox behavior, course links, lesson navigation, and reduced-motion behavior remain. The header contains only the Explained home link, search, and theme control; the separate `Courses` navigation item is removed because the logo already returns to the catalogue. The footer retains only `View source`, aligned without a companion build-technology message or its own top rule. Interactive styling uses underline, text color, border, or subtle surface shifts instead of movement. Every text control keeps a visible keyboard focus indicator and a practical hit area even where the visible typography is compact.

The desktop header stays one compact row with a three-part brand/search/theme grid. At narrow widths, search moves to its own row without hiding the logo or theme access. Course layouts collapse to one column, long labels wrap, and code blocks retain internal horizontal scrolling rather than widening the page. Lesson pages reuse the header's shell width and responsive gutters directly rather than applying a second narrower width to the heading, article, or navigation.

## Risks / Trade-offs

- [The shell-aligned lesson article produces longer lines on wide screens] → Keep prose at 16px with approximately `1.6` line height, retain the existing shell maximum, and verify scanning and reading at representative desktop widths.
- [System fonts vary by operating system] → Use standard system stacks and role-based metrics; accept small platform differences in exchange for zero font loading and consistent performance.
- [Serif metrics and darkness vary more noticeably across platforms] → Use conservative 400/700 weights, test the named fallbacks in both themes, and tune line height and letter spacing by semantic role rather than by component.
- [Theme initialization can flash or diverge from the control state] → Run the small initializer in the head, use one storage key and one root attribute, and derive the button label from the applied root state.
- [Storage can throw in restricted browsing modes] → Isolate reads and writes in guarded operations and keep dark mode plus the current-page toggle as functional fallbacks.
- [Removing cards can make grouping less obvious] → Use spacing, alignment, headings, and consistent hairline separators, then verify scanning at both sparse and larger content counts.
- [Muted colors may fail contrast in one theme] → Validate semantic roles in both themes and adjust token values rather than patching individual components.

## Migration Plan

1. Introduce the semantic tokens and both theme value sets while mapping existing selectors to them.
2. Add pre-paint theme initialization and the header theme control.
3. Simplify page and component markup, remove redundant home headings and shared-chrome labels, then replace card and hero rules with the compact list composition.
4. Align the complete lesson layout to the shared shell, apply the serif/sans-serif/monospace roles, and remove the redundant footer rule.
5. Tune typography and responsive rules against every page type and search state, including the sparse home catalogue boundary.
6. Run automated checks and manually verify both themes, keyboard interaction, persistence, narrow layouts, and no-preference/error fallbacks.

The change is presentation-only and deploys with the existing static build. Rollback consists of reverting the layout, component, and stylesheet changes; no content or persisted data migration is required. A stale saved theme key is harmless if rollback occurs.
