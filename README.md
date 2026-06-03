# Agent Ready Site

CLI and skill workflow for `llms.txt` generation, safety review, and agent-side first-read website context.

Inspired by the emerging [`llms.txt`](https://www.crawloria.com/blog/llms-txt-explainer) convention: a Markdown file at a site root that gives retrieval-mode LLMs a curated map of important pages.

## What It Does

Agent Ready Site has two tight workflows.

For **website owners**, it inspects a live URL or saved HTML and generates owner-review files:

- `llms.txt`
- `llms-full.txt`
- `ai-audit.md`
- `owner-questions.md`
- `ai.json`
- `ai.html`

For **agent users**, it checks a website for `/llms.txt` before broad crawling:

- if `/llms.txt` exists, use it as first context
- if `/llms-full.txt` exists, use it only when more detail is needed
- if `/llms.txt` is missing, fall back to homepage/sitemap inspection and report that path

The project does not claim that major AI search providers automatically consume `llms.txt`. It focuses on agents you control: Claude Code, Codex, Cursor, AI-builder workflows, and custom retrieval pipelines.

## Why This Exists

Most websites are written for humans and search engines, not retrieval-mode agents. An agent trying to understand a site may waste tokens on nav, footers, scripts, vague hero copy, or irrelevant pages.

`llms.txt` gives controlled agents a compact first-read path:

```text
/llms.txt       compact public map of important pages
/llms-full.txt  expanded public context, still owner-reviewed
```

The private audit files help the owner decide what should and should not be surfaced before anything is published.

## Install

```bash
npm install
```

Node.js 18+ is required.

## Website Owner Usage

Generate owner-review files from a live URL:

```bash
npm start -- https://example.com
```

Generate owner-review files from saved HTML copied/exported from the browser dev panel:

```bash
npm start -- ./homepage.html --site-url https://example.com --out ./agent-ready
```

After global installation:

```bash
agent-ready-site https://example.com --out ./agent-ready
```

Owner output:

```text
agent-ready/
  ai-audit.md
  ai.html
  ai.json
  llms-full.txt
  llms.txt
  owner-questions.md
```

Publishable candidates:

- `llms.txt`
- `llms-full.txt`

Private review artifacts by default:

- `ai-audit.md`
- `owner-questions.md`
- `ai.json`
- `ai.html`

## Agent User Usage

Inspect a site and check `/llms.txt` first:

```bash
npm start -- inspect https://example.com --out ./agent-context
```

After global installation:

```bash
agent-ready-site inspect https://example.com --out ./agent-context
```

Agent-side output:

```text
agent-context/
  agent-context.json
  agent-context.md
```

If `/llms.txt` exists, inspect mode writes `ai_readable_context_found` and includes the file as first context. If `/llms.txt` is missing, it writes `no_llms_txt_found` and falls back to homepage/sitemap inspection.

## Safety Model

Generated files are recommendations, not automatic publishing decisions.

The CLI performs deterministic checks for common sensitive signals:

- private keys
- API keys
- bearer tokens
- password-like values
- credit-card-like numbers
- SSN-like numbers
- internal hosts
- admin paths

When high-risk content is detected, the output is marked `review_required`.

Raw phone numbers and email addresses are redacted from generated files by default. The generated output may say that a contact method exists, but it should point users to public contact or booking pages instead of copying contact values into LLM-facing files.

Do not publish:

- secrets, tokens, credentials, or private keys
- customer data or private stories
- raw phone numbers or raw emails
- internal/admin URLs
- draft pages
- non-public pricing
- unsupported claims
- regulated advice that has not been approved
- stale services, pricing, policies, or product claims

## Integrations

The CLI is the core engine. Agent wrappers should call the CLI instead of reimplementing extraction logic.

Included templates:

- [Claude Code skill](integrations/claude-code/SKILL.md)
- [Codex skill](integrations/codex/SKILL.md)
- [Cursor rule](integrations/cursor/agent-ready-site.mdc)

Shared command shape:

```bash
agent-ready-site https://example.com --out ./agent-ready
agent-ready-site inspect https://example.com --out ./agent-context
```

## Owner Convention

For the website-owner publishing convention, see [docs/owner-llms-convention.md](docs/owner-llms-convention.md).

A reusable starter template lives at [templates/llms.txt.md](templates/llms.txt.md).

## A/B Testing

The controlled-agent claim should be tested. See [docs/ab-testing.md](docs/ab-testing.md) for the recommended test arms, prompts, and metrics.

## Current Scope

This first version uses deterministic extraction only. It fetches the homepage or reads saved HTML, then extracts:

- title
- meta description
- Open Graph title/description
- headings
- links
- JSON-LD blocks
- contact presence signals with values redacted
- likely audience and offer signals
- HTML gaps that block LLM comprehension
- common sensitive signals that should not be surfaced

## Test

```bash
npm run check
```

## Roadmap

- Add fixture-based tests for clean, missing, and sensitive HTML.
- Run A/B tests across 10-20 real websites.
- Add optional owner-answer ingestion.
- Add optional LLM rewrite pass for owner-approved language.
- Add GitHub Action and framework plugin wrappers.
