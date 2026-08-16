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
