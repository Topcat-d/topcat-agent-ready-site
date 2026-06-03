---
name: agent-ready-site
description: Generate owner-reviewed llms.txt files and inspect websites by checking /llms.txt before broad crawling.
origin: project
---

# Agent Ready Site

Use this skill when a user wants to improve how LLMs understand a website, or when an agent should inspect a website by checking `/llms.txt` first.

## Owner Workflow

1. Run the CLI against a public URL or saved HTML.
2. Ask the owner to review `owner-questions.md`.
3. Keep `ai-audit.md`, `owner-questions.md`, `ai.json`, and `ai.html` private by default.
4. Treat `llms.txt` and `llms-full.txt` as the only publishable candidates.
5. Never auto-publish generated files.

```bash
node ./src/index.js https://example.com --out ./agent-ready
node ./src/index.js ./homepage.html --site-url https://example.com --out ./agent-ready
```

## Agent User Workflow

Before broad crawling when inspecting a website:

1. Run inspect mode.
2. Use `agent-context.md` first if `agent-context.json` reports `ai_readable_context_found`.
3. If no `llms.txt` exists, tell the user and fall back to homepage/sitemap inspection.
4. Prefer public links from `/llms.txt` over searching the whole site.

```bash
node ./src/index.js inspect https://example.com --out ./agent-context
```

## Safety Rules

Do not include secrets, credentials, customer data, private stories, raw phone numbers, raw email addresses, internal/admin URLs, draft pages, non-public pricing, unsupported claims, or regulated advice unless the owner explicitly approves the exact wording.
