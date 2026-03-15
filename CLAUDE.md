# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal portfolio site for Adam Larkin (adamlarkin.com), hosted on GitHub Pages. No build system — all vanilla HTML/CSS/JS deployed via git push. One backend component: a Cloudflare Worker (`secops-daily/worker.js`) deployed separately to `rss-proxy.adamlarkin.workers.dev`.

## Deployment

- **Static site**: push to `main` → auto-deploys via GitHub Pages
- **Cloudflare Worker**: `secops-daily/worker.js` is deployed separately via the Cloudflare dashboard or Wrangler CLI — changes here are **not** deployed by git push

## Architecture

### Apps

| Directory | Status | Description |
|-----------|--------|-------------|
| `index.html` | Active | Portfolio landing page |
| `parlo-v2/` | Active | Italian learning app — SRS flashcards + AI-powered sentence practice |
| `secops-daily/` | Active | Security news aggregator with Cloudflare Worker RSS proxy |
| `parlo/` | Legacy | v1 Italian flashcards (superseded by parlo-v2) |
| `ciao/` | Legacy | Older flashcard app |
| `fd.html` | Active | Firewall Defender — educational security game |

### secops-daily Data Flow

1. `script.js` fetches from `rss-proxy.adamlarkin.workers.dev`
2. `worker.js` (Cloudflare Worker) fetches approved RSS feeds, applies SSRF/geo/referer protections, and optionally calls Gemini API for trend analysis
3. Parsed XML → article objects → filtered/searched client-side

### parlo-v2 Structure

- `flashcards.js` — SM-2 spaced repetition algorithm; state persisted in `localStorage` as `parlo_v2_srs`
- `practice.js` — Groq API (Llama 3) + Gemini integration for AI sentence feedback; CEFR levels A0–B2; user API key stored in `localStorage` as `parlo_v2_groq_key`
- `phrases.json` — 1600+ Italian phrases with metadata (Italian, English, pronunciation, difficulty)

## Security

### DOM XSS — the primary ongoing risk

`secops-daily` renders untrusted external content (RSS feed titles, descriptions, URLs from 20+ third-party sources) into the DOM. This is the highest XSS risk in the codebase. Always:
- Use `element.textContent` (not `innerHTML`) for any RSS-derived text
- Build article card elements via `createElement`/`appendChild`, never by concatenating HTML strings with feed data
- Sanitize or reject any feed data used as a URL before setting `href` attributes

The XSS fixes in commit `036b9b2` addressed exactly this pattern — don't regress it.

### Content Security Policy

`secops-daily/index.html` enforces a strict CSP:
```
default-src 'self'; script-src 'self'; style-src 'self';
connect-src https://rss-proxy.adamlarkin.workers.dev;
img-src 'none'; object-src 'none'; form-action 'none';
```

- No inline `style=` attributes, `onclick=` handlers, or `eval()` — use CSS classes and `addEventListener`
- If a new `fetch()` target is added to `script.js`, its origin must also be added to `connect-src`
- This has caused multiple bugs — check the CSP whenever something silently fails in `secops-daily`

### Cloudflare Worker defenses

`worker.js` enforces five layers: geo-fence (US/CA/IT only), referer whitelist, HTTPS-only URLs, SSRF block (private IP ranges), and domain whitelist. When adding a new RSS feed:
1. Add its domain to `ALLOWED_DOMAINS` in `worker.js`
2. Add the feed URL to `NEWS_FEEDS` or `INTEL_FEEDS` in `script.js`
3. Deploy the worker change separately before or alongside the JS change

### API keys in localStorage

User-supplied Groq API keys are stored in `localStorage` (`parlo_v2_groq_key`). Don't log these, include them in error messages, or expose them in any observable way. The worker's `GROQ_API_KEY` is an environment secret — never hardcode it in `worker.js`.

## Cache-Busting

JS and CSS files use `?v=X` version strings in `<script>` and `<link>` tags. When modifying a JS or CSS file in `secops-daily/` or `parlo-v2/`, bump the version string in the corresponding HTML file.


## External Dependencies

- **Groq API** — client-side AI calls from `parlo-v2/practice.js`
- **Google Gemini API** — server-side trend analysis in `worker.js`
- **Web Speech API** — Italian pronunciation (built-in browser API)
- No npm packages, no bundler, no transpilation
