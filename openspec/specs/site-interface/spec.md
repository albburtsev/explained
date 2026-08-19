# Site Interface Specification

## Purpose

Defines a compact, content-first knowledge-base interface with consistent typography and user-selectable dark and warm-light visual themes.

## Requirements

### Requirement: Content-first course catalogue
The site SHALL present the home page as a compact course catalogue that starts immediately after the site header, without visible `Explained` or `Courses` headings, introductory copy, promotional calls to action, or decorative artwork in the content area. The page SHALL retain a non-visible semantic heading for assistive technology.

#### Scenario: Visitor opens the home page
- **WHEN** a visitor opens the home page
- **THEN** the available course entries begin immediately below the site header without a visible content heading
- **AND** assistive technology can still identify the page as the courses catalogue

#### Scenario: No courses are available
- **WHEN** the course collection is empty
- **THEN** the page preserves the compact catalogue structure without displaying promotional filler

#### Scenario: Course catalogue meets the footer
- **WHEN** one or more course entries are displayed above the shared footer
- **THEN** the boundary after the final course entry uses no more than one visible horizontal rule
- **AND** the footer does not add a redundant adjacent divider

### Requirement: Author-defined course catalogue order

The site SHALL display complete course catalogues in ascending `catalogOrder`. The home-page catalogue and the `/courses` catalogue SHALL use the same ordering behavior, and alphabetical title order SHALL NOT override the author-defined order.

#### Scenario: Visitor opens the home-page catalogue

- **WHEN** the course collection contains entries with distinct `catalogOrder` values
- **THEN** the home page displays the courses from the lowest value to the highest value

#### Scenario: Visitor opens the courses catalogue

- **WHEN** the visitor opens `/courses`
- **THEN** the courses appear in the same order as on the home page

#### Scenario: A course title changes

- **WHEN** an author changes a course title without changing its `catalogOrder`
- **THEN** the course retains its position relative to the other courses

#### Scenario: An author changes catalogue order

- **WHEN** an author changes courses to another valid set of `catalogOrder` values
- **THEN** every complete course catalogue reflects the new ascending order at publication

### Requirement: Minimal graphic language
The site SHALL use the Explained logo as its only graphic element and SHALL express search, theme selection, metadata, navigation, and state through text, typography, rules, and color rather than decorative images or nonessential icons.

#### Scenario: Visitor scans a catalogue or curriculum
- **WHEN** course or lesson entries are displayed
- **THEN** entries appear as typographic list rows separated by subtle rules rather than elevated cards, illustrations, or icon-led tiles

#### Scenario: Visitor uses search
- **WHEN** the search control and its results are displayed
- **THEN** they remain understandable and operable without a search icon or result-type artwork

### Requirement: Compact readable typography
The site SHALL use a consistent editorial typographic hierarchy and compact spacing scale while preserving comfortable line height, contrast, and responsive readability. Content headings, course titles, and long-form prose SHALL use a system serif role; compact controls, navigation, and metadata SHALL use a system sans-serif role; and code SHALL use a system monospace role. On lesson pages, the lesson heading, article, and lesson navigation SHALL use the same outer content width and left and right gutters as the site header.

#### Scenario: Visitor distinguishes content from interface
- **WHEN** content and interface controls appear on the same page
- **THEN** headings, course titles, and reading prose use the shared serif role
- **AND** controls, navigation, and metadata use the shared sans-serif role
- **AND** code uses the shared monospace role without requiring an external font download

#### Scenario: Visitor reads a lesson on a wide viewport
- **WHEN** a lesson is displayed on a wide viewport
- **THEN** its title, metadata, article, code, and navigation use restrained sizes and spacing within a common outer container aligned to both edges of the site header container

#### Scenario: Visitor reads on a narrow viewport
- **WHEN** the viewport is too narrow for the desktop composition
- **THEN** content reflows without horizontal page scrolling, overlap, clipped controls, or unreadably small prose

### Requirement: Shared visual tokens
The site SHALL derive shared colors, typography roles, spacing, content widths, borders, and radii from a small semantic token set applied consistently across pages and components.

#### Scenario: Theme values change
- **WHEN** either supported theme is active
- **THEN** every shared interface state, including focus, hover, code, search results, borders, and muted text, receives its styling from the corresponding semantic tokens

### Requirement: Dark default and warm light themes
The site SHALL render in the dark theme when no user preference has been saved and SHALL also provide a warm light theme with equivalent semantic roles and readable contrast.

#### Scenario: First visit without a saved preference
- **WHEN** a visitor opens the site without a previously saved theme preference
- **THEN** the initial rendered interface uses the dark theme

#### Scenario: Warm light theme is active
- **WHEN** the light theme is selected
- **THEN** the interface uses warm paper-like background and surface colors rather than a cold or pure-white palette

### Requirement: Persistent theme control
The header SHALL provide a minimal keyboard-accessible theme control that clearly communicates its action, applies the alternate theme across the page, and persists the visitor's explicit choice for later visits.

#### Scenario: Visitor changes the theme
- **WHEN** the visitor activates the theme control
- **THEN** the alternate theme is applied immediately and the control updates to communicate the next available theme

#### Scenario: Visitor returns after choosing a theme
- **WHEN** the visitor loads another page or returns in a later browsing session
- **THEN** the saved theme is applied before the interface becomes visibly painted where browser capabilities allow

#### Scenario: Preference storage is unavailable
- **WHEN** browser preference storage cannot be read or written
- **THEN** the theme control remains usable for the current page and the interface falls back safely to the dark default on a later load

### Requirement: Minimal shared chrome
The site header SHALL contain the Explained home link, search, and theme control without a separate `Courses` navigation item. The site footer SHALL omit the `Built from Markdown with Astro.` message while preserving the source link.

#### Scenario: Visitor views the shared header
- **WHEN** any site page is displayed
- **THEN** the header provides the Explained home link, search, and theme control without displaying a `Courses` menu item

#### Scenario: Visitor views the shared footer
- **WHEN** the footer is displayed
- **THEN** it provides the source link without displaying the build-technology message

### Requirement: Existing knowledge-base behavior remains available
The visual change SHALL preserve existing routes, Markdown-rendered content, course ordering, curriculum links, previous and next lesson navigation, local search behavior, keyboard interaction, and semantic page landmarks.

#### Scenario: Visitor navigates and searches after the redesign
- **WHEN** the visitor browses courses, opens lessons, follows lesson navigation, or operates search with a keyboard
- **THEN** the same destinations and search results remain available through the redesigned interface
