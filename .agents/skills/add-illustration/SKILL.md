---
name: add-illustration
description: "`<lesson-slug> <illustration-description>` — Generate one mobile-friendly raster illustration with English labels and embed the same file in both language versions of an existing lesson. Use when the author asks to add an illustration, picture, image, diagram, or figure to a lesson under `knowledge/lessons/`."
argument-hint: "<lesson-slug> <illustration-description>"
---

# Add Illustration

Generate one raster illustration with English labels for an existing bilingual lesson. Embed the same file at the same place in the English source and Russian translation. Translate the alt text, not the image. The author decides what to show; you decide where it goes.

## Required arguments

Require the first argument after `$add-illustration` to be the lesson's exact frontmatter `slug`. Treat all remaining text as the required illustration description:

```text
$add-illustration <lesson-slug> <what the illustration should show>
```

Do not infer the lesson slug from conversation context, a lesson title, a course title, a directory name, or a file name. If either argument is missing, stop and ask the author to invoke the skill with both the lesson slug and the description before inspecting or editing course content.

The description may be written in any language. Text inside the shared image is always English. Alt text uses the language of the lesson file that embeds it.

This skill needs a native image generation capability in the host. If none is available, stop and say so. Do not substitute an image drawn with code (SVG, Mermaid, matplotlib, HTML screenshots): the author expects a generated illustration, and a substitute would silently change what they asked for.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md` completely and freshly. Inspect the site's current semantic colors and typography in `src/styles/global.css` and the repository validation commands.
2. Preserve unrelated and pre-existing changes in the worktree.

## 2. Resolve the lesson

1. Validate that the lesson-slug argument is 1–64 characters composed of at least two lowercase kebab-case segments separated by single `/` characters.
2. Search lesson frontmatter and resolve the exact slug to exactly one `knowledge/lessons/<course-id>/<NN>-<lesson-id>.md` file. If it is invalid, absent, or does not resolve exactly once, stop and request a valid lesson slug; never guess.
3. Read the whole lesson, its `.ru.md` translation, and the parent course in `knowledge/courses/`. If the translation is missing, stop and report it. Note existing lesson illustrations so the new one matches their style and does not repeat them.

## 3. Understand what to illustrate

Before generating anything, map the description onto the lesson:

- Identify the concept, flow, or structure the author wants to show and the passage that explains it.
- Take facts and English labels from the source lesson: component names, steps, relationships, and identifiers. Use the Russian translation to check that the same image supports its explanation. A picture that contradicts either version is worse than no picture.
- If the description asks for something the lesson does not cover, or contradicts the lesson, stop and explain the mismatch. Adding the missing theory is a job for `fix-lesson`, not for this skill.
- If the description is too vague to draw one clear picture, ask one concise clarifying question.

## 4. Choose the placement

Put the image where the reader has just met the idea it shows, so the picture confirms and organizes what they read. Good default: directly after the paragraph (or short group of paragraphs) that first explains the concept, before the text moves on to code or the next idea.

Weigh these points:

- **After, not before, the explanation.** The image supports the text; it does not replace the first explanation of a term.
- **Not before the first paragraph.** The page header already shows the title and description, so the lesson should open with prose.
- **Inside the relevant section.** If the idea has its own `##` heading, the image belongs in that section, usually after its opening explanation.
- **Keep structures whole.** Never place the image inside a list, table, code block, blockquote, or `:::details` block, and never between a sentence that introduces a code block (for example, one ending with a colon) and that code block.
- **Spacing.** Do not put two images next to each other. Leave prose between an existing illustration and the new one.

Choose the place in the English source, then use the matching place in the Russian translation, which has the same structure. If two places are equally good, choose the earlier one. If no place fits well, say so and explain why instead of forcing the image in.

## 5. Generate the image

Derive a short file name from the description: lowercase kebab-case, 1–4 words, naming the subject (for example `event-history-replay`). Make it unique inside `knowledge/lessons/<course-id>/<lesson-id>/`. Do not ask the author for it. Generate only this one file; do not create a `.ru` variant.

Write the prompt in English from the description and lesson facts. Give the illustration the site's restrained editorial style:

- Flat shapes, simple rules, generous but useful spacing, and system-like sans-serif labels. For diagrams, use clear connectors and modest rectangular blocks. No photorealism, 3D, heavy gradients, deep shadows, decorative scenes, mascots, logos, or brand marks.
- Use the current dark-theme semantic colors from `src/styles/global.css`: surface, text, muted lines, and one accent. At present they are `#22221e`, `#dcd8cc`, `#a39f94`, and `#8cc3d6`. Keep contrast clear; the single dark-background image also appears as a self-contained figure in the light theme.
- Prefer portrait or near-square composition and top-to-bottom flows. Keep labels few, short, English-only, and large enough to read when the whole image is rendered **256 CSS pixels wide**, the approximate lesson width on a 320 px phone. Use landscape only if it passes that same check. Avoid large empty margins that shrink useful content.

After generation, inspect the full image and a 256 px-wide preview:

- Every English label is spelled correctly, uses the source lesson's terms, and remains readable at phone width.
- Steps, arrows, and relationships match the text.
- Nothing is invented, missing, clipped, or misleading; the composition works on both site themes.

If the image fails a check, refine the prompt and generate it again. After three failed attempts, stop, keep nothing in either lesson file, and report what went wrong.

Save the accepted image as `knowledge/lessons/<course-id>/<lesson-id>/<file-name>.<ext>`, using the format the generator produced (PNG, JPEG, or WebP). If its longest side exceeds 2000 px, downscale it with an available image tool. Astro converts it to WebP at build time, so do not re-encode it otherwise.

## 6. Embed the image

Insert the same image as its own paragraph, with a blank line before and after, at the same place in both files. In the English source:

```markdown
![<English alt text>](./<lesson-id>/<file-name>.<ext>)
```

In the Russian translation:

```markdown
![<Russian alt text>](./<lesson-id>/<file-name>.<ext>)
```

Write alt text that tells a reader who cannot see the image what it shows and what it means: one or two short, plain sentences in the language of the file, in the lesson's terms. The Russian alt text conveys the same meaning in natural Russian. Do not start with "Image of", "Diagram showing", or their Russian equivalents.

Leave the surrounding prose unchanged in both files. The lesson must still read correctly without the image, so do not add "see the image below" or make any sentence depend on it.

## 7. Verify the result

1. Re-read both lesson files around the image. Confirm the image URLs match byte-for-byte, the alt text is translated, and the shared file exists.
2. Inspect the image at 256 px width and, when a site preview is available, at 320 px and 414 px viewports in both themes. Check labels, connectors, contrast, and horizontal overflow.
3. Confirm no unrelated file changed. Run `pnpm run ci` when available; otherwise run the repository's content validation and build commands. Run `git diff --check` and inspect the final diff.
4. Do not stage or commit changes unless explicitly requested.

For a deeper independent browser review, suggest `$review-lesson <lesson-slug>` to the author.

Report the lesson and translation paths, the shared image path, where it was placed and why, both alt texts, the validation results, and any check that could not be completed.
