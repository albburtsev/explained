---
slug: git/submodules
title: Git Submodules
description: Embed one repository inside another with submodules, keep both updated, and decide when the extra machinery is worth it.
tags:
  - git
  - version-control
  - submodules
---

A project sometimes needs code that lives in another repository: a shared library, a plugin, or content maintained by a different team. Copying the files in loses their history and makes upstream updates painful to merge, while relying on an external install makes builds hard to reproduce. Git's answer is the `submodule`: an independent repository embedded as a subdirectory of your own repository, which is then called the `superproject`.

The superproject never tracks the submodule's files. It records two things instead: a `.gitmodules` file at the repository root that maps each submodule's path to its remote URL, and a `gitlink`, a special tree entry (mode `160000`) that pins the exact commit the submodule should be checked out at. Because both are committed like any other file, every clone of the superproject can rebuild the same combined tree.

## Add a submodule

Inside the superproject, run `git submodule add` with the repository URL and an optional target path:

```sh
git submodule add https://github.com/example/ui-kit.git libs/ui-kit
```

Git clones the repository into `libs/ui-kit` and stages the `.gitmodules` file and the gitlink for the next commit. The new `.gitmodules` section looks like this:

```ini
[submodule "libs/ui-kit"]
	path = libs/ui-kit
	url = https://github.com/example/ui-kit.git
```

Commit both entries to publish the submodule:

```sh
git commit -m "Add ui-kit submodule"
```

Choose a URL that everyone who clones the superproject can reach, because `.gitmodules` is where their Git will fetch from first. You can override the URL in your own clone with `git config submodule.libs/ui-kit.url <url>`.

## Clone a project with submodules

A plain clone of a superproject creates the submodule directories but leaves them empty. Initialize and populate them in one step:

```sh
git submodule update --init --recursive
```

`--init` registers each submodule's URL from `.gitmodules` in your local `.git/config`, `update` clones what is missing and checks out the pinned commit, and `--recursive` covers submodules nested inside submodules. To do all of this during the clone itself:

```sh
git clone --recurse-submodules https://github.com/example/main-project.git
```

## Update submodules

### Follow the superproject's pin

Pulling superproject changes fetches new pinned commits but leaves your submodule checkouts untouched, so `git status` reports the submodules as modified with "new commits". Bring them to the recorded state:

```sh
git pull
git submodule update --init --recursive
```

Keep `--init` even on routine updates in case the pull introduced a new submodule. Alternatively, pull with `git pull --recurse-submodules`, or set `git config submodule.recurse true` so commands such as pull and checkout recurse by default; `clone` is the exception and still needs its own flag.

### Move the pin to newer upstream work

The pinned commit only changes when you deliberately change it. To fetch the submodule's own upstream and move the checkout to the tip of its tracked branch:

```sh
git submodule update --remote libs/ui-kit
```

By default that is the remote's default branch. To track a different branch for every clone, record it in `.gitmodules`:

```sh
git submodule set-branch --branch stable libs/ui-kit
```

After the update, stage and commit the moved gitlink in the superproject; that commit is what locks collaborators onto the new submodule version. Leaving out the path updates every submodule at once.

### Work inside a submodule

Plain `git submodule update` checks out the pinned commit on a detached `HEAD`, with no branch tracking your work. Before editing inside a submodule, check out a branch, and ask updates to merge or rebase upstream work into it:

```sh
cd libs/ui-kit
git switch main
cd ../..
git submodule update --remote --merge
```

Push the submodule's commits before the superproject commit that references them, or collaborators cannot check out the pinned commit. Git can enforce the order for you:

```sh
git push --recurse-submodules=check      # fail if submodule commits are not pushed
git push --recurse-submodules=on-demand  # push submodules first, then the superproject
```

## Useful commands

```sh
git submodule status                   # pinned versus checked-out commit per submodule
git submodule summary                  # commits gained or lost relative to HEAD
git submodule foreach 'git status'     # run a command in every checked-out submodule
git submodule sync --recursive         # adopt changed URLs from .gitmodules
git submodule deinit -f libs/ui-kit    # unregister and empty one submodule locally
```

In `git submodule status` output, a leading `-` marks a submodule that is not initialized and `+` marks a checkout that no longer matches the pinned commit. Two settings make daily inspection easier: `git config diff.submodule log` lists submodule commits inside `git diff`, and `git config status.submodulesummary 1` appends a submodule summary to `git status`.

To remove a submodule from the project, run `git rm libs/ui-kit` and commit. This deletes the gitlink, its `.gitmodules` section, and the working tree, and it can be undone with `git revert`.

## When to use submodules, and when not to

Submodules earn their complexity when:

- You need another repository's tree inside yours at an exact, reproducible commit: vendored third-party code, a shared in-house library, or content with its own release cycle.
- You develop the dependency and the main project side by side and need to commit and push each on its own schedule.
- You split one logical project across repositories to control its size, fetch scope, or access rights.

Prefer something simpler when:

- A package manager such as npm or Maven can express the dependency; submodules redo that job with more manual steps.
- Your team will resent the overhead: empty directories after a plain clone, detached `HEAD` surprises, and stale checkouts after switching branches unless you pass `--recurse-submodules`.
- The dependency moves quickly and you do not want to review and commit every bump, because pinning a commit means updates are never automatic.

## Official resources

- [git-submodule manual](https://git-scm.com/docs/git-submodule)
- [gitsubmodules guide](https://git-scm.com/docs/gitsubmodules)
- [gitmodules file format](https://git-scm.com/docs/gitmodules)
- [Pro Git: Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

The next lesson, Git Worktrees, shows a lighter way to keep several working copies of a single repository checked out at once.
