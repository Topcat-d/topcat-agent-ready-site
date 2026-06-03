# Website Owner llms.txt Convention

Use this as the owner-facing convention for publishing AI-readable website context.

## Public Files

Publish only after review:

```text
/llms.txt
/llms-full.txt
```

These files should contain public, durable business information that the owner wants AI agents to understand.

## Private Review Files

Do not publish by default:

```text
ai-audit.md
owner-questions.md
ai.json
ai.html
```

These are working files for review, safety checks, and improvements.

## llms.txt Purpose

`llms.txt` is a compact Markdown map of the most important public pages on a site.

It should help an agent answer:

- What does this website do?
- Who is it for?
- What are the main offers, services, products, or topics?
- Which public pages should the agent read first?

It should not try to replace the whole website.

## Recommended Structure

```markdown
# Site or Business Name

> One clear sentence explaining what the site or business does.

## What This Site Does

Plain-language description of the business, product, service, publication, or project.

## Who This Is For

The audience, customer type, service area, industry, or use case.

## Main Offer

The main service, product, content area, or action the site supports.

## Key Pages

- [Services](https://example.com/services): Main services or offers.
- [About](https://example.com/about): Company, team, mission, credentials, or story.
- [FAQ](https://example.com/faq): Common questions and policies.
- [Contact](https://example.com/contact): Public contact or booking path.
```

## llms-full.txt Purpose

`llms-full.txt` can include the same summary plus more owner-approved context.

Keep it factual, current, and public. Use it for:

- service descriptions
- product category summaries
- FAQ summaries
- location/service-area notes
- public policy summaries
- blog or resource indexes

## Do Not Include

Do not include:

- raw phone numbers or email addresses
- secrets, tokens, credentials, or private keys
- customer data or private stories
- internal/admin URLs
- draft pages
- non-public pricing
- unsupported claims
- regulated advice that has not been approved
- staff details the owner does not want surfaced
- stale products, services, policies, or pricing

Prefer links to public contact, booking, services, about, FAQ, store, and blog pages instead of copying contact values into the file.

## Quality Bar

A useful `llms.txt` should be:

- short enough to read quickly
- honest rather than marketing-heavy
- grouped into clear sections
- limited to high-signal public links
- updated when the website changes
- reviewed by the owner before publishing

If the file is stale, bloated, or full of vague marketing language, it is worse than no file.
