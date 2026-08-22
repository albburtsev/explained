# Course Content Specification

## Purpose

Defines the structure, authoring inputs, generated content, and optional supporting material for concise beginner courses.

## Requirements

### Requirement: Concise beginner course

The system SHALL represent a course as a short, focused introduction for someone new to a subject. A course SHALL provide only the theory needed to begin practical work and SHALL NOT define a separate prerequisites list.

#### Scenario: Learner starts a course

- **WHEN** a learner opens a course
- **THEN** the course introduces the subject without requiring a separate prerequisites section
- **AND** the curriculum moves from essential theory toward practical work

### Requirement: Ordered curriculum

A course SHALL contain one or more lessons in a fixed order. A lesson MAY be independent or MAY rely only on lessons that appear earlier in the same course.

#### Scenario: Course contains one lesson

- **WHEN** an author defines a course with a single lesson
- **THEN** the lesson forms a valid complete curriculum

#### Scenario: Lesson depends on earlier material

- **WHEN** a lesson uses knowledge or work established by another lesson
- **THEN** the depended-on lesson appears earlier in the course

### Requirement: Atomic lesson

The system SHALL represent each lesson as one Markdown file covering exactly one topic. A lesson SHALL be designed to take between 1 and 30 minutes to complete.

#### Scenario: Author defines a lesson

- **WHEN** a lesson is added to a course outline
- **THEN** it has one clearly bounded topic
- **AND** its complete primary content is stored in one Markdown file
- **AND** its expected completion time is between 1 and 30 minutes

### Requirement: Human-defined course outline

The course creation flow SHALL require the human author to provide the course title and ordered lesson outline. The system SHALL automatically generate the short course description and the content of each lesson.

#### Scenario: Author creates a course

- **WHEN** the author provides a course title and an ordered outline containing at least one lesson
- **THEN** the system generates a short course description
- **AND** the system generates content for every lesson in the outline

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

#### Scenario: Existing courses adopt descending catalogue order

- **WHEN** the existing course collection is migrated to descending `catalogOrder`
- **THEN** Temporal declares `40`, OpenSpec declares `30`, Vim declares `20`, and Git declares `10`
- **AND** their visible order remains Temporal, OpenSpec, Vim, then Git
- **AND** their slugs, routes, and lesson references remain unchanged

### Requirement: Automatic catalogue placement for a new course

The course creation flow SHALL assign a valid, unique `catalogOrder` to a new course automatically. The assigned value SHALL be `10` for an empty catalogue or the greatest existing value plus `10`, placing the new course before every existing course without changing their metadata. The flow SHALL NOT require the human author to provide catalogue-order metadata as an additional input.

#### Scenario: Author creates a course in a non-empty catalogue

- **WHEN** the author provides the required title, goal, and ordered lesson outline
- **THEN** the generated course declares a valid, unique `catalogOrder` equal to the previous maximum plus `10`
- **AND** every previously existing course retains its `catalogOrder`
- **AND** the new course appears before all previously existing courses
- **AND** the author is not asked to choose the value

#### Scenario: Author creates the first course

- **WHEN** the author creates a course while the course collection is empty
- **THEN** the generated course declares `catalogOrder: 10`
- **AND** the author is not asked to choose the value

### Requirement: English-only course content

The system SHALL publish course content only in English. This includes course and lesson titles and descriptions, lesson bodies, installation guides, and cheatsheets. The course creation flow SHALL require the human-provided course title and ordered lesson outline to be in English.

#### Scenario: Course content is prepared for publication

- **WHEN** an author creates or modifies course content
- **THEN** all learner-facing course content is written in English before publication
- **AND** no non-English version of the course is published

### Requirement: macOS-only installation and configuration guidance

All learner-facing installation and configuration instructions SHALL target macOS exclusively. This restriction SHALL apply to course overviews, lesson metadata and bodies, installation guides, and cheatsheets. When setup guidance uses operating-system-specific commands, package managers, filesystem paths, shell configuration, graphical interface steps, or troubleshooting, the content SHALL provide only the macOS procedure and SHALL NOT provide an alternative for Windows, Linux, or any other operating system. Platform-neutral setup instructions SHALL be included only when they are valid on macOS. Non-procedural references to other operating systems outside installation and configuration guidance SHALL remain permitted.

#### Scenario: Author adds setup guidance

- **WHEN** an author creates or modifies learner-facing installation or configuration content
- **THEN** every operating-system-specific procedure in that content is for macOS
- **AND** the content contains no alternative setup procedure for another operating system

#### Scenario: Setup command is platform-neutral

- **WHEN** installation or configuration guidance uses a command or concept that is not specific to one operating system
- **THEN** the guidance may include it only when the documented procedure works on macOS
- **AND** the surrounding instructions do not redirect learners to a different operating system

#### Scenario: Existing content is migrated

- **WHEN** repository course content is validated after this policy is introduced
- **THEN** no course overview, lesson, installation guide, or cheatsheet contains installation or configuration instructions for an operating system other than macOS
- **AND** applicable setup guidance presents a complete macOS path without changing course identity or curriculum order

#### Scenario: Another operating system is mentioned conceptually

- **WHEN** learner-facing content mentions another operating system without instructing the learner to install or configure anything for that system
- **THEN** the macOS-only setup policy does not require that conceptual reference to be removed

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

### Requirement: Optional installation guide

A course MAY include an installation guide before its first lesson. The guide SHALL prepare the learner's environment, SHALL NOT be treated as a lesson, and SHALL NOT count toward the course's lesson total.

#### Scenario: Course requires environment setup

- **WHEN** an installation guide is included
- **THEN** it appears before the first lesson
- **AND** the course's lesson count excludes it

#### Scenario: Course requires no environment setup

- **WHEN** an installation guide is not included
- **THEN** the course begins with its first lesson

### Requirement: Explicitly requested cheatsheet

A course MAY include a compact, printable PDF cheatsheet after its final lesson. The cheatsheet SHALL summarize useful commands, concepts, or keyboard shortcuts in a space-efficient layout. It SHALL NOT be treated as a lesson, SHALL NOT count toward the course's lesson total, and SHALL be generated only after an explicit request from the human author.

#### Scenario: Author requests a cheatsheet

- **WHEN** the human author explicitly requests a cheatsheet
- **THEN** the system generates a compact printable PDF relevant to the course
- **AND** presents it after the final lesson

#### Scenario: Author does not request a cheatsheet

- **WHEN** the human author creates a course without requesting a cheatsheet
- **THEN** the system does not generate one

### Requirement: OpenSpec beginner course

The system SHALL publish an English-language course titled `OpenSpec` as a concise introduction for newcomers. The course SHALL contain exactly three lessons in the fixed order defined below, SHALL begin with its first lesson without a separate installation guide, and SHALL NOT include a prerequisites section or cheatsheet.

#### Scenario: Learner opens the OpenSpec course

- **WHEN** a learner opens the `OpenSpec` course
- **THEN** the course presents a generated short description in English
- **AND** lists exactly three lessons in the required order
- **AND** does not present an installation guide, prerequisites section, or cheatsheet as additional course material

### Requirement: Important definition emphasis

The course overview and every lesson SHALL visually distinguish each important OpenSpec term at the point where the term is defined or first explained by wrapping it in Markdown inline-code formatting. Important terms include concepts such as `specification-driven development`, `proposal`, `specification`, `delta specification`, `design`, `task list`, `artifact`, `CLI`, `coding-agent skill`, and `archive`. The content SHALL leave routine repetitions unformatted unless they represent a literal command, path, filename, or identifier.

#### Scenario: Learner encounters an important definition

- **WHEN** the course overview or a lesson defines or first explains an important OpenSpec concept
- **THEN** the defining term is wrapped in Markdown inline-code formatting
- **AND** later routine prose mentions remain unformatted unless they represent literal code-related text

### Requirement: OpenSpec introduction lesson

The first lesson SHALL explain what OpenSpec is, which problems it addresses when requirements otherwise live only in coding-agent chat, and how it supports specification-driven development. It SHALL present Homebrew and global npm as two macOS installation methods, include current runtime and verification guidance, explain project initialization, and link to the official OpenSpec website, repository, documentation, and package page.

#### Scenario: Learner completes the introduction

- **WHEN** a learner completes the first lesson
- **THEN** the learner can describe the purpose of OpenSpec
- **AND** can choose between the documented Homebrew and npm installation methods on macOS
- **AND** can verify the installed CLI and initialize OpenSpec in a project
- **AND** can follow links to the official project resources

### Requirement: Coding-agent workflow lesson

The second lesson SHALL teach how to use OpenSpec with a coding agent. It SHALL distinguish terminal commands from commands or skills invoked in the agent chat, use Codex syntax as the primary concrete example, and note that equivalent invocation syntax varies by agent. It SHALL explain the complete beginner workflow from optional exploration and proposal review through implementation, post-apply review, correction, re-application, verification, and archive. It SHALL explain that unfinished tasks continue through `$openspec-apply-change`, while a defect or planning gap discovered after implementation was marked complete requires `$openspec-update-change` to revise the affected planning artifacts or add corrective tasks before `$openspec-apply-change` is run again. The change SHALL be archived only after the corrected implementation is verified.

#### Scenario: Learner follows a change workflow

- **WHEN** a learner completes the second lesson
- **THEN** the learner knows where to invoke terminal commands and coding-agent commands
- **AND** can start an exploration or proposal with Codex
- **AND** knows to review the planning artifacts before requesting implementation
- **AND** reviews the implementation after apply and does not archive a result known to be incorrect
- **AND** distinguishes an unfinished task from a defect or planning gap discovered after apply was completed
- **AND** can use `$openspec-update-change` to correct the plan or add a corrective task before running `$openspec-apply-change` again
- **AND** archives the change only after the corrected implementation is verified

### Requirement: OpenSpec internals lesson

The third lesson SHALL explain OpenSpec at the package, CLI-command, and project-file levels. It SHALL cover the purpose of the core setup and inspection commands, the roles of `openspec/config.yaml`, main specifications, active changes, delta specifications, planning artifacts, archived changes, and generated coding-agent integration files, and the dependency flow from proposal through tasks and implementation.

#### Scenario: Learner inspects an initialized project

- **WHEN** a learner completes the third lesson and inspects an initialized OpenSpec project
- **THEN** the learner can identify which commands belong in the terminal
- **AND** can locate the current specifications and active or archived changes
- **AND** can explain the roles of proposal, specification, design, and task artifacts
- **AND** can identify where OpenSpec stores instructions for configured coding agents
