## Why

Installation and configuration guidance is currently inconsistent across courses: some material is macOS-specific while the Vim course also presents Linux and Windows alternatives. The project needs one explicit platform policy so current and future learners receive a focused, internally consistent macOS setup path.

## What Changes

- Require all learner-facing installation and configuration instructions in courses, lessons, installation guides, and cheatsheets to target macOS only.
- Allow platform-neutral commands and concepts when they work on macOS, while prohibiting separate setup alternatives, paths, package-manager commands, or configuration steps for other operating systems.
- Remove existing Linux and Windows installation and configuration guidance from published course content, including the Vim course overview and configuration lesson.
- Update authoring rules and content checks so newly created or revised material preserves the macOS-only policy.
- **BREAKING**: Stop providing installation and configuration guidance for Linux and Windows learners.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `course-content`: Constrain installation and configuration content to macOS and require existing non-macOS setup guidance to be removed.

## Impact

- Affects the course-content specification and repository authoring guidance.
- Requires an audit and edits of structured Markdown under `knowledge/courses/`, `knowledge/lessons/`, and any installation-guide or cheatsheet sources that contain setup guidance.
- Requires content validation or tests that detect explicit non-macOS installation and configuration alternatives without rejecting ordinary conceptual references to other operating systems outside setup guidance.
- Does not change content slugs, course outlines, routes, application APIs, or runtime dependencies.
