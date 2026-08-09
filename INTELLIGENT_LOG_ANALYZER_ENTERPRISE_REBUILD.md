# 🔁 Intelligent Log Analyzer — Enterprise Rebuild Spec
> Paste-ready master prompt. Follows your CLAUDE_CONTEXT.md rules: phases only,
> real live data, no Docker, no mock data, security-first, dark cybersecurity UI.

---

## 1. Where this project actually stands

Per your context file: Project 2 was "all 5 phases complete, working" — but that
build was a **single-user Streamlit dashboard with no auth, no billing, no
multi-tenancy, and hardcoded scoring weights**. That's a solid learning build.
It is NOT enterprise-grade, and it can't be — Streamlit has no real session/auth
model and wasn't built for paying users. So "redeveloping to enterprise level"
isn't a patch, it's a **replatform**: same detection logic and domain knowledge,
new foundation (auth, RBAC, billing, async ingestion, proper storage split).

I can't literally delete/audit files yet — you only gave me the context doc, not
the actual repo. **Upload the current repo (zip) or point me at the GitHub repo**
next session and I'll do the real dead-code/file audit (item #7) against this
spec. Everything below is the target architecture to audit against.

---

## 2. How it should work (architecture)

```
                    ┌─────────────────────────┐
   Log files/       │   FastAPI (async)        │
   syslog/agent  →  │   /api/v1/logs/ingest    │──┐
                    └─────────────────────────┘  │
                                                   ▼
                                        ┌──────────────────┐
                                        │  Parser Layer     │  SSH / Apache / Nginx /
                                        │  (pluggable)       │  Windows Event / generic
                                        └──────────────────┘  syslog / firewall (CEF)
                                                   │
                                                   ▼
                                        ┌──────────────────┐
                                        │ Detection Engine  │  brute force, port scan,
                                        │ (rule-driven,      │  cred stuffing, SQLi,
                                        │  weights from DB)  │  impossible travel, after-hours
                                        └──────────────────┘
                                                   │
                              ┌────────────────────┼─────────────────────┐
                              ▼                    ▼                     ▼
                     ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                     │ MongoDB Atlas   │  │ Enrichment Worker │  │ Postgres/Supabase │
                     │ raw_logs        │  │ (background, Redis│  │ users, orgs, RBAC, │
                     │ parsed_events   │  │  cache) AbuseIPDB, │  │ credits, billing,  │
                     │                 │  │ OTX, IPInfo        │  │ audit_logs, alerts │
                     └────────────────┘  └──────────────────┘  └──────────────────┘
                                                   │
                                                   ▼
                                        ┌──────────────────┐
                                        │  AI Analyst        │  OpenAI direct SDK,
                                        │  (credit-metered)  │  streaming, per-org quota
                                        └──────────────────┘
                                                   │
                                                   ▼
                                   React 18 + Vite + Tailwind + shadcn/ui
                                   (replaces Streamlit — auth-gated, multi-tenant)
```

**Why Mongo *and* Postgres:** logs are high-volume, semi-structured, write-heavy
— Mongo is the right tool. Users, orgs, roles, credits, invoices, audit trails
are relational and need transactional integrity — that's Postgres via Supabase
(also gives you Auth for free, matching your ThreatHunter pattern). Don't force
one DB to do both jobs.

**Why Redis (Upstash, not self-hosted):** you said no Docker. Upstash is a
managed serverless Redis with a free tier — no install, no container, just a
URL. Use it for: enrichment cache (avoid burning AbuseIPDB's 1000/day limit),
rate limiting, and a lightweight job queue for background enrichment so
ingestion never blocks on a slow external API.

---

## 3. Databases needed

| DB | Purpose | Why |
|---|---|---|
| **MongoDB Atlas** (free M0 tier) | `raw_logs`, `parsed_events`, `threat_actors` | High-volume semi-structured log data |
| **Supabase Postgres** | orgs, users, roles, credits, billing, audit_logs, incidents, alerts | Auth, RBAC, transactions, reporting |
| **Upstash Redis** | enrichment cache, rate-limit counters, job queue | No local install, free tier |

Drop the pure-SQLite dev fallback for this project — with auth + billing you
need Postgres from day one, even locally (Supabase gives you a free hosted
instance, so there's nothing to install).

---

## 4. All API keys needed

| Key | Purpose | Free tier |
|---|---|---|
| `MONGODB_URI` | Atlas connection | Free M0 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | DB + Auth | Free |
| `JWT_SECRET` | token signing (if not fully delegating to Supabase) | n/a |
| `ABUSEIPDB_API_KEY` | IP reputation | 1000/day |
| `OTX_API_KEY` | threat pulses | free |
| `IPINFO_TOKEN` | geolocation | 50k/month |
| `OPENAI_API_KEY` | AI analyst | pay-as-you-go |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_PRO` | billing | free to integrate, test mode |
| `RESEND_API_KEY` | transactional email (verification, alerts, invoices) | 100/day free |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | cache + queue | free tier |

Drop `NIST NVD` and `VirusTotal` for this project unless you want CVE
correlation on top of log analysis — not in v1 scope, add later as a phase.

---

## 5–7. Deprecate / cut / keep

**Cut (once you upload the real repo I'll confirm against actual files):**
- Streamlit multi-page dashboard entirely — replaced by React frontend
- Hardcoded `THREAT_WEIGHTS` dict — move to a `detection_rules` Postgres table so
  weights are tunable per-org without a redeploy
- **Decided: LangChain is out.** AI Analyst calls the OpenAI SDK directly —
  it's one prompt in, one streamed response out, no agent chains or tool
  routing involved, so LangChain was pure overhead. Revisit only if a later
  project needs real multi-step tool-calling across several data sources.
- Synchronous `requests` calls anywhere in the FastAPI app — everything must be
  `httpx.AsyncClient`, or one blocking enrichment call stalls the whole worker

**Best features to actually use:**
- FastAPI `BackgroundTasks` for cheap async jobs; Redis-backed queue only where
  you need retries/persistence (enrichment, email, report generation)
- Pydantic v2 models for every request/response — free input validation
- Motor's async cursor + aggregation pipeline for MongoDB analytics (you
  already know Pandas — use Mongo aggregation for the heavy lifting, pull into
  Pandas only for the final chart-shaping step)
- Supabase Row Level Security (RLS) so org data isolation is enforced at the DB
  layer, not just in application code — this is the single biggest
  enterprise-readiness upgrade you can make

---

## 8. Security

- Supabase Auth: email verification required, password strength check, lockout
  after N failed attempts, optional TOTP MFA
- RBAC: `admin` / `analyst` / `viewer` roles, enforced via Postgres RLS +
  FastAPI dependency, not just frontend hiding of buttons
- Rate limiting: auth 10/15min, ingest 60/min, AI analyst 5/min (it's the
  expensive one), global 200/15min — via Redis counters
- Every external API call validated and sanitized before it leaves your
  backend; **never call AbuseIPDB/OTX/OpenAI from the React frontend**
- Log content is attacker-controlled input — sanitize before storage/display
  (no raw HTML render of log lines; strip control chars; cap line length) to
  prevent stored XSS and log-injection-of-log-injection
- File upload limits: max size, allowed extensions only, reject anything that
  isn't plain text/log format for ingestion
- API keys (Abuse/OTX/etc.) encrypted at rest if stored per-org, never
  returned in full via any endpoint
- Full `audit_logs` table — every write action logged with actor, IP, user
  agent, timestamp
- Stripe webhook signature verification — never trust an unsigned webhook body
- `.env` never committed; `.env.example` with every variable name but no
  values, checked into git

---

## 9–10. Enterprise bar + your global rules

Enterprise-ready here means: multi-tenant (org-scoped data via RLS),
role-based access, full audit trail, metered billing, health-check endpoint,
and configurable detection rules instead of hardcoded ones — not
Kubernetes/microservices theater. Keeping this consistent with your
CLAUDE_CONTEXT rules: no Docker, no mock data, phases with tests, real live
APIs throughout, dark cybersecurity theme + JetBrains Mono for all
IPs/hashes/technical fields, complete `.env.example`, complete schemas.

---

## 11. Folder structure

```
intelligent-log-analyzer/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── logs.py
│   │       ├── analysis.py
│   │       ├── incidents.py
│   │       ├── billing.py
│   │       ├── admin.py
│   │       ├── reports.py
│   │       └── health.py
│   ├── parsers/
│   │   ├── ssh_parser.py
│   │   ├── apache_parser.py
│   │   ├── nginx_parser.py
│   │   ├── windows_event_parser.py
│   │   └── generic_syslog_parser.py
│   ├── detection/
│   │   ├── rules_engine.py
│   │   └── scoring.py
│   ├── enrichment/
│   │   ├── abuseipdb.py
│   │   ├── otx.py
│   │   ├── ipinfo.py
│   │   └── worker.py
│   ├── ai/
│   │   └── analyst.py
│   ├── db/
│   │   ├── mongo.py
│   │   └── supabase.py
│   ├── billing/
│   │   └── stripe_handler.py
│   ├── email/
│   │   └── resend_client.py
│   └── middleware/
│       ├── auth.py
│       ├── rbac.py
│       └── rate_limit.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ThreatHunting.jsx
│   │   │   ├── IPIntelligence.jsx
│   │   │   ├── Incidents.jsx
│   │   │   ├── AIAnalyst.jsx
│   │   │   ├── Billing.jsx
│   │   │   ├── Admin.jsx
│   │   │   ├── Login.jsx
│   │   │   └── Signup.jsx
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── api.js
│   │   └── App.jsx
│   ├── tailwind.config.js
│   └── package.json
└── supabase/
    └── schema.sql
```

---

## 12. Database schemas

**Postgres (`supabase/schema.sql`) — key tables:**
```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id),
  org_id uuid references organizations(id),
  full_name text,
  role text not null default 'viewer', -- admin | analyst | viewer
  created_at timestamptz default now()
);

create table detection_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  rule_key text not null,       -- e.g. 'failed_login_count'
  weight integer not null,
  enabled boolean default true
);

create table credits_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  delta integer not null,       -- +100 top-up, -1 per AI report
  reason text not null,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active'
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  actor_id uuid,
  action text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  title text not null,
  severity text not null,       -- LOW | MEDIUM | HIGH | CRITICAL
  status text not null default 'open',
  created_at timestamptz default now()
);

-- Enable RLS on every table above, policy: org_id = current org claim in JWT
```

**MongoDB collections:**
```
raw_logs        { org_id, source_type, filename, uploaded_at, raw_content_ref }
parsed_events   { org_id, source_type, timestamp, src_ip, user, event_type, raw_line }
threat_actors   { org_id, ip, first_seen, last_seen, threat_score, abuseipdb_data, otx_data, geo }
```

---

## 13. Auth / signup / credits / email / payment — how they connect

- **Signup/Login:** Supabase Auth (email+password, email verification
  required). JWT carries `org_id` and `role` as custom claims.
- **Credits:** every org starts with N free credits (e.g. 20). Each AI Analyst
  report costs 1 credit — deduct via `credits_ledger` insert inside the same
  transaction that generates the report. Ingestion and rule-based detection
  are unmetered (that's the free-tier hook; AI is the paid feature).
- **Payment:** Stripe Checkout for plan upgrade → webhook
  (`checkout.session.completed`, `invoice.paid`) → backend verifies signature
  → tops up `credits_ledger` and updates `subscriptions`. Stripe Customer
  Portal for self-serve cancel/upgrade — don't build your own billing UI.
- **Email:** Resend for verification resend, weekly digest of CRITICAL
  incidents, and Stripe invoice receipts.

---

## 14. Git workflow

Before Phase 0 starts: confirm this project has a GitHub repo. If it doesn't
exist yet, create it (private, per your one-repo-per-project rule) and push
the current code as the initial commit before any rebuild work begins.

Commit at the end of every phase after that, not just at the end of the
project — a phase isn't "done" until its test passes AND it's committed:

```
git add -A
git commit -m "Phase N: <what this phase added> — tested: <how you verified it>"
git push
```

`main` branch is fine for solo work — no need for a branch-per-phase workflow
unless you want one. If a phase touches `.env.example`, commit that too;
never commit the real `.env`.

---

## 15. Phase-by-phase build order (with tests)

| Phase | Scope | Test |
|---|---|---|
| 0 | Audit real repo, strip Streamlit + unused deps | `pip list` shows only what's imported |
| 1 | Supabase project + auth + org/role tables + RLS | Sign up, confirm JWT has `org_id`, `role` |
| 2 | FastAPI skeleton + Mongo connection + `/api/v1/health` | `curl localhost:8000/api/v1/health` → 200 |
| 3 | Rebuild 4 parsers as async, write to `parsed_events` | Upload sample `auth.log`, count matches known bad-login lines |
| 4 | Detection engine reading `detection_rules` from Postgres | Feed known brute-force sample, verify CRITICAL alert created |
| 5 | Enrichment worker (AbuseIPDB/OTX/IPInfo) + Redis cache | Enrich same IP twice, second call is cache hit (check latency/log) |
| 6 | Stripe test-mode checkout + webhook + credits ledger | Complete Stripe test checkout, confirm credits increment |
| 7 | Resend email (verify + digest) | Trigger signup, confirm email arrives |
| 8 | React frontend: Login/Signup/Dashboard/Threat Hunting/Incidents | Full login → view dashboard → log out flow in browser |
| 9 | AI Analyst (OpenAI direct, streaming, credit-metered) | Generate 1 report, confirm credit deducted by 1 |
| 10 | Admin panel (users, roles, audit log viewer, billing overview) | Suspend a test user, confirm they can't log in |
| 11 | Security pass: rate limits, RLS verification, audit log coverage check | Attempt cross-org data access, confirm 403 |
| 12 | Deploy | See §15 |

---

## 16. Deployment

```
Frontend   → Vercel                         (React build)
Backend    → Render or Railway              (FastAPI, always-on, no Docker needed —
                                              both support native Python buildpacks)
MongoDB    → MongoDB Atlas (free M0)
Postgres   → Supabase (hosted, includes Auth)
Redis      → Upstash (serverless, free tier)
Email      → Resend
Payments   → Stripe (test mode → live mode after phase 6 passes)
DNS/WAF    → Cloudflare (optional but recommended in front of Vercel/Render)
```

Set `ENVIRONMENT=production` and swap every API key to live mode only after
phase 11's security pass is complete — not before.


