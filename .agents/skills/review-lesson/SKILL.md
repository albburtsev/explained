---
name: review-lesson
description: Visually review one existing Explained lesson selected by a required lesson-slug argument, with an optional focus instruction. Use when the human author invokes `$review-lesson LESSON_SLUG [REVIEW_FOCUS]` to inspect a lesson in the local site through Chrome DevTools MCP; start or reuse the development server, capture desktop and mobile screenshots, diagnose rendering defects, report only Major and Minor findings or a brief no-problems result, close every browser page opened by the review, and avoid editing files.
---

# Review Lesson

Review exactly one rendered lesson in read-only mode. Always perform the baseline visual review; use an optional instruction to inspect a named area or concern more deeply.

## Required argument and optional focus

Require the first argument after `$review-lesson` to be the lesson's exact frontmatter `slug`. Treat all remaining text as an optional review focus:

```text
$review-lesson <lesson-slug> [review focus]
```

Do not infer the lesson slug from conversation context, a lesson title, a course title, a directory name, or a file name. Do not accept any of those values as a substitute. If the slug argument is missing, stop and ask the author to invoke the skill with it before inspecting the repository or starting a server.

An omitted focus means a complete baseline visual review. A supplied focus adds emphasis but does not replace that baseline and does not authorize edits.

## 1. Resolve the target and expected content

1. Locate the repository root and read every applicable `AGENTS.md`.
2. Validate that the lesson slug is 1–64 characters composed of at least two lowercase kebab-case segments separated by single `/` characters.
3. Search lesson frontmatter and resolve the exact slug to exactly one `knowledge/lessons/<course-id>/<lesson-id>.md` file. If it is invalid, absent, or does not resolve exactly once, stop and request a valid lesson slug; never guess or offer a title or file path as an equivalent.
4. Resolve exactly one parent course whose `lessons` array contains the exact slug. Read the lesson source and parent course so the review knows which headings, code blocks, tables, images, diagrams, and navigation labels should render.
5. Inspect `package.json`, `astro.config.*`, the lesson route, and its path helpers. Derive the URL from the actual development origin, configured base path, and lesson slug. In the current project this is normally `<origin>/explained/courses/<lesson-slug>/`; verify it instead of assuming it.
6. Inspect the current worktree and preserve every existing change. Do not edit, format, stage, or commit files during this review.

Require Chrome DevTools MCP. If it is unavailable, stop and report that the visual review cannot be completed; do not substitute a non-browser rendering or claim that source inspection is equivalent.

## 2. Reuse or start the development server

1. Look for a running development server for this exact checkout by inspecting existing DevTools pages, listening processes, and likely local URLs.
2. Reuse it only after the derived lesson route loads the expected lesson title and content. Do not reuse a server that belongs to another checkout or serves stale content.
3. If no suitable server is running, launch the repository's declared development command—currently `pnpm dev`—in a persistent terminal session. Wait for its ready message and record the exact origin and port; Astro may choose a different port when its default is occupied.
4. Do not install dependencies automatically. If the server cannot start with the existing checkout, report the failure and its error.
5. Remember whether this workflow started the server. Never stop or restart a pre-existing server. Stop only the process started by this workflow after the review, unless the author explicitly asks to keep it running.

Keep the server alive until every browser inspection and screenshot is complete. If it exits unexpectedly, preserve its output and report the failure.

## 3. Open and stabilize the lesson

Use Chrome DevTools MCP to:

1. Before opening anything, call `list_pages` and record the exact IDs of every pre-existing page. Treat this set as protected for the entire review and keep at least one protected page open until workflow-created pages are closed when one is available.
2. Open the derived lesson URL in a new isolated browser context when possible. Record the page ID returned by `new_page` and every additional page created by the workflow. Never rely on the isolated context or the end of the turn to close them automatically.
3. Run the browser workflow with cleanup in a `finally` path so success, failure, interruption, or an early report all attempt the same page cleanup.
4. Wait for the lesson title to appear and confirm that the response is the intended lesson rather than an error page or redirect.
5. Wait for `document.fonts.ready`, all images to finish loading, and the DOM to stabilize. Confirm that diagrams and client-rendered elements have finished rendering before capture.
6. Take a fresh accessibility-tree snapshot to inventory the rendered structure and locate elements for follow-up screenshots.
7. Inspect console errors and failed network requests that could explain missing or broken visuals.

Do not treat the accessibility snapshot, DOM, or source as a substitute for looking at the screenshots. Use them only to confirm and diagnose visual observations.

## 4. Capture the required viewports

Use these fixed CSS viewport sizes for reproducible coverage:

- Desktop: `1920 × 1080`, device pixel ratio `1`, without mobile or touch emulation.
- Mobile: `414 × 896`, device pixel ratio `1`, with mobile and touch emulation.

For each viewport:

1. Apply the exact viewport with the DevTools `emulate` capability: `1920x1080x1` for desktop and `414x896x1,mobile,touch` for mobile.
2. Reload the lesson after changing emulation so responsive scripts initialize against the intended viewport.
3. Wait again for the title, fonts, images, diagrams, and DOM stability.
4. Capture a PNG screenshot of the full page with `take_screenshot` and `fullPage: true`.
5. Visually inspect the screenshot before proceeding. If the full-page image is downscaled, exceeds tool limits, or makes details unreadable, capture overlapping viewport or element screenshots for the top, middle, bottom, and every suspicious region. Do not omit any part of the lesson.

When a review focus names a component or region, capture an additional close screenshot of it at both viewports when it exists.

## 5. Analyze visual and runtime evidence

Compare the rendered page with the expected source content at both viewports. Check at minimum:

- Missing, invisible, transparent, zero-sized, or off-screen content.
- Text overlap, clipping, truncation, unreadable wrapping, poor contrast, and headings obscured by sticky elements.
- Page-level horizontal overflow and content wider than the viewport.
- Broken, distorted, cropped, or illegibly scaled images, SVGs, canvases, and diagrams; inspect labels, connectors, legends, and arrows.
- Tables, code blocks, callouts, lists, and blockquotes that escape their containers or become unusable. Distinguish an intentional inner horizontal scroller from page-wide overflow.
- Breadcrumbs, lesson heading, previous/next navigation, links, buttons, and other controls that overlap, disappear, or lose a usable target.
- Excessive or collapsed spacing, abrupt alignment changes, inconsistent widths, and responsive layout shifts.
- Broken fonts, icons, images, stylesheets, or client-side rendering indicated by console or network failures.

Use DevTools runtime inspection to test observations, including `scrollWidth` versus `clientWidth`, bounding boxes that cross viewport edges, image load state, computed visibility, and the dimensions of suspicious diagrams. Prefer concrete measurements and element identification over speculation.

Inspect the optional focus in additional depth. Never suppress an unrelated major visual defect discovered during the baseline review.

## 6. Report and clean up

Do not fix defects as part of this skill. Before writing the report, perform cleanup in this order:

1. Call `list_pages` again and identify every page whose ID was not in the protected pre-existing set and that was opened by this workflow, including pages created inside its isolated context.
2. Close every identified page with `close_page`, in reverse creation order when the order is known.
3. If `close_page` refuses only because a workflow-created page is the last open page, select that exact created page and close its window with `evaluate_script` running `() => window.close()`. Never use this fallback on a protected pre-existing page.
4. Call `list_pages` once more and confirm that none of the workflow-created page IDs remain. Never close a protected pre-existing page.
5. Stop only the development server started by this workflow. Never stop a pre-existing server.

Attempt all cleanup steps even when navigation, rendering, screenshot capture, or analysis fails. If any created page cannot be closed, report the exact remaining page ID and cleanup error after the visual report.

Classify findings into only these severities:

- **Major:** essential content is missing, unreadable, unusable, or another clear rendering defect materially harms comprehension or interaction in either viewport.
- **Minor:** a localized visual defect or inconsistency with limited impact.

For every finding, include the affected viewport, page region or element, screenshot evidence, corroborating DevTools evidence when available, and the likely source file or component. Avoid reporting aesthetic preferences as defects unless they violate an established project pattern or the optional focus explicitly asks for that judgment.

When at least one finding exists, return exactly this report shape and include both groups:

```markdown
## Major

- <finding, or `None.` when this group is empty>

## Minor

- <finding, or `None.` when this group is empty>
```

Do not add another severity, an overall summary, a coverage section, or recommendations to a findings report.

When no visual defects are found and every required check completed, return only this short message with the actual slug:

```text
No visual problems found for <lesson-slug> at 1920×1080 and 414×896.
```

Do not append metadata or recommendations to the no-problems message. Never claim that no problems were found when a required viewport, screenshot, or check could not be completed; report the incomplete review and its cause concisely instead.

Return or attach the two core screenshots when the client supports image output. Screenshot attachments do not change the required text-report shape. Append a single `Cleanup warning:` sentence only when browser-page or owned-server cleanup failed.
