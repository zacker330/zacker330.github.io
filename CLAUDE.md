# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A personal [Hugo](https://gohugo.io/) blog (翟志军 Jack Zhai, "Everything as Code"). Despite the repo name `zacker330.github.io`, the site is served at `baseURL = "https://showme.codes"` (see [config.toml](config.toml)). Content is mostly DevOps/software-engineering posts, written in both Chinese and English.

Requires the **extended** Hugo (`min_version = 0.59.0`; developed against `v0.134.1+extended`). The extended build is needed because the `insertFigure` shortcode uses image processing (`Fit`/`Fill`/`Resize`).

## Commands

```bash
hugo server -D        # local dev server with drafts (new posts default to draft: true)
hugo server           # local dev, published content only
hugo                  # build static site into ./public (gitignored)
hugo new content/en/YYYY-MM-DD-slug.md   # scaffold a post from archetypes/default.md
```

There is no test/lint suite — this is a content site. There is no CI workflow in this repo; deployment happens outside it.

## Structure & conventions

- **Posts live in `content/en/` and `content/zh-cn/`**, not in a Hugo multilingual setup. `config.toml` has no `[languages]` block; instead the two languages are plain content sections linked from `[[menu.main]]`. So a post is "Chinese" or "English" purely by which folder it sits in. The Chinese section (`content/zh-cn/`, ~118 posts) is the primary body of work; `content/en/` is small (~3 posts).
- **Filename convention is `YYYY-MM-DD-slug.md`** (or `YYYY-M-D-slug.md` in older files). The archetype scaffolds `title`, `date`, `draft: true`.
- **Front matter** uses `tags: [...]` for taxonomy (`tag` and `category` taxonomies are defined in config.toml). Existing posts also carry a legacy `layout: post` and `Description:` field — harmless, Hugo ignores `layout` here.
- **`content/about-me/index.md`** backs the `/about-me` menu entry.

## Theme

Uses the vendored `diary` theme in [themes/diary/](themes/diary/) (a copy of `amazingrise/hugo-theme-diary`, **not** a git submodule — it's committed directly into this repo). Edit theme files there if you need template changes, but prefer the project-level override mechanism:

- **Project layouts override theme layouts.** [layouts/partials/extended_head.html](layouts/partials/extended_head.html) overrides the theme's same-named partial and is the intended hook for adding custom `<head>` scripts/tags. To override any other template, create the matching path under the top-level `layouts/` rather than editing `themes/diary/`.
- The `insertFigure` shortcode (`{{< insertFigure img="..." command="Fit|Fill|Resize|Original" options="..." caption="..." align="..." >}}`) expects the image to be a page resource of the post.

## Things to know

- `config.toml` contains placeholder values for comment systems (Gitalk/Giscus/Utterances are all disabled or stubbed) and Open Graph (`title = "My Blog"`, empty `description`). Don't treat these as live config.
- `static/` is copied verbatim to the site root (e.g. `static/ads.txt`); `assets/` holds files processed by Hugo Pipes.
