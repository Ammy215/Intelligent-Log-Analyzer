# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cybersecurity log analysis platform: FastAPI + MongoDB backend, React frontend. Ingests logs (SSH, Apache, Windows EVTX), parses and stores them, scores/analyzes threats, enriches with threat intel (AbuseIPDB, OTX, geolocation), and exposes an AI security analyst (OpenAI, called directly — no LangChain).

Actively being rebuilt toward a multi-tenant, enterprise-grade version (auth, RBAC, billing, async ingestion). Phase 0 (repo cleanup) is complete; later phases are unstarted as of this writing.

## Commands

Backend (from `backend/`):
```
uvicorn main:app --reload --port 8000
```
API docs at `http://localhost:8000/docs`.

Frontend (from `frontend/`):
```
npm run dev       # Vite dev server, http://localhost:5173
npm run build
npm run preview
```

Both at once: `START_ALL.bat` (runs `uvicorn main:app` + `npm run dev`).

Dependencies: `pip install -r requirements.txt` (repo root); `npm install` in `frontend/`. MongoDB must be running locally (`mongodb://localhost:27017`, db `log_analyzer`) — configured via `backend/config.py` / `.env` (copy from `.env.example`).

There is no test suite and no lint script configured in this repo (neither `requirements.txt` nor `frontend/package.json` declare one).

## Architecture

**Backend entry point**: `backend/main.py` is the only one — it registers `routers/{logs,analysis,incidents,reports}.py`, uses `database.py`'s `DatabaseManager` for the Motor connection, and reads config from `config.py`'s `Settings`. (Phase 0 removed three earlier standalone rebuilds — `simple_main.py`, `working_main.py`, `production_main.py` — that hand-rolled their own app/DB/endpoints instead of using this pattern; both `START_ALL.bat` and `START_BACKEND.bat` now correctly launch `main.py`.)

**Backend structure** (`backend/`): `routers/` (API endpoints by domain) → `analyzers/` (`threat_scorer.py`, `anomaly_detector.py`, `pattern_matcher.py`, `enterprise_threat_engine.py`) and `parsers/` (`ssh_parser.py`, `apache_parser.py`, `base_parser.py`) for log ingestion/scoring logic → `threat_intel/` for external enrichment (AbuseIPDB, OTX, geolocation, IP profiling, with a `cache.py`) → `models/` for Pydantic document models (`log_entry.py`, `incident.py`) → `report_generator/` (includes `ai_client.py`, a direct `aiohttp` client for the OpenAI API — no LangChain). `integrations/`, `utils/`, and `schemas/` exist but are currently empty.

**Two threat-scoring implementations coexist, unreconciled**: `analyzers/threat_scorer.py` (simple weighted-dict scoring, canonical `THREAT_WEIGHTS`) and `analyzers/enterprise_threat_engine.py` (newer, async, MITRE ATT&CK-mapped). Neither has been designated "the" engine yet — that decision is deferred to a later rebuild phase. Don't assume one supersedes the other without checking which routers actually call which. As of the pre-deploy cleanup pass, `analyzers/enterprise_threat_engine.py` and `threat_intel/enterprise_threat_intel.py` are not imported by any router or by `main.py` — they're fully-formed but currently orphaned modules, not partially-wired ones.

**Known unused-but-live endpoints**: `routers/reports.py`'s `/reports/remediation` and `/reports/health` are registered and reachable, and `frontend/src/lib/api.js` even wraps them (`reportsAPI.generateRemediationPlan`, `reportsAPI.checkHealth`), but no page currently calls either wrapper. Same treatment as the dual threat-engine note above: not dead code, just not wired to any UI yet — check before assuming either is safe to remove or is actually reachable from the product.

**Frontend** (`frontend/`): React 18 + Vite + Tailwind SPA with hand-built UI primitives (`components/ui/`: `Card`, `Button`, `Badge`, etc.) — no Radix UI or component library in actual use, despite the dependency having been listed in `package.json` at one point. This is the active dashboard — there is no Streamlit dashboard anymore (the empty `dashboard/` scaffold was removed in Phase 0). Pages under `src/pages/`: Overview, LiveFeed, ThreatHunting, Incidents, AttackMap, IPIntelligence, AIAnalyst, Reports, Settings. Uses `@tanstack/react-query` for data fetching, `recharts` for charts, `react-leaflet` for the attack map.

**Known gap**: `config.py`'s default `allowed_origins` (and `.env.example`'s `ALLOWED_ORIGINS`) don't include `http://localhost:5173`, the Vite dev server's actual port — only `8501` (old Streamlit port) and `3000`. CORS will block the real frontend from talking to the backend until `.env` is updated to include `5173`.

Root previously had 13 stale status/summary markdown files from prior rebuild iterations; these were removed in Phase 0. `README.md` and this file are now the source of truth — keep both current as the rebuild progresses.
