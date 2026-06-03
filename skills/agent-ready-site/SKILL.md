---
name: agent-ready-site
description: Inspect a website URL or saved HTML and generate suggested llms.txt, llms-full.txt, ai.json, and ai.html files.
origin: project
---

# Agent Ready Site

Use this skill when a user wants to improve how LLMs understand a website, or when an agent should inspect a website by checking `/llms.txt` first.

For platform-specific wrappers, see:

- `integrations/claude-code/SKILL.md`
- `integrations/codex/SKILL.md`
- `integrations/cursor/agent-ready-site.mdc`

## Inputs

Accept either:

- a public website URL
- a saved HTML file from the browser/dev panel plus the real site URL

## Owner Workflow

1. Run the project CLI against the URL or HTML file.
2. Review the generated `llms.txt`, `llms-full.txt`, `ai-audit.md`, `ai.json`, and `ai.html`.
3. Ask the owner to answer or review `owner-questions.md`.
4. Explain the highest-impact HTML gaps: title, meta description, H1, service copy, audience copy, contact text, links, and schema.
5. If the website source is available, offer to patch the source so the site itself is easier for LLMs to understand.

## Agent User Workflow

When the task is to inspect, summarize, or understand a website:

1. Run inspect mode before broad crawling.
2. If `/llms.txt` exists, use it as first context.
3. If `/llms-full.txt` exists, use it only when more detail is needed.
4. If `/llms.txt` is missing, say: "No `llms.txt` found. Falling back to homepage/sitemap inspection."
5. Prefer linked public pages over broad crawling.
6. Report which source path was used: `llms-first` or `fallback`.

## Commands

For a live URL:

```bash
node ./src/index.js https://example.com --out ./agent-ready
```

For saved HTML:

```bash
node ./src/index.js ./homepage.html --site-url https://example.com --out ./agent-ready
```

For agent-side inspection:

```bash
node ./src/index.js inspect https://example.com --out ./agent-context
```

## Output Standard

Keep the generated files owner-reviewable. Do not present generated claims as fact unless they are supported by visible HTML, metadata, links, or schema.

Only `llms.txt` and `llms-full.txt` are publishable candidates by default. Treat `ai-audit.md`, `owner-questions.md`, `ai.json`, and `ai.html` as private review artifacts unless the owner explicitly approves them.

## Safety Rules

Never auto-publish generated files. Require owner review when `audit.safety.status` is `review_required`.

Do not include secrets, credentials, customer data, private stories, raw phone numbers, raw email addresses, internal/admin URLs, draft pages, non-public pricing, unsupported claims, or regulated advice unless the owner explicitly approves the exact wording.

Prefer public page links such as contact, booking, services, blog, about, and FAQ pages over copying contact values into generated text.
