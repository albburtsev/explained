---
name: add-illustration
description: "`<lesson-slug> <illustration-description>` — Generate one raster illustration, in an English and a Russian version, for an existing bilingual Markdown lesson selected by a required lesson-slug argument, from a required description of what to draw, and embed each version at the same place in the matching lesson file where it helps the reader most. Use when the human author invokes `$add-illustration` or otherwise asks to add, draw, generate, or insert an illustration, picture, image, diagram, or figure into a lesson under `knowledge/lessons/`; require both inputs, choose the placement from the lesson context, enforce the domain rules in `AGENTS.md`, and validate the published content."
argument-hint: "<lesson-slug> <illustration-description>"
---

# Add Illustration

Generate exactly one raster illustration for one existing lesson in two language versions: English labels for the English source and Russian labels for its Russian translation. Save both next to the lesson and embed each where it best supports the text, at the same place in both files. The author decides what to show. You decide where it goes.

## Required arguments

Require the first argument after `$add-illustration` to be the lesson's exact frontmatter `slug`. Treat all remaining text as the required illustration description:

```text
$add-illustration <lesson-slug> <what the illustration should show>
```

Do not infer the lesson slug from conversation context, a lesson title, a course title, a directory name, or a file name. If either argument is missing, stop and ask the author to invoke the skill with both the lesson slug and the description before inspecting or editing course content.

The description may be written in any language. Everything you produce for the learner — alt text and any text inside the image — uses the language of the lesson file that embeds it.

This skill needs a native image generation capability in the host. If none is available, stop and say so. Do not substitute an image drawn with code (SVG, Mermaid, matplotlib, HTML screenshots): the author expects a generated illustration, and a substitute would silently change what they asked for.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md` completely and freshly. Treat its domain rules as authoritative, especially the lesson illustration rule, the B2 English rule, and the `Languages and translations` rules.
2. Inspect repository validation commands.
3. Preserve unrelated and pre-existing changes in the worktree.

## 2. Resolve the lesson

1. Validate that the lesson-slug argument is 1–64 characters composed of at least two lowercase kebab-case segments separated by single `/` characters.
2. Search lesson frontmatter and resolve the exact slug to exactly one `knowledge/lessons/<course-id>/<NN>-<lesson-id>.md` file. If it is invalid, absent, or does not resolve exactly once, stop and request a valid lesson slug; never guess.
3. Read the whole lesson, its `.ru.md` translation, and the parent course in `knowledge/courses/`. If the translation is missing, stop and report it; every lesson must have one. Note any illustrations the lesson already has in `knowledge/lessons/<course-id>/<lesson-id>/`, so the new one matches their style and does not repeat them.

## 3. Understand what to illustrate

Before generating anything, map the description onto the lesson:

- Identify the concept, flow, or structure the author wants to show and the passage that explains it.
- Take facts for the image from the lesson itself: component names, the order of steps, the direction of data flow, command names. Take Russian labels from the Russian translation. Each illustration must agree with the text that embeds it exactly. A picture that contradicts the prose is worse than no picture.
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

Derive a short file name from the description: lowercase kebab-case, 1–4 words, naming the subject (for example `event-history-replay`). Make it unique inside `knowledge/lessons/<course-id>/<lesson-id>/`. Do not ask the author for it. The Russian version uses the same name with a `.ru` suffix, for example `event-history-replay.ru.png`.

Write the image prompt yourself, in English, from the description and the lesson facts. Generate the English version first. Then generate the Russian version with the same composition, style, and palette, changing only the label language. Aim for this house style so illustrations across courses look like one family:

- A clean, flat explanatory illustration or diagram. No photorealism, 3D, heavy gradients, decorative scenes, mascots, logos, or brand marks.
- A calm, limited palette with one accent color and a plain, neutral background.
- Few words. Short labels only where they carry meaning, in the language of the version and spelled exactly as in the matching lesson file. Keep code identifiers and command names unchanged in both versions. Image models often misspell long text, so keep labels short and few.
- Landscape orientation (about 3:2 or 16:9). The lesson column is narrow, and a tall image pushes the text off screen.

After generation, look at each image carefully and check it against the matching lesson file:

- Every label is spelled correctly, is in the right language, and uses the lesson's terms.
- Steps, arrows, and relationships match the text.
- Nothing is invented, missing, or misleading.

- The Russian version shows the same content as the English version.

If an image fails a check, refine the prompt and generate it again. After three failed attempts for either version, stop, keep nothing in either lesson file, and report what went wrong.

Save the accepted images as `knowledge/lessons/<course-id>/<lesson-id>/<file-name>.<ext>` and `knowledge/lessons/<course-id>/<lesson-id>/<file-name>.ru.<ext>`, using the format the generator produced (PNG, JPEG, or WebP). Keep each source reasonable: if its longest side exceeds 2000 px, downscale it with `sips -Z 2000 <file>`. Astro converts it to WebP at build time, so do not re-encode it otherwise.

## 6. Embed the image

Insert each image as its own paragraph, with a blank line before and after, at the same place in both files. In the English source:

```markdown
![<English alt text>](./<lesson-id>/<file-name>.<ext>)
```

In the Russian translation:

```markdown
![<Russian alt text>](./<lesson-id>/<file-name>.ru.<ext>)
```

Write alt text that tells a reader who cannot see the image what it shows and what it means: one or two short, plain sentences in the language of the file, in the lesson's terms. The Russian alt text conveys the same meaning in natural Russian. Do not start with "Image of", "Diagram showing", or their Russian equivalents.

Leave the surrounding prose unchanged in both files. The lesson must still read correctly without the image, so do not add "see the image below" or make any sentence depend on it.

## 7. Verify the result

1. Re-read both lesson files around the image and confirm the placement still reads naturally and matches between them.
2. Confirm each image file exists at its referenced path and that no other file changed except the two lesson files and the two new images.
3. Run `pnpm run ci` when available; otherwise run the repository's content validation and build commands. Run `git diff --check` and inspect the final diff.
4. Do not stage or commit changes unless explicitly requested.

For a visual check in the browser, suggest `$review-lesson <lesson-slug>` to the author rather than running it yourself.

Report the lesson and translation paths, both image paths, where the image was placed and why, the alt text, the validation results, and any check that could not be completed.
