---
name: agent-ready-site
description: Generate owner-reviewed llms.txt files and inspect websites by checking /llms.txt before broad crawling.
---

# Agent Ready Site

Use this skill for two workflows:

1. Website owners who want draft `llms.txt` and `llms-full.txt` files.
2. Agent users who want website inspection to check `/llms.txt` first.

## Owner Workflow

When the user owns or is building the website:

1. Run the CLI against the URL or saved HTML.
2. Review `owner-questions.md`.
3. Treat `ai-audit.md`, `owner-questions.md`, `ai.json`, and `ai.html` as private review artifacts.
4. Treat only `llms.txt` and `llms-full.txt` as publishable candidates.
5. Do not publish anything automatically.

Commands:

```bash
node ./src/index.js https://example.com --out ./agent-ready
node ./src/index.js ./homepage.html --site-url https://example.com --out ./agent-ready
```

## Agent User Workflow

When the user asks you to inspect, summarize, compare, or understand a website:

1. Run inspect mode before broad crawling.
2. If `agent-context.json` reports `ai_readable_context_found`, use `agent-context.md` as first context.
3. If it reports `no_llms_txt_found`, say: "No `llms.txt` found. Falling back to homepage/sitemap inspection."
4. Prefer linked public pages over broad crawling.
5. Report whether the path was `llms-first` or `fallback`.

Command:

```bash
node ./src/index.js inspect https://example.com --out ./agent-context
```

## Safety

Do not surface secrets, credentials, customer data, private stories, raw phone numbers, raw email addresses, internal/admin URLs, draft pages, non-public pricing, unsupported claims, or regulated advice unless the owner explicitly approves the exact wording.
