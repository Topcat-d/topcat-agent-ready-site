# Integration Hooks

## Decision

Start with a downloadable CLI agent, then expose thin skill/rule wrappers and hooks around it.

The agent is the product core because it can inspect live HTML or saved browser/dev-panel HTML. Skills and hooks are adapters that run the same engine automatically.

## Recommended Shape

```text
agent-ready-site https://example.com --out public
agent-ready-site ./homepage.html --site-url https://example.com --out public
agent-ready-site inspect https://example.com --out agent-context
```

That command should be callable from any environment.

## Hook Targets

### Claude Code / Codex / Cursor

Agent wrappers should be thin:

1. Ask for a URL or saved HTML path.
2. Run the CLI in generate mode for website owners, or inspect mode for agent users.
3. Show the generated `llms.txt`, `llms-full.txt`, and HTML gap report.
4. Optionally patch the user's website source to improve title, description, H1, schema, contact text, and service pages.

The wrapper should not reimplement extraction logic.

For agent users, inspect mode should run before broad crawling. If `agent-context.json` reports `ai_readable_context_found`, use that context first. If it reports `no_llms_txt_found`, fall back to homepage/sitemap inspection and say so.

Templates:

- Claude Code: `integrations/claude-code/SKILL.md`
- Codex: `integrations/codex/SKILL.md`
- Cursor: `integrations/cursor/agent-ready-site.mdc`

### AI Website Builders

When a user asks an AI website builder to improve LLM visibility for a new website, the builder should call:

```bash
agent-ready-site http://localhost:3000 --out ./public
```

The generated site should ship with:

- `/llms.txt`
- `/llms-full.txt`
- `/ai.json`
- `/ai.html`

### GitHub Action

Run after deployment preview is available:

```yaml
name: Generate agent-ready files
on:
  workflow_dispatch:

jobs:
  agent-ready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx agent-ready-site "$SITE_URL" --out ./public
```

### Vercel / Netlify

Run during build after the static site has been generated, or against a preview URL after deploy.

### Framework Plugins

Framework plugins should be thin wrappers:

- discover local URL or content directory
- call the CLI engine
- write files to the public output directory

## Minimal Contract

Every adapter should produce the same files:

```text
/llms.txt
/llms-full.txt
/ai-audit.md
/ai.json
/ai.html
/owner-questions.md
```

## Safety Guardrails

Adapters should never auto-publish generated files without owner review.

The expected flow is:

1. Generate files.
2. Show `owner-questions.md`.
3. Flag `audit.safety.status`.
4. Require review before copying publishable files into a public web root.

Only `llms.txt` and `llms-full.txt` are publishable candidates by default. Treat `ai-audit.md`, `owner-questions.md`, `ai.json`, and `ai.html` as private review artifacts unless the owner explicitly approves them.

Do not surface:

- secrets, tokens, passwords, or private keys
- customer data or private stories
- non-public pricing
- raw phone numbers or email addresses
- internal/admin URLs
- draft pages
- regulated advice that has not been approved
- staff details the owner does not want public
- claims not supported by visible site content or owner answers

Prefer links to public contact, booking, store, services, blog, about, and FAQ pages over copying contact values into generated text.

For the owner-facing publishing convention, see `docs/owner-llms-convention.md`.

## Later

After the static files work, add an optional LLM rewrite pass:

```text
agent-ready-site https://example.com --rewrite-with-llm
```

That pass can turn rough HTML extraction into better owner-reviewed language.
