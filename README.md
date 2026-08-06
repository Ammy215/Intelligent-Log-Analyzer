# Intelligent Log Analyzer

A cybersecurity log analysis platform. Ingests logs (SSH, Apache, Windows EVTX), stores them in MongoDB, scores threats, detects anomalies and attack patterns, enriches findings with external threat intelligence (AbuseIPDB, OTX, IP geolocation), and generates AI-assisted security reports.

This repo is mid-rebuild toward a multi-tenant, enterprise-grade version (auth, RBAC, billing) — see `CLAUDE.md` for the current architecture notes an AI coding assistant needs, including known rough edges.

## Stack

- **Backend**: FastAPI (async), Motor (async MongoDB driver), Pydantic v2
- **Database**: MongoDB
- **Frontend**: React 18 + Vite + Tailwind + Radix UI, charts via Recharts, map via Leaflet
- **AI**: OpenAI API called directly via `aiohttp` (no LangChain)
- **Threat intel**: AbuseIPDB, AlienVault OTX, IP geolocation

## Requirements

- Python 3.10+
- Node.js (for the frontend)
- MongoDB running locally (or a connection string to a remote instance)

## Setup

```bash
# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..

# Environment
cp .env.example .env
# edit .env: add API keys (AbuseIPDB, OTX, IPGeo, OpenAI) if you want those features live
```

Start MongoDB (must be running before the backend starts):

```bash
mongod
```

## Running locally

Backend (from `backend/`):

```bash
uvicorn main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

Frontend (from `frontend/`):

```bash
npm run dev
```

- Dashboard: `http://localhost:5173`

Or start both at once with `START_ALL.bat` (Windows).

## Trying it out

Sample logs are in `sample_logs/` (`auth.log`, `access.log`) and at the repo root (`sample_apache.log`, `sample_ssh.log`).

```bash
curl -X POST "http://localhost:8000/api/v1/logs/upload" \
  -H "accept: application/json" \
  -F "file=@sample_logs/auth.log"

curl "http://localhost:8000/api/v1/logs/"
```

## Project layout

```
backend/
├── main.py              # FastAPI app (entry point)
├── config.py             # Settings, loaded from .env
├── database.py            # MongoDB connection management
├── routers/               # API endpoints: logs, analysis, incidents, reports
├── parsers/                # Log format parsers (SSH, Apache, ...)
├── analyzers/               # Threat scoring, anomaly detection, pattern matching
├── threat_intel/             # AbuseIPDB / OTX / geolocation clients + cache
├── report_generator/          # AI-generated report/summary text
└── models/                     # Pydantic document models

frontend/
└── src/
    ├── pages/            # Overview, Live Feed, Threat Hunting, Incidents,
    │                     # Attack Map, IP Intelligence, AI Analyst, Reports, Settings
    └── components/
```

See `CLAUDE.md` for architecture notes, gotchas, and conventions relevant to making changes in this codebase.
