#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUT = "agent-ready";
const DEFAULT_LOCAL_URL = "https://example.local/";

function usage() {
  return `Usage:
  agent-ready-site <url-or-html-file> [--out <dir>] [--site-url <url>]
  agent-ready-site inspect <url> [--out <dir>]

Example:
  agent-ready-site https://example.com --out ./public
  agent-ready-site ./homepage.html --site-url https://example.com --out ./agent-ready
  agent-ready-site inspect https://example.com --out ./agent-context
`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const mode = args[0] === "inspect" ? "inspect" : "generate";
  const modeOffset = mode === "inspect" ? 1 : 0;
  const input = args.find((arg, index) => index >= modeOffset && !arg.startsWith("--") && args[index - 1] !== "--out" && args[index - 1] !== "--site-url");
  const outIndex = args.indexOf("--out");
  const siteUrlIndex = args.indexOf("--site-url");
  const outDir = outIndex >= 0 ? args[outIndex + 1] : mode === "inspect" ? "agent-context" : DEFAULT_OUT;
  const siteUrl = siteUrlIndex >= 0 ? args[siteUrlIndex + 1] : "";

  if (!input) {
    throw new Error(usage());
  }

  if (outIndex >= 0 && !outDir) {
    throw new Error("--out requires a directory.");
  }

  if (siteUrlIndex >= 0 && (!siteUrl || !/^https?:\/\//i.test(siteUrl))) {
    throw new Error("--site-url requires an http(s) URL.");
  }

  if (/^https?:\/\//i.test(input)) {
    return { mode, input, inputType: "url", url: new URL(input), outDir };
  }

  if (mode === "inspect") {
    throw new Error("inspect mode requires an http(s) URL.");
  }

  return {
    mode,
    input,
    inputType: "file",
    url: new URL(siteUrl || DEFAULT_LOCAL_URL),
    outDir
  };
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "agent-ready-site/0.1 (+https://example.local/agent-ready-site)"
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status, text: "" };
    }

    return { ok: true, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error.message };
  }
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function matchOne(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeEntities(stripTags(match[1])) : "";
}

function matchMeta(html, name) {
  const pattern = new RegExp(`<meta\\b(?=[^>]*(?:name|property)=["']${name}["'])(?=[^>]*content=["']([^"']*)["'])[^>]*>`, "i");
  return matchOne(html, pattern);
}

function matchMany(html, pattern, limit = 30) {
  return [...html.matchAll(pattern)]
    .map((match) => decodeEntities(stripTags(match[1])))
    .filter(Boolean)
    .slice(0, limit);
}

function extractLinks(html, baseUrl, limit = 60) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const href = new URL(match[1], baseUrl).toString();
      const label = decodeEntities(stripTags(match[2]));
      if (label && href.startsWith(baseUrl.origin)) {
        links.push({ label, href });
      }
    } catch {
      // Skip invalid hrefs.
    }
  }

  const seen = new Set();
  return links.filter((link) => {
    const key = `${link.label}|${link.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function extractJsonLd(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      blocks.push({ parse_error: true, raw: match[1].trim().slice(0, 500) });
    }
  }
  return blocks;
}

function extractEmails(text) {
  return [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
}

function extractPhones(text) {
  return [...new Set(text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) ?? [])];
}

const SENSITIVE_PATTERNS = [
  { label: "private key", severity: "high", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: "API key", severity: "high", pattern: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?[A-Za-z0-9_.\-]{16,}/i },
  { label: "bearer token", severity: "high", pattern: /\bBearer\s+[A-Za-z0-9_.\-]{16,}/i },
  { label: "password-like value", severity: "high", pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*["']?[^"'\s<>]{8,}/i },
  { label: "credit card-like number", severity: "high", pattern: /\b(?:\d[ -]*?){13,19}\b/ },
  { label: "SSN-like number", severity: "high", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: "internal host", severity: "medium", pattern: /\b(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/i },
  { label: "admin path", severity: "medium", pattern: /\/(?:admin|wp-admin|dashboard|staff|internal)\b/i }
];

const CONTACT_PATTERNS = [
  { label: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: "phone", pattern: /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g }
];

function detectSensitiveSignals(value) {
  return SENSITIVE_PATTERNS
    .filter((item) => item.pattern.test(value))
    .map((item) => ({
      severity: item.severity,
      signal: item.label,
      action: "Review before publishing. Do not include this content in llms.txt or llms-full.txt unless it is intentionally public."
    }));
}

function redactSensitiveText(value) {
  return SENSITIVE_PATTERNS.reduce((current, item) => current.replace(item.pattern, `[REDACTED ${item.label.toUpperCase()}]`), value);
}

function redactContactText(value) {
  return CONTACT_PATTERNS.reduce((current, item) => current.replace(item.pattern, `[REDACTED ${item.label.toUpperCase()}]`), value);
}

function redactPublicText(value) {
  return redactContactText(redactSensitiveText(value));
}

function sanitizeData(value) {
  if (typeof value === "string") return redactPublicText(value);
  if (Array.isArray(value)) return value.map(sanitizeData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeData(item)]));
  }
  return value;
}

function findLikelyAudience(...sources) {
  const text = sources.filter(Boolean).join(" ");
  const patterns = [
    /(?:for|serving|helping)\s+([a-z0-9 ,&'-]{3,80}?)(?:\s+in\s+[A-Z][a-z]+|\.|,| with | who | to |$)/i,
    /\b(families|homeowners|businesses|founders|patients|students|parents|contractors|teams|creators|seniors)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return decodeEntities(stripTags(match[1] || match[0]));
  }

  return "";
}

function findLikelyOffer(headings, links) {
  const ctaTerms = ["book", "schedule", "quote", "consultation", "appointment", "shop", "buy"];
  const serviceTerms = ["service", "services", "product", "pricing", "menu"];
  const link = links.find((value) => [...ctaTerms, ...serviceTerms].some((term) => value.label.toLowerCase().includes(term)));
  if (link) return link.label;

  const heading = headings.find((value) => serviceTerms.some((term) => value.toLowerCase().includes(term)));
  return heading || "";
}

function scoreReadiness(profile) {
  let score = 100;
  for (const gap of profile.audit.gaps) {
    score -= gap.severity === "high" ? 18 : 9;
  }
  for (const signal of profile.audit.safety.signals) {
    score -= signal.severity === "high" ? 30 : 10;
  }
  return Math.max(0, Math.min(100, score));
}

function isSafePublicLink(link) {
  return !/\/(?:admin|wp-admin|dashboard|staff|internal)\b/i.test(link.href);
}

function buildGaps({ title, description, h1, h2, links, jsonLd, emails, phones, whatItDoes, audience, offer }) {
  const gaps = [];

  if (!title) gaps.push({ severity: "high", issue: "Missing page title.", fix: "Add a concise title with the business name and category." });
  if (!description) gaps.push({ severity: "high", issue: "Missing meta description.", fix: "Add a one-sentence answer to what the business does, for whom, and where." });
  if (h1.length === 0) gaps.push({ severity: "high", issue: "Missing H1 heading.", fix: "Use one clear H1 that names the business category and primary value." });
  if (h1.length > 1) gaps.push({ severity: "medium", issue: "Multiple H1 headings detected.", fix: "Keep one primary H1 and move supporting claims to H2/H3." });
  if (!whatItDoes) gaps.push({ severity: "high", issue: "The page does not clearly state what the business does.", fix: "Add a plain-language first paragraph under the hero." });
  if (!audience) gaps.push({ severity: "medium", issue: "Target audience is not obvious from the HTML.", fix: "Add text like 'For homeowners in...' or 'Serving small businesses that...'." });
  if (!offer) gaps.push({ severity: "medium", issue: "Primary offer or next step is not obvious.", fix: "Add a clear service list and CTA such as book, call, request a quote, or shop." });
  if (jsonLd.length === 0) gaps.push({ severity: "medium", issue: "No JSON-LD schema detected.", fix: "Add LocalBusiness, Organization, Product, Service, FAQPage, or WebSite schema as appropriate." });
  if (emails.length === 0 && phones.length === 0) gaps.push({ severity: "medium", issue: "No obvious contact method detected in page text.", fix: "Expose phone, email, contact page, or booking link in crawlable HTML." });
  if (links.length < 3) gaps.push({ severity: "medium", issue: "Few internal links detected.", fix: "Link important service, about, contact, pricing, FAQ, and location pages." });

  return gaps;
}

function extractProfile(url, homepageHtml, probes, sourceKind) {
  const plainText = stripTags(homepageHtml);
  const title = matchOne(homepageHtml, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = matchMeta(homepageHtml, "description") || matchMeta(homepageHtml, "og:description");
  const ogTitle = matchMeta(homepageHtml, "og:title");
  const h1 = matchMany(homepageHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 8);
  const h2 = matchMany(homepageHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 20);
  const links = extractLinks(homepageHtml, url);
  const jsonLd = sanitizeData(extractJsonLd(homepageHtml));
  const sensitiveSignals = detectSensitiveSignals(homepageHtml);
  const secretRedactedPlainText = redactSensitiveText(plainText);
  const emails = extractEmails(secretRedactedPlainText);
  const phones = extractPhones(secretRedactedPlainText);
  const publicRedactedPlainText = redactContactText(secretRedactedPlainText);
  const headings = [...h1, ...h2];
  const whatItDoes = description || h1[0] || ogTitle || "";
  const audience = findLikelyAudience(description, plainText);
  const offer = findLikelyOffer(headings, links);
  const gaps = buildGaps({ title, description, h1, h2, links, jsonLd, emails, phones, whatItDoes, audience, offer });

  const profile = {
    generated_at: new Date().toISOString(),
    source_kind: sourceKind,
    source_url: url.toString(),
    site_name: title || url.hostname,
    summary: {
      what_it_does: whatItDoes,
      who_it_serves: audience,
      primary_offer: offer,
      missing_information: gaps.map((gap) => gap.issue)
    },
    extracted: {
      title,
      og_title: ogTitle,
      description,
      h1,
      h2,
      links: links.filter(isSafePublicLink),
      excluded_links: links.filter((link) => !isSafePublicLink(link)),
      contact_signals: {
        email_detected: emails.length > 0,
        phone_detected: phones.length > 0,
        values_redacted: true
      },
      json_ld: jsonLd,
      homepage_text_sample: publicRedactedPlainText.slice(0, 3000)
    },
    audit: {
      agent_readiness_score: 0,
      gaps,
      safety: {
        status: sensitiveSignals.some((signal) => signal.severity === "high") ? "review_required" : "ok",
        signals: sensitiveSignals,
        rule: "Only publish business facts the owner wants surfaced to AI systems. Redact secrets, private customer data, credentials, internal URLs, drafts, regulated advice, and non-public pricing."
      },
      recommendation: "Publish llms.txt and llms-full.txt, then improve homepage copy/schema where gaps are listed."
    },
    discovered_files: probes
  };

  profile.audit.agent_readiness_score = scoreReadiness(profile);
  return profile;
}

function renderLlmsTxt(profile) {
  const lines = [
    `# ${profile.site_name}`,
    "",
    `> ${profile.summary.what_it_does || "Official AI-readable summary for this website."}`,
    "",
    "## What This Site Does",
    "",
    profile.summary.what_it_does || "This needs a clear one-sentence business description.",
    "",
    "## Who This Is For",
    "",
    profile.summary.who_it_serves || "Target audience was not obvious from the current HTML.",
    "",
    "## Main Offer",
    "",
    profile.summary.primary_offer || "Primary offer was not obvious from the current HTML.",
    "",
    "## Source URL",
    "",
    `- Website: ${profile.source_url}`,
    "",
    "## Key Pages",
    ""
  ];

  for (const link of profile.extracted.links.slice(0, 20)) {
    lines.push(`- [${link.label}](${link.href})`);
  }

  return `${lines.join("\n")}\n`;
}

function renderLlmsFull(profile) {
  return `${renderLlmsTxt(profile)}
## Extracted Headings

${[...profile.extracted.h1, ...profile.extracted.h2].map((heading) => `- ${heading}`).join("\n")}

## Notes

This file intentionally avoids raw phone numbers, raw email addresses, private customer data, credentials, internal links, and non-public pricing. Use the public website links above for contact and conversion paths.
`;
}

function renderAuditMd(profile) {
  return `# AI Visibility Audit

This is a private review artifact. Do not publish this file as \`llms.txt\` or \`llms-full.txt\`.

## Agent Readiness Score

${profile.audit.agent_readiness_score}/100

## Extraction Confidence

This audit was generated from ${profile.source_kind === "file" ? "saved HTML" : "a fetched URL"}. Claims should be reviewed by the site owner before publishing.

## Safety Review

Status: ${profile.audit.safety.status}

${profile.audit.safety.signals.map((signal) => `- ${signal.severity.toUpperCase()}: ${signal.signal}. ${signal.action}`).join("\n") || "- No high-risk sensitive signals detected by deterministic checks."}

## Contact Signals

${[
  profile.extracted.contact_signals.email_detected ? "- Public email detected in HTML, value redacted from generated files." : "",
  profile.extracted.contact_signals.phone_detected ? "- Public phone number detected in HTML, value redacted from generated files." : ""
].filter(Boolean).join("\n") || "- No obvious contact signals detected."}

## Suggested HTML Improvements

${profile.audit.gaps.map((gap) => `- ${gap.severity.toUpperCase()}: ${gap.issue} ${gap.fix}`).join("\n") || "- No obvious gaps detected."}

## Structured Data Detected

${profile.extracted.json_ld.length ? JSON.stringify(profile.extracted.json_ld, null, 2) : "No JSON-LD schema detected."}

## Homepage Text Sample

${profile.extracted.homepage_text_sample}
`;
}

function renderOwnerQuestions(profile) {
  return `# Owner Review Questions

Answer these before publishing \`llms.txt\` or \`llms-full.txt\`.

## Business Facts To Surface

1. What is the clearest one-sentence description of the business?
2. Who should AI systems understand this business is for?
3. What are the top services, products, or offers that should be surfaced?
4. What locations, service areas, industries, or customer types matter?
5. What proof should be highlighted: credentials, reviews, case studies, years in business, guarantees, certifications, or partners?

## Conversion Path

1. What should an interested person do next: call, book, email, request a quote, visit, buy, or apply?
2. Which contact path should be described without exposing raw phone numbers or email addresses?
3. Which pages should AI agents treat as the most important?

## Do Not Surface

1. Are there services, prices, staff details, locations, or policies that should not be included?
2. Is any pricing seasonal, negotiable, private, or likely to become stale?
3. Are there regulated claims to avoid, such as medical, legal, financial, insurance, employment, or safety advice?
4. Are there customer names, private stories, internal links, draft pages, credentials, raw phone numbers, raw emails, or admin paths that should be removed?

## Current Agent Guess

- What this site does: ${profile.summary.what_it_does || "Not detected."}
- Who this is for: ${profile.summary.who_it_serves || "Not detected."}
- Main offer: ${profile.summary.primary_offer || "Not detected."}
- Safety status: ${profile.audit.safety.status}

## Safety Signals

${profile.audit.safety.signals.map((signal) => `- ${signal.severity.toUpperCase()}: ${signal.signal}`).join("\n") || "- No high-risk sensitive signals detected by deterministic checks."}
`;
}

function extractMarkdownLinks(markdown, baseUrl) {
  const links = [];
  for (const match of markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    try {
      links.push({
        label: match[1].trim(),
        href: new URL(match[2].trim(), baseUrl).toString()
      });
    } catch {
      // Skip invalid Markdown links.
    }
  }
  return links;
}

function contextExcerpt(value, limit = 12000) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[Truncated by agent-ready-site inspect. Fetch the source URL if more context is needed.]`;
}

async function inspectAgentContext(url) {
  const root = `${url.origin}/`;
  const llmsUrl = new URL("llms.txt", root);
  const llmsFullUrl = new URL("llms-full.txt", root);
  const sitemapUrl = new URL("sitemap.xml", root);
  const homepageUrl = url;

  const llms = await fetchText(llmsUrl);
  if (llms.ok && llms.text.trim()) {
    const llmsFull = await fetchText(llmsFullUrl);
    const sources = [
      {
        role: "primary",
        type: "llms.txt",
        url: llmsUrl.toString(),
        status: llms.status,
        bytes: byteLength(llms.text)
      }
    ];

    if (llmsFull.ok && llmsFull.text.trim()) {
      sources.push({
        role: "expanded",
        type: "llms-full.txt",
        url: llmsFullUrl.toString(),
        status: llmsFull.status,
        bytes: byteLength(llmsFull.text)
      });
    }

    return {
      generated_at: new Date().toISOString(),
      source_url: url.toString(),
      mode: "llms-first",
      status: "ai_readable_context_found",
      instruction: "Use /llms.txt as first context. Use /llms-full.txt only when more detail is needed. Prefer linked public pages over broad crawling.",
      sources,
      markdown_links: extractMarkdownLinks(llms.text, url).slice(0, 40),
      context: {
        llms_txt: contextExcerpt(llms.text),
        llms_full_txt: llmsFull.ok && llmsFull.text.trim() ? contextExcerpt(llmsFull.text) : ""
      },
      token_proxy: {
        bytes_read: sources.reduce((sum, source) => sum + source.bytes, 0),
        note: "Byte count is a rough token-cost proxy. Compare against fallback homepage/sitemap inspection during evals."
      }
    };
  }

  const [homepage, sitemap] = await Promise.all([
    fetchText(homepageUrl),
    fetchText(sitemapUrl)
  ]);
  const homepageText = homepage.ok ? redactPublicText(stripTags(homepage.text)).slice(0, 5000) : "";
  const homepageTitle = homepage.ok ? matchOne(homepage.text, /<title[^>]*>([\s\S]*?)<\/title>/i) : "";
  const homepageDescription = homepage.ok ? matchMeta(homepage.text, "description") || matchMeta(homepage.text, "og:description") : "";

  return {
    generated_at: new Date().toISOString(),
    source_url: url.toString(),
    mode: "fallback",
    status: "no_llms_txt_found",
    instruction: "No /llms.txt found. Fall back to homepage and sitemap inspection; state that no AI-readable site context was found.",
    sources: [
      {
        role: "fallback",
        type: "homepage",
        url: homepageUrl.toString(),
        status: homepage.status,
        bytes: homepage.ok ? byteLength(homepage.text) : 0
      },
      {
        role: "fallback",
        type: "sitemap.xml",
        url: sitemapUrl.toString(),
        status: sitemap.status,
        bytes: sitemap.ok ? byteLength(sitemap.text) : 0
      }
    ],
    context: {
      title: homepageTitle,
      description: homepageDescription,
      homepage_text_sample: homepageText,
      sitemap_sample: sitemap.ok ? sitemap.text.slice(0, 5000) : ""
    },
    token_proxy: {
      bytes_read: (homepage.ok ? byteLength(homepage.text) : 0) + (sitemap.ok ? byteLength(sitemap.text) : 0),
      note: "Byte count is a rough token-cost proxy. Fallback often reads more noisy content than a curated llms.txt."
    }
  };
}

function renderAgentContextMd(result) {
  const lines = [
    "# Agent Website Context",
    "",
    `Source: ${result.source_url}`,
    `Mode: ${result.mode}`,
    `Status: ${result.status}`,
    "",
    "## Agent Instruction",
    "",
    result.instruction,
    "",
    "## Sources Checked",
    ""
  ];

  for (const source of result.sources) {
    lines.push(`- ${source.role}: ${source.type} (${source.status}) ${source.url} - ${source.bytes} bytes`);
  }

  lines.push("", "## Token Proxy", "", `- Bytes read: ${result.token_proxy.bytes_read}`, `- ${result.token_proxy.note}`);

  if (result.mode === "llms-first") {
    lines.push("", "## Markdown Links From llms.txt", "");
    if (result.markdown_links.length) {
      for (const link of result.markdown_links) {
        lines.push(`- [${link.label}](${link.href})`);
      }
    } else {
      lines.push("- No Markdown links detected.");
    }
    lines.push("", "## llms.txt Context", "", result.context.llms_txt);
    if (result.context.llms_full_txt) {
      lines.push("", "## llms-full.txt Context", "", result.context.llms_full_txt);
    }
  } else {
    lines.push("", "## Fallback Context", "");
    lines.push(`Title: ${result.context.title || "Not detected."}`);
    lines.push(`Description: ${result.context.description || "Not detected."}`);
    lines.push("", "### Homepage Text Sample", "", result.context.homepage_text_sample || "Homepage unavailable.");
    if (result.context.sitemap_sample) {
      lines.push("", "### Sitemap Sample", "", result.context.sitemap_sample);
    }
  }

  return `${lines.join("\n")}\n`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(profile) {
  const headings = [...profile.extracted.h1, ...profile.extracted.h2]
    .map((heading) => `<li>${escapeHtml(heading)}</li>`)
    .join("");
  const links = profile.extracted.links
    .slice(0, 20)
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join("");
  const gaps = profile.summary.missing_information
    .map((gap) => `<li>${escapeHtml(gap)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(profile.site_name)} AI Brief</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #171717; background: #f7f7f2; }
    main { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
    header { border-bottom: 1px solid #d8d8cf; padding-bottom: 24px; margin-bottom: 28px; }
    h1 { font-size: 40px; line-height: 1.1; margin: 0 0 12px; }
    h2 { font-size: 20px; margin: 28px 0 12px; }
    p, li { font-size: 16px; line-height: 1.55; }
    .meta { color: #555; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
    section { background: #fff; border: 1px solid #deded6; border-radius: 8px; padding: 18px; }
    a { color: #0d5c8c; }
    code { background: #ededde; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(profile.site_name)}</h1>
      <p>${escapeHtml(profile.summary.what_it_does || "No summary detected.")}</p>
      <p class="meta">Generated from <a href="${escapeHtml(profile.source_url)}">${escapeHtml(profile.source_url)}</a></p>
    </header>
    <div class="grid">
      <section>
        <h2>Agent Summary</h2>
        <p>${escapeHtml(profile.summary.what_it_does || "Needs stronger source content.")}</p>
        <p><strong>Score:</strong> ${profile.audit.agent_readiness_score}/100</p>
      </section>
      <section>
        <h2>Missing Information</h2>
        <ul>${gaps || "<li>No obvious homepage metadata gaps detected.</li>"}</ul>
      </section>
      <section>
        <h2>Important Pages</h2>
        <ul>${links || "<li>No internal links detected.</li>"}</ul>
      </section>
      <section>
        <h2>Extracted Headings</h2>
        <ul>${headings || "<li>No headings detected.</li>"}</ul>
      </section>
    </div>
  </main>
</body>
</html>
`;
}

async function main() {
  const { mode, input, inputType, url, outDir } = parseArgs(process.argv);
  if (mode === "inspect") {
    const result = await inspectAgentContext(url);
    const resolvedOut = path.resolve(outDir);
    await mkdir(resolvedOut, { recursive: true });
    await Promise.all([
      writeFile(path.join(resolvedOut, "agent-context.json"), `${JSON.stringify(result, null, 2)}\n`),
      writeFile(path.join(resolvedOut, "agent-context.md"), renderAgentContextMd(result))
    ]);
    console.log(`${result.status}: wrote agent context to ${resolvedOut}`);
    return;
  }

  const root = `${url.origin}/`;
  const probes = {};

  if (inputType === "url") {
    for (const file of ["robots.txt", "sitemap.xml", "llms.txt"]) {
      const probeUrl = new URL(file, root);
      const result = await fetchText(probeUrl);
      probes[`/${file}`] = {
        ok: result.ok,
        status: result.status,
        url: probeUrl.toString()
      };
    }
  }

  let homepageHtml = "";
  if (inputType === "url") {
    const homepage = await fetchText(url);
    if (!homepage.ok) {
      throw new Error(`Could not fetch ${url.toString()} (status ${homepage.status}).`);
    }
    homepageHtml = homepage.text;
  } else {
    homepageHtml = await readFile(path.resolve(input), "utf8");
  }

  const profile = extractProfile(url, homepageHtml, probes, inputType);
  const resolvedOut = path.resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });

  await Promise.all([
    writeFile(path.join(resolvedOut, "ai.json"), `${JSON.stringify(profile, null, 2)}\n`),
    writeFile(path.join(resolvedOut, "ai-audit.md"), renderAuditMd(profile)),
    writeFile(path.join(resolvedOut, "llms.txt"), renderLlmsTxt(profile)),
    writeFile(path.join(resolvedOut, "llms-full.txt"), renderLlmsFull(profile)),
    writeFile(path.join(resolvedOut, "ai.html"), renderHtml(profile)),
    writeFile(path.join(resolvedOut, "owner-questions.md"), renderOwnerQuestions(profile))
  ]);

  console.log(`Generated agent-ready files in ${resolvedOut}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
