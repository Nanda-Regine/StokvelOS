# StokvelOS 🌿

> *Your Stokvel. Organised. Intelligent. Together.*

StokvelOS is South Africa's first AI-powered stokvel management platform, built for the R50B+ community savings market. An estimated 11 million South Africans participate in stokvels — managing billions annually with no proper software. StokvelOS changes that.

---

## The Problem

South African stokvels — General, Grocery, Burial, Christmas, Investment — run on spreadsheets, WhatsApp groups, and handwritten ledgers. Money is lost. Disputes happen. Trust breaks down.

## The Solution

StokvelOS gives stokvel administrators and members:
- A clean, simple dashboard to track contributions and members
- AI-generated meeting minutes, health reports, and WhatsApp reminders
- A calendar view of all contributions
- Annual and monthly reports with one-click export
- Works offline, installs like an app — no login required for MVP

---

## AI Features (GPT-4o-mini)

### 1. AI Meeting Minutes Writer
Type rough meeting notes in any format. The AI converts them into formal, professional meeting minutes. Copy to share via WhatsApp or email.

### 2. Monthly Stokvel Health Report
Auto-generated on the dashboard. Covers contribution compliance rate, patterns, and one recommendation for the administrator. Cached monthly to save API calls.

### 3. WhatsApp Reminder Generator
For each member with outstanding payment, the AI writes a personalised, warm WhatsApp message. One click to send via the WhatsApp app.

---

## Pages

| Page | File |
|------|------|
| Setup (first launch) | `setup.html` |
| Dashboard | `index.html` |
| Members | `members.html` |
| Contributions | `contributions.html` |
| Meetings | `meetings.html` |
| Reports | `reports.html` |

---

## Setup & Deployment

1. Set your OpenAI API key in `shared.js`:
   ```js
   const OPENAI_KEY = 'your-key-here';
   ```

2. Deploy to Vercel, Netlify, or GitHub Pages — all static files, no server needed.

3. Place `sw.js` at the root of your domain for PWA functionality.

4. First-time users are automatically redirected to `setup.html`.

---

## Stack

- Vanilla HTML / CSS / JavaScript — zero dependencies
- `localStorage` for all data persistence (no backend for MVP)
- OpenAI `gpt-4o-mini` for AI features
- PWA manifest + service worker for offline capability

---

## Pricing Model

| Plan | Price | Features |
|------|-------|---------|
| Basic | R199/month | Core management, up to 20 members |
| Premium | R499/month | AI features, unlimited members, export |
| Beta | Free | Full access during beta period |

---

Built by **Nanda Regine** — Creative Technologist & AI Engineer  
East London, South Africa  
[creativelynanda.co.za](https://creativelynanda.co.za) | hello@mirembemuse.co.za | [wa.me/27842916742](https://wa.me/27842916742)

*StokvelOS — Basic R199/month · Premium R499/month · Free during beta*
