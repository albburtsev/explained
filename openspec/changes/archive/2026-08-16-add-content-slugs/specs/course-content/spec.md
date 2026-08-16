## ADDED Requirements

### Requirement: Explicit content slugs

Every course, lesson, and cheatsheet SHALL declare a `slug` in the YAML frontmatter of its own structured source document. A slug SHALL be a human-readable path of 1 to 64 characters composed of one or more lowercase kebab-case segments separated by single `/` characters. Each segment SHALL contain lowercase ASCII letters or digits with words separated only by single hyphens; a slug SHALL NOT begin or end with `-` or `/`, contain empty segments, or contain repeated separators. A course slug SHALL use one segment. A lesson or cheatsheet slug SHALL begin with its parent course slug followed by `/` and recognizable topic context. A generated cheatsheet PDF MAY omit source frontmatter because its associated structured source document is the authoritative entity record.

#### Scenario: Author creates a course

- **WHEN** an author adds a course source document
- **THEN** its frontmatter contains a valid `slug` that identifies the course

#### Scenario: Author creates a lesson

- **WHEN** an author adds a lesson source document
- **THEN** its frontmatter contains a valid `slug` beginning with its parent course slug and `/`
- **AND** the remaining segment or segments identify the lesson topic

#### Scenario: Author creates a cheatsheet

- **WHEN** an author explicitly requests and adds a cheatsheet source document
- **THEN** its frontmatter contains a valid `slug` beginning with its parent course slug and `/`
- **AND** the remaining segment or segments identify the cheatsheet
- **AND** the printable PDF is associated with that structured source entity

#### Scenario: Content has no valid slug

- **WHEN** a course, lesson, or cheatsheet source document has a missing, empty, or malformed `slug`
- **THEN** content validation fails before publication
- **AND** the error identifies the affected source document and the required slug format

### Requirement: Globally unique content slugs

Each `slug` SHALL identify exactly one entity across the combined set of courses, lessons, and cheatsheets. The course path segment and remaining topic context in lesson and cheatsheet slugs SHALL allow an author to distinguish the represented entity without relying on an opaque generated value.

#### Scenario: Slugs are distinct across content types

- **WHEN** all course, lesson, and cheatsheet source documents are validated
- **THEN** no two entities share the same `slug`, including entities of different content types

#### Scenario: Duplicate slugs are declared

- **WHEN** two or more content entities declare the same `slug`
- **THEN** content validation fails before publication
- **AND** the error reports the duplicate value and every conflicting source document

### Requirement: Existing content has explicit slugs

Every course and lesson present when this requirement is introduced SHALL be migrated to include a valid, globally unique `slug` in its frontmatter. There are no existing cheatsheets requiring migration.

#### Scenario: Existing repository content is validated

- **WHEN** the migrated courses and lessons are validated
- **THEN** every existing entity has a valid `slug`
- **AND** every migrated slug is unique across the repository's content entities

### Requirement: Slugs control content routes and references

The system SHALL use each frontmatter `slug` as the entity's Astro entry ID and therefore as its route and reference key. Every migrated slug SHALL equal that entity's previous file-derived entry ID so introducing explicit slugs preserves all existing course and lesson URLs and course-to-lesson references. After publication, a slug SHALL be treated as stable unless its routes and references are intentionally migrated together.

#### Scenario: Existing content is published after migration

- **WHEN** slugs have been added to all existing courses and lessons
- **THEN** their previously available URLs remain unchanged
- **AND** each course retains the same ordered lesson references

#### Scenario: Published slug is changed

- **WHEN** an author changes the `slug` of a published course, lesson, or cheatsheet
- **THEN** content validation and review treat the edit as a route and reference identity change
- **AND** every affected reference is updated before publication
