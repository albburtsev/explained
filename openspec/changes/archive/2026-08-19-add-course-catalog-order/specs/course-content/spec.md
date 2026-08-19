## ADDED Requirements

### Requirement: Explicit course catalogue order

Every course source document SHALL declare a `catalogOrder` in its frontmatter. The value SHALL be a positive integer and SHALL be unique across the course collection. This metadata SHALL control only the course's position in catalogues and SHALL NOT change its slug, route, or ordered lesson references.

#### Scenario: Course declares a valid catalogue order

- **WHEN** an author defines a course source document
- **THEN** its frontmatter contains a positive integer `catalogOrder`
- **AND** no other course declares the same value

#### Scenario: Catalogue order metadata is invalid

- **WHEN** a course omits `catalogOrder` or declares a value that is not a positive integer
- **THEN** content validation fails before publication
- **AND** the error identifies the affected course and the required value

#### Scenario: Catalogue order values are duplicated

- **WHEN** two or more courses declare the same `catalogOrder`
- **THEN** content validation fails before publication
- **AND** the error reports the duplicate value and every conflicting course

#### Scenario: Existing courses receive catalogue order metadata

- **WHEN** the existing course collection is migrated to `catalogOrder`
- **THEN** Git precedes OpenSpec and OpenSpec precedes Vim
- **AND** their slugs, routes, and lesson references remain unchanged

### Requirement: Automatic catalogue placement for a new course

The course creation flow SHALL assign a valid, unique `catalogOrder` to a new course automatically. The assigned value SHALL place the new course after every existing course, and the flow SHALL NOT require the human author to provide catalogue-order metadata as an additional input.

#### Scenario: Author creates a course in a non-empty catalogue

- **WHEN** the author provides the required title, goal, and ordered lesson outline
- **THEN** the generated course declares a valid, unique `catalogOrder`
- **AND** the new course appears after all previously existing courses
- **AND** the author is not asked to choose the value

#### Scenario: Author creates the first course

- **WHEN** the author creates a course while the course collection is empty
- **THEN** the generated course declares a valid positive integer `catalogOrder`
- **AND** the author is not asked to choose the value
