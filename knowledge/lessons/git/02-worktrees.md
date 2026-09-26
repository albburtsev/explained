---
slug: git/worktrees
title: Git Worktrees
description: Check out several branches of one repository at once with worktrees, fix bugs without stashing, review branches in isolation, and learn where the limits are.
tags:
  - git
  - version-control
  - worktrees
---

Switching branches in the middle of unfinished work usually means stashing half-ready changes, committing work in progress, or keeping a second clone of the repository on disk. Git's built-in answer is the `worktree`: an additional working directory attached to the same repository, with its own branch checked out. The directory created by `git init` or `git clone` is the `main worktree`; every extra one created with `git worktree add` is a `linked worktree`.

All worktrees of a repository share one `.git` directory: the object database, configuration, and refs such as branches, tags, remotes, and the stash. A commit made in one worktree is immediately visible from every other, and creating a worktree never copies history, so it is far cheaper than a second clone. (The rare exceptions are per-worktree refs such as `refs/bisect`.) What stays private to each worktree is its `HEAD` (which branch or commit is checked out), its index (the staging area), and its working files. A linked worktree's top directory holds a small `.git` *file* instead of a `.git` directory; it points at the worktree's administrative files, which live under `.git/worktrees/<name>` in the main repository.

Because a branch's checked-out state is tied to one index and one working directory, Git refuses to check out the same branch in two worktrees at once. To look at a branch that is already checked out elsewhere, either detach with `-d` or override the safeguard with `--force`.

## Add a worktree

The classic use case is an urgent fix on another branch while your current work stays exactly where it is:

```sh
git worktree add -b hotfix-login ../hotfix-login main
```

This creates a new branch `hotfix-login` starting at `main` and checks it out into `../hotfix-login`. Commit and push the fix there; your original directory is never touched. To work on an existing branch instead, name it after the path:

```sh
git worktree add ../review-ui feature-ui
```

If `feature-ui` does not exist locally but exactly one remote has it, Git creates a local branch tracking the remote one, just as `git switch` would. Omit the branch entirely and Git names a new branch after the path's last component: `git worktree add ../experiments` creates branch `experiments` from `HEAD`. For a throwaway checkout tied to no branch at all, detach:

```sh
git worktree add -d ../scratch v2.4.1
```

## Inspect worktrees

```sh
git worktree list
```

```text
/home/alice/project       3f9a1c2 [main]
/home/alice/hotfix-login  8b4e07d [hotfix-login]
/home/alice/scratch       3f9a1c2 (detached HEAD)
```

The main worktree is listed first, followed by each linked worktree with its commit and branch. Locked and prunable worktrees are annotated, and `--verbose` explains why; `--porcelain` gives a stable, script-friendly format.

## Move, remove, and prune

```sh
git worktree move ../scratch ../spikes/scratch   # relocate a worktree
git worktree remove ../hotfix-login              # delete it and its administrative files
```

`remove` accepts only a clean worktree — no modified tracked files and no untracked files — so commit, stash, or discard first, or pass `--force`. The main worktree cannot be moved or removed, and a worktree containing submodules cannot be moved. If you relocate a worktree by hand instead of with `git worktree move`, run `git worktree repair` from either side to reconnect it.

If you delete a worktree's directory yourself with `rm -rf`, its administrative entry under `.git/worktrees` lingers. Clean those entries up with:

```sh
git worktree prune -n -v   # show which stale entries would be removed
git worktree prune         # remove them
```

`prune` only touches entries whose working directory is already gone. When `git gc` runs it automatically, entries younger than three months are spared by default; tune that grace period with `gc.worktreePruneExpire`, or pass `--expire <time>` when pruning by hand.

## Lock a worktree

A worktree on a portable drive or network share looks missing whenever the device is unmounted, which makes it a candidate for pruning. Protect it with a lock:

```sh
git worktree lock --reason "lives on a USB drive" ../backup
git worktree unlock ../backup
```

A locked worktree is never pruned and cannot be moved or removed until it is unlocked; `git worktree list` marks it, and `--verbose` shows the reason.

## When to use worktrees, and when not to

Worktrees earn their place when:

- An urgent fix or review interrupts a messy in-progress tree, and stashing it risks losing track of moved, renamed, and untracked files.
- You review a colleague's branch or run its test suite without disturbing your own checkout.
- A long build or test run must keep going on one branch while you continue working on another.
- You want to compare two branches side by side, or keep a stable checkout of a release for support work.

Prefer something simpler when:

- The job takes two minutes: `git switch` or `git stash` involves less machinery than creating and later removing a worktree.
- Every checkout needs heavy generated content such as `node_modules` or build artifacts; those are not shared, so each worktree pays the full install and build cost in time and disk. Untracked files like `.env` must be copied by hand too.
- Your tooling assumes `.git` is a directory, because a linked worktree has a `.git` file instead.
- Your repository uses submodules: the manual still marks multiple checkouts as experimental and their submodule support as incomplete, so avoid running several worktrees of one superproject.

Worktrees pile up quietly, so close them with `git worktree remove` when the task is done and let `git worktree list` be your periodic audit.

## Official resources

- [git-worktree manual](https://git-scm.com/docs/git-worktree)
- [gitrepository-layout: where worktree metadata lives](https://git-scm.com/docs/gitrepository-layout)

Together with the previous lesson — submodules combine several repositories into one checkout, worktrees spread one repository across several checkouts — this completes the course's toolkit for working beyond a single branch in a single directory.
