## ADDED Requirements

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
