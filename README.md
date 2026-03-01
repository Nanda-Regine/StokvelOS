# StokvelOS 🌿 — Next.js SaaS Edition

> *South Africa's first AI-powered stokvel management platform.*

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **AI**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS + custom design system
- **Analytics**: Vercel Analytics + Speed Insights
- **Deployment**: Vercel

---

## 📦 Project Batches

This project is built in 5 batches:

| Batch | Contents | Status |
|-------|----------|--------|
| **Batch 1** | Foundation: config, types, auth, layout, design system | ✅ |
| **Batch 2** | Dashboard + Setup pages | 🔜 |
| **Batch 3** | Members + Contributions pages | 🔜 |
| **Batch 4** | Meetings + Reports pages | 🔜 |
| **Batch 5** | AI API routes + Settings + Final polish | 🔜 |

---

## 🛠 Setup Instructions

### 1. Clone and install

```bash
git clone https://github.com/yourusername/stokvel-os.git
cd stokvel-os
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the contents of `lib/supabase/schema.sql`
3. Copy your project URL and anon key

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add your environment variables in the Vercel dashboard.

---

## 📁 Project Structure

```
stokvel-os/
├── app/
│   ├── auth/           # Login, signup, reset password
│   ├── dashboard/      # Main dashboard
│   ├── members/        # Member management
│   ├── contributions/  # Payment tracking
│   ├── meetings/       # Meeting minutes
│   ├── reports/        # Analytics & exports
│   ├── settings/       # Stokvel configuration
│   ├── setup/          # First-time setup wizard
│   └── api/            # AI and data API routes
├── components/
│   ├── ui/             # Reusable components
│   ├── dashboard/      # Dashboard-specific
│   └── shared/         # Layout components
├── lib/
│   ├── supabase/       # DB clients + schema
│   └── utils.ts        # Helpers
└── types/              # TypeScript types
```

---

## 🤖 AI Features

- **Health Report**: Monthly stokvel compliance analysis
- **Meeting Minutes**: Convert rough notes to professional minutes
- **WhatsApp Reminders**: Personalised messages for each member
- **Smart Insights**: Trend detection and recommendations

---

Built by **Nanda Regine** — Creative Technologist & AI Engineer  
East London, South Africa  
[creativelynanda.co.za](https://creativelynanda.co.za) | hello@mirembemuse.co.za
