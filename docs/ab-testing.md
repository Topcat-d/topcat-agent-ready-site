# A/B Testing

Use A/B testing to prove whether `llms.txt` reduces wasted context and improves website understanding for agents you control.

## Core Claim

When an agent checks `/llms.txt` first, it should often need fewer page reads and fewer tokens to understand a website.

Do not claim that major AI search providers automatically use `/llms.txt`. Test the controlled-agent workflow:

```text
agent-ready-site inspect https://example.com --out ./agent-context
```

## Test Arms

Run the same task through three paths:

### A. Homepage HTML Only

The agent reads the homepage and answers from normal HTML.

### B. Homepage + Sitemap

The agent reads the homepage, sitemap, and a small set of linked pages.

### C. llms.txt First

The agent checks `/llms.txt` first. If available, it uses that as first context and reads `/llms-full.txt` only when more detail is needed.

## Prompts

Use the same prompts for every arm:

1. What does this website do?
2. Who is this for?
3. What are the main services, products, offers, or topics?
4. What should an interested person do next?
5. What public pages should the agent read first?
6. What information is missing or unclear?

## Metrics

Track:

- bytes read
- approximate tokens used
- pages fetched
- time to answer
- answer accuracy
- answer completeness
- hallucinated claims
- whether the answer cites the right source path

The CLI already writes a rough byte-count proxy in `agent-context.json`.

## Suggested Scoring

Use a 1-5 score for:

- **Accuracy**: Does the answer match the source?
- **Completeness**: Does it include the important business facts?
- **Faithfulness**: Does it avoid unsupported claims?
- **Actionability**: Does it identify the right next step or public page?
- **Efficiency**: Did it use fewer bytes/pages than fallback inspection?

## Winning Condition

The `llms.txt` path wins when it produces:

- equal or better accuracy
- equal or better completeness
- fewer hallucinated claims
- fewer bytes/pages read
- a clear source path: `llms-first`

## Minimal Test Set

Start with 10-20 websites:

- local business sites
- service businesses
- SaaS/product sites
- ecommerce/catalog sites
- portfolio or creator sites
- documentation-heavy sites

For each site:

1. Run owner generation.
2. Review the generated public files.
3. Serve or publish `llms.txt`.
4. Run inspect mode.
5. Compare against homepage/sitemap fallback.

## Output To Keep

Keep test results in a private folder by default:

```text
eval-results/
  site-name/
    arm-a-homepage.md
    arm-b-sitemap.md
    arm-c-llms-first.md
    scores.json
```

Do not commit private customer data, raw contact details, or unpublished business information.
