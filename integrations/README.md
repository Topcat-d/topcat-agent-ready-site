# Agent Integrations

This project supports two workflows:

- **Website owners**: generate draft `llms.txt` and `llms-full.txt`, then review private audit artifacts before publishing.
- **Agent users**: inspect websites by checking `/llms.txt` first before broad crawling.

## Claude Code

Use [claude-code/SKILL.md](claude-code/SKILL.md) as a Claude Code skill.

## Codex

Use [codex/SKILL.md](codex/SKILL.md) as a Codex skill.

## Cursor

Use [cursor/agent-ready-site.mdc](cursor/agent-ready-site.mdc) as a Cursor rule.

## Shared Contract

All integrations call the same CLI:

```bash
node ./src/index.js https://example.com --out ./agent-ready
node ./src/index.js inspect https://example.com --out ./agent-context
```

Integrations should not reimplement extraction logic. They should call the CLI and then follow the generated reports.
