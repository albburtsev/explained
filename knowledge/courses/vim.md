---
slug: vim
title: Vim
description: Get started with Vim, the ubiquitous modal text editor, from its modes and essential keyboard shortcuts to a basic configuration.
tags:
  - vim
  - text-editor
  - terminal
lessons:
  - vim/modes
  - vim/hotkeys
  - vim/configuration
---

`Vim` is a highly configurable, `modal` text editor built to make creating and changing any kind of text very efficient. It is included as `vi` on most Unix systems and macOS, so it is available almost everywhere a terminal is. The current stable version is Vim 9.2. This course introduces the editor and then builds the practical skills needed to edit files with confidence.

## Install Vim

You may already have Vim. Check with:

```sh
vim --version
```

If you need to install or upgrade it, pick the line for your system:

- **macOS**: a terminal version is preinstalled as `vi`; install the latest release with [Homebrew](https://formulae.brew.sh/formula/vim): `brew install vim`
- **Debian/Ubuntu Linux**: `sudo apt install vim`
- **Windows**: use the signed installer from the [vim-win32-installer releases](https://github.com/vim/vim-win32-installer/releases) or run `winget install vim.vim`

## Official resources

- [Vim website](https://www.vim.org/)
- [Download Vim](https://www.vim.org/download.php)
- [Vim documentation](https://www.vim.org/docs.php)
- [Vim on GitHub](https://github.com/vim/vim)

## What you will learn

- How Vim's modes work and how to switch between them.
- The essential keyboard shortcuts for moving around, editing, and saving files.
- How to shape the editor's behavior with a basic `vimrc` configuration.
