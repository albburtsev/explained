---
slug: git/reflog
title: Git Reflog
description: Find earlier branch positions in Git's local reference logs and recover commits after a reset, rebase, amend, or branch deletion.
tags:
  - git
  - version-control
  - recovery
  - reflog
---

Normal `git log` follows commits that are reachable from the branch you ask it to inspect. After a hard reset, rebase, amended commit, or deleted branch, valuable commits can disappear from that history even though their objects still exist. A `reflog`, short for reference log, records the recent values of movable Git references in one local repository. It gives you another way to find those commits before Git eventually removes them.

Each local branch can have its own reflog. `HEAD` has one too, and it records commits as well as actions that move you between branches. Reflogs are local bookkeeping: they are not committed, pushed, or copied when someone clones the repository. Your reflog therefore describes what happened in your clone, not what happened in a teammate's clone or on a hosting service.

## Read the reflog

Run the command without a subcommand to show the `HEAD` reflog:

```sh
git reflog
```

`show` is the explicit form of the same operation:

```sh
git reflog show HEAD
git reflog show main --date=local
```

A shortened example after an accidental reset might look like this:

```text
51a62bd HEAD@{0}: reset: moving to HEAD~2
8db42f1 HEAD@{1}: commit: Validate payment details
d3a710c HEAD@{2}: commit: Add checkout form
51a62bd HEAD@{3}: commit: Create product page
```

The hash on each line is the value the reference had after that recorded action. Here `HEAD@{0}` is the current position after the reset, while `HEAD@{1}` is the commit at the old tip. The message explains which operation moved the reference.

Reflog selectors work anywhere Git accepts a revision:

```sh
git show HEAD@{1}               # the previous value of HEAD
git show main@{2}               # the second prior value of main
git show 'main@{yesterday}'     # where local main pointed yesterday
git switch @{-1}                # the previously checked-out branch or commit
```

The number counts reference updates, not commits, and a date selector asks where that local reference pointed at the requested time. Because new actions can add entries and change the ordinal numbers, copy the commit hash once you identify the right entry.

## Recover safely

When a commit appears to be lost, avoid maintenance commands such as `git gc` and `git reflog expire`. Then use a temporary branch to make the candidate commit reachable again before changing your current branch:

```sh
git reflog --date=local
git show --stat 8db42f1
git branch rescue-before-reset 8db42f1
git log --oneline --decorate rescue-before-reset
```

Creating the rescue branch does not alter your working tree. Once you verify the recovered history, you can cherry-pick a commit, merge the rescue branch, or deliberately move another branch to it. Delete the rescue branch only after the wanted work has a permanent home.

To put the current branch exactly at the recovered commit, first make sure its present state is backed up and the working tree contains nothing you need, then run:

```sh
git reset --hard 8db42f1
```

`--hard` overwrites tracked working-tree changes. Reflog can recover committed objects that remain in the repository, but it does not preserve arbitrary uncommitted edits destroyed by a reset, checkout, or clean operation.

## Common recovery scenarios

### Undo an unwanted reset

A reset moves the current branch and records both the old and new positions. Find the entry immediately before the reset, inspect it, and anchor it with a rescue branch:

```sh
git reflog
git show 8db42f1
git branch rescue-before-reset 8db42f1
```

Replace the sample hash with the old tip shown by your own reflog. Do not assume it will always be `HEAD@{1}`: other reference updates may have happened since the reset.

### Recover from a rebase or amend

Rebase and `git commit --amend` replace commits with new ones, but the branch reflog normally retains its earlier tip:

```sh
git reflog show feature --date=local
git branch feature-before-rewrite 8db42f1
git log --oneline --graph --decorate --all
```

Replace the sample hash with the pre-rewrite tip. Keeping both tips on named branches lets you compare them before deciding whether to reset, cherry-pick selected commits, or keep the rewritten history.

### Recreate a deleted branch

Deleting a branch also removes that branch's own reflog. If you previously checked it out, the `HEAD` reflog can still contain its last commit:

```sh
git reflog show HEAD
git branch restored-feature 8db42f1
```

Replace the sample hash with the deleted branch's last commit. `git reflog --all` broadens the search to available reflogs. Recovery is not guaranteed if no remaining reflog recorded the commit or if its object has already been pruned.

### Restore one file instead of a branch

Once the reflog reveals the needed commit, restore only the file you lost:

```sh
git restore --source=8db42f1 -- path/to/file
git diff -- path/to/file
```

Replace the sample hash with the recovered commit. The restored content remains an uncommitted working-tree change so you can review it normally.

## Know the subcommands

Three subcommands are useful for inspection:

- `git reflog show [<ref>]` displays one reflog and is the default when `show` is omitted. It accepts `git log` options such as `--date`, `--since`, and `--grep-reflog`.
- `git reflog list` lists the references that currently have reflogs.
- `git reflog exists <ref>` returns a successful exit status when the fully qualified reference has a reflog, which is useful in scripts: `git reflog exists refs/heads/main`.

The remaining subcommands modify reflog data and are mainly for repository maintenance:

- `git reflog expire` removes entries according to age and reachability rules. Preview with `git reflog expire --dry-run --all` before pruning anything manually.
- `git reflog delete <ref>@{<specifier>}` removes selected entries. It also supports `--dry-run`.
- `git reflog drop <ref>` removes an entire reflog. Unlike `delete` and `expire`, it has no dry-run mode.
- `git reflog write <ref> <old-oid> <new-oid> <message>` appends a low-level entry using a fully qualified reference and complete object IDs. It is available in Git 2.51.1 and later and is rarely needed in everyday work.

Do not use the modifying subcommands as the first step in a recovery: they can remove the very evidence and object protection you need.

## Understand the limits

Reflogs are temporary. By default, Git's maintenance rules expire entries after 90 days, with unreachable entries eligible for earlier expiration after 30 days, though repository configuration can change both periods. Once an entry expires and no branch, tag, or other reference keeps its objects reachable, later garbage collection may delete them. Recover important work promptly.

In a repository with linked worktrees, begin in the worktree where the mistake happened because each worktree has its own `HEAD` and checkout history. Branch reflogs still help when a shared branch reference moved.

Treat reflog as a local safety net, not as a backup: it is excellent for recovering recent committed work in your own clone, but a remote branch, tag, pushed commit, or external backup is the durable way to preserve work.

## Official resources

- [git-reflog manual](https://git-scm.com/docs/git-reflog)
- [gitrevisions: reflog selectors](https://git-scm.com/docs/gitrevisions)
- [Pro Git: Revision Selection](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection)
- [Pro Git: Maintenance and Data Recovery](https://git-scm.com/book/en/v2/Git-Internals-Maintenance-and-Data-Recovery)
