---
slug: tmux/orca-browser-and-design-mode
title: Browser and Design Mode
description: Open a worktree's dev server in Orca's built-in browser next to the agent, and use Design Mode to send a UI element straight into the agent's prompt.
tags:
  - orca
  - coding-agents
  - browser
  - design-mode
---

UI work needs a running app in front of you. In Orca you do not have to switch to a separate browser for that. Each worktree has its own browser, so the page and the agent that changes it sit side by side. Design Mode then lets you point at a broken element instead of describing it in words.

## The per-worktree browser

Orca's `per-worktree browser` is a real Chromium browser inside an Orca tab. It has an address bar, history, and devtools. Its tabs belong to one worktree. When you switch to another worktree, Orca restores that worktree's browser tabs and scroll positions.

This keeps parallel work apart. One agent can fix the header in one worktree while you check a different branch of the app in another. Each worktree shows only its own pages.

## Open the dev server next to the agent

Start your project's dev server in a terminal tab of the worktree, for example:

```sh
npm run dev
```

The server prints a local address, such as `http://localhost:3000`. Click that link in the terminal. A small popover opens. Choose **Orca Browser** to open the page in this worktree's browser. Cmd-click skips the popover and opens the link directly. Under **Settings → Browser → Link Routing**, you choose whether that direct open uses Orca's browser or the system browser.

You can also click **+** in the tab strip and type the address there.

Now put the page next to the agent. Drag the browser tab to the right edge of the agent's pane. Orca splits the pane: the agent terminal stays on the left, and the browser opens on the right.

![Claude Code runs in a terminal on the left. The same worktree's built-in browser shows a web page on the right.](./orca-browser-and-design-mode/browser-next-to-agent.jpg)

A few browser keys help during UI work:

| Action | Key |
| --- | --- |
| Open a new tab in this worktree | `Cmd-T` |
| Reopen the last closed tab | `Cmd-Shift-T` |
| Find in the page | `Cmd-F` |

Right-click the reload button to choose **Hard Reload**. It bypasses the cache, which helps when you change local frontend files. To test a responsive layout, set a custom viewport size on a browser tab instead of resizing the whole pane.

## Point at an element with Design Mode

`Design Mode` turns the browser into a pointer-to-code tool. Click the **Design Mode** toggle in the browser toolbar. Your cursor becomes a picker. When you hover over the page, Orca highlights the element under the cursor.

![Design Mode is on in the built-in browser. The page heading is highlighted, and a label above it names the element.](./orca-browser-and-design-mode/design-mode-picker.png)

Click an element to capture it. Orca collects:

- the element's HTML, with a small part of the HTML around it;
- its computed CSS, such as colors, fonts, and spacing;
- a cropped screenshot of the element;
- the source file and line, when a dev-mode source map is available.

Orca sends all of this to the active agent terminal as one attachment. You then type what you want to change. The agent gets the same context a human reviewer would want, so you do not need to take a screenshot or copy a CSS selector.

To collect several notes before you send anything, use the annotation tray. Hover over a note and choose **Edit** to change it. After Orca delivers the prompt, it removes the notes it sent.

## Fix a small UI bug

Suppose a button on your page has padding that is too tight. Run the agent in the worktree and open the page in the browser beside it. Then follow this loop:

1. Go to the page with the bug in the worktree's browser.
2. Turn on Design Mode.
3. Click the broken button. It lands in the agent terminal as an attachment.
4. Type the change, for example: "This padding is too tight. Increase it to match the cards above."
5. Wait while the agent edits the source. When your dev server supports hot reload, the page refreshes on its own.
6. Click the button again to check the result. If it is still wrong, describe what is left and repeat.
7. When the button looks right, review the diff and commit.

The whole loop stays in one window: the page, the element, the agent, and the change.

## Use a profile when the page needs a login

Some pages appear only after you sign in. A `browser-use profile` gives the browser its own identity: cookies, local storage, and cache. Profiles do not share this data with each other.

Create one under **Settings → Browser → Profiles** with **Add profile**. Then pick it from the browser toolbar. You can import cookies from Chrome or Edge into a profile. Google logins are not imported, so sign in to Google directly in Orca.

## Official resources

- [Per-worktree browser](https://www.onorca.dev/docs/browser/overview)
- [Design Mode](https://www.onorca.dev/docs/browser/design-mode)
- [Fix a UI bug with Design Mode](https://www.onorca.dev/docs/recipes/design-mode-fix)
- [Browser-use profiles](https://www.onorca.dev/docs/browser/profiles)
- [Tabs, panes, and split layouts](https://www.onorca.dev/docs/model/tabs-panes-splits)
