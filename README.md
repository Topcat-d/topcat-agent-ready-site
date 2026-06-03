# Agent Ready Site

Generate AI-readable website files from a URL or saved HTML.

This project starts with the simplest useful wedge: a downloadable CLI agent that inspects website HTML and suggests files a site owner can publish so LLMs understand the business better:

- `llms.txt`
- `llms-full.txt`
- `ai.json`
- `ai.html`
- `ai-audit.md`
- `owner-questions.md`

## Why CLI First

The first product should be an agent people can download and run, not a hook buried inside one website builder.

Hooks and skills are still important, but they are distribution layers. The CLI is the core engine. Once the CLI works, it can be called from:

- Codex or AI-builder skills
- AI website builders
- GitHub Actions
- Vercel or Netlify build hooks
- local dev scripts
- CMS plugins

## Install

```bash
npm install
```

## Run

Generate owner-review files from a live URL:

```bash
npm start -- https://example.com
```

Generate owner-review files from saved HTML copied/exported from the browser dev panel:

```bash
npm start -- ./homepage.html --site-url https://example.com --out ./agent-ready
```

Inspect a site as an agent user and check `/llms.txt` first:

```bash
npm start -- inspect https://example.com --out ./agent-context
```

Or after global installation:

```bash
agent-ready-site https://example.com --out ./agent-ready
agent-ready-site inspect https://example.com --out ./agent-context
```

## Output

The command writes:

```text
agent-ready/
  ai.html
  ai.json
  ai-audit.md
  llms-full.txt
  llms.txt
  owner-questions.md
```

Agent-side inspect mode writes:

```text
agent-context/
  agent-context.json
  agent-context.md
```

If `/llms.txt` exists, inspect mode uses it as first context and reads `/llms-full.txt` only when available. If `/llms.txt` is missing, it reports `no_llms_txt_found` and falls back to homepage/sitemap inspection.

## Current Scope

This first version uses deterministic extraction only. It fetches the homepage or reads saved HTML, then extracts:

- title
- meta description
- Open Graph title/description
- headings
- links
- JSON-LD blocks
- detected email addresses
- detected phone numbers
- likely audience and offer signals
- HTML gaps that block LLM comprehension
- common sensitive signals that should not be surfaced

## Safety Model

Generated files are recommendations, not automatic publishing decisions.

Publishable candidates:

- `llms.txt`
- `llms-full.txt`

Private review artifacts:

- `ai-audit.md`
- `owner-questions.md`
- `ai.json`
- `ai.html`

The agent writes `owner-questions.md` so the website owner can confirm:

- what business facts should be surfaced
- what offers and contact paths should be highlighted
- what should never appear in LLM-facing files
- whether pricing, regulated claims, private customer details, staff details, or internal links should be excluded

The CLI also performs deterministic checks for common sensitive signals such as private keys, API keys, bearer tokens, password-like values, credit-card-like numbers, SSN-like numbers, internal hosts, and admin paths. When detected, the output is marked `review_required` and risky text is redacted from generated samples.

Raw phone numbers and email addresses are redacted from generated files by default. The generated output may say that a contact method exists, but it should point users to public contact or booking pages instead of copying contact values into LLM-facing files.

The next step is adding an optional LLM pass that turns the raw extraction into stronger answers for:

- what the site does
- who it serves
- offers
- pricing
- proof
- missing information
- agent comprehension score

## Product Direction

Ship the CLI first. Add a Codex/AI-builder skill wrapper after the file contract is stable.

Recommended integration order:

1. CLI agent
2. Codex skill wrapper
3. GitHub Action
4. Vercel/Netlify build hook
5. Next.js/Astro/Vite plugin
6. CMS plugins

See [docs/integration-hooks.md](docs/integration-hooks.md).
