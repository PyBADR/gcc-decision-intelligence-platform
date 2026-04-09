# Impact Observatory | مرصد الأثر

Enterprise Decision Intelligence Platform for GCC Financial Markets.

**Live:** [deevo-sim.vercel.app](https://deevo-sim.vercel.app)

## Architecture

```
Frontend (Next.js 15 / Vercel)
       ↓
Unified Decision API (FastAPI)
       ↓
┌──────────┬───────────┬──────────────┬──────────────┬──────────────┐
│  Macro   │  Graph    │  Portfolio   │ Underwriting │   Policy     │
│  Intel   │  Brain    │  Risk        │  Engine      │   Engine     │
└──────────┴───────────┴──────────────┴──────────────┴──────────────┘
       ↓
   Audit Trail (immutable hash chain)
```

**5 Intelligence Layers** fused into a single decision endpoint:

| Layer | Function | Key Output |
|-------|----------|------------|
| Macro Intelligence | GCC regime detection, 21 signal rules | Regime, risk overlay, sector impacts |
| Graph Brain | Entity relationships, risk propagation (BFS) | Systemic risk, critical paths |
| Portfolio Risk | Concentration, HHI, sector exposure | Portfolio health, hotspots |
| Underwriting | Decision, pricing, coverage, conditions | APPROVED / CONDITIONAL / REJECTED |
| Policy Engine | Business rules, versioned governance | Rule overrides, compliance conditions |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (optional)

### Backend

```bash
cd apps/backend
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

API docs: [localhost:8000/docs](http://localhost:8000/docs)

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Dashboard: [localhost:3000](http://localhost:3000)

### Docker (Full Stack)

```bash
cp .env.example .env
docker compose up -d
```

## API Reference

### Unified Decision (Single Brain)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/decision/evaluate` | POST | Full 5-layer decision |
| `/api/v1/decision/batch` | POST | Batch evaluation |
| `/api/v1/decision/quick/{id}` | GET | Quick single-entity |
| `/api/v1/decision/capabilities` | GET | System capabilities |

### Policy Engine

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/policy/policies` | GET/POST | List/create policies |
| `/api/v1/policy/policies/{id}` | GET/PATCH/DELETE | Policy CRUD |
| `/api/v1/policy/policies/{id}/activate` | POST | Activate policy |
| `/api/v1/policy/policies/{id}/rules` | POST | Add rule |
| `/api/v1/policy/evaluate` | POST | Evaluate rules against context |
| `/api/v1/policy/seed` | POST | Seed GCC defaults |
| `/api/v1/policy/statistics` | GET | Engine stats |

### Audit & Governance

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/audit/decisions` | GET | Decision history |
| `/api/v1/audit/decisions/{id}` | GET | Full decision detail |
| `/api/v1/audit/decisions/{id}/trail` | GET | Hash chain audit trail |
| `/api/v1/audit/chain/verify` | GET | Verify chain integrity |
| `/api/v1/audit/statistics` | GET | Aggregate stats |
| `/api/v1/audit/outcomes` | POST | Record outcome |

### Macro Intelligence

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/macro/analyze` | POST | Full macro analysis |
| `/api/v1/macro/portfolio-impact` | POST | Macro-adjusted portfolio |
| `/api/v1/macro/underwriting-context` | POST | Macro context for UW |
| `/api/v1/macro/diagnose` | POST | Indicator diagnostics |
| `/api/v1/macro/indicators` | GET | Indicator metadata |
| `/api/v1/macro/regimes` | GET | Regime types |

### Simulation Engine

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/simulate` | POST | Direct simulation |
| `/api/v1/scenarios` | GET | Scenario templates |
| `/api/v1/runs` | POST | Execute pipeline |

## Decision Flow

```
Input: entity_id + sector + coverage + macro indicators
  ↓
Layer 1: Macro → regime detection → signal generation → sector mapping
  ↓
Layer 2: Graph → risk propagation → critical paths → neighborhood
  ↓
Layer 3: Portfolio → concentration → HHI → systemic hotspots
  ↓
Layer 4: Underwriting → risk fusion → decision → pricing → conditions
  ↓
Layer 5: Policy → rule evaluation → overrides → compliance conditions
  ↓
Output: APPROVED/CONDITIONAL/REJECTED + pricing + coverage + audit hash
  ↓
Audit: immutable hash chain → governance trail
```

## Default GCC Policies

| Policy | Rules | Key Behavior |
|--------|-------|-------------|
| Inflationary Guard | 3 | Reject high-risk, conditional moderate, base surcharge |
| Oil Shock Protection | 2 | Block energy sector, cap coverage 50% |
| High-Risk Sectors | 3 | Real estate, construction, maritime controls |
| Recession Defense | 2 | Reject >0.5 risk, reduce coverage |
| Credit Tightening | 1 | Risk uplift + pricing surcharge |
| Concentration Guard | 2 | Coverage cap, sector overweight |
| Regulatory Compliance | 2 | AML/KYC mandatory, large exposure reporting |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| Frontend | Next.js 15, React 19, TypeScript |
| Visualization | Recharts, D3, Cesium, Deck.gl |
| State | Zustand, TanStack Query |
| Graph DB | Neo4j 5.18 |
| Relational DB | PostgreSQL 16 + PostGIS |
| Cache | Redis 7 |
| Audit | SQLite (local), PostgreSQL (prod) |
| Deployment | Docker, Vercel (frontend), Railway/VPS (backend) |
| CI/CD | GitHub Actions |

## Environment Variables

See [`.env.example`](.env.example) for all configuration options.

**Required for production:**
- `API_KEY` — API authentication key
- `JWT_SECRET_KEY` — JWT signing secret
- `NEXT_PUBLIC_API_URL` — Backend URL for frontend

## Project Structure

```
gcc-decision-intelligence-platform/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── main.py                    # FastAPI entry point
│   │   │   ├── api/v1/                    # REST endpoints
│   │   │   │   ├── unified_decision/      # Single brain API
│   │   │   │   ├── policy/                # Policy CRUD + eval
│   │   │   │   ├── audit/                 # Governance endpoints
│   │   │   │   └── underwriting/          # UW endpoints
│   │   │   ├── core/
│   │   │   │   ├── policy/                # Policy engine
│   │   │   │   └── audit/                 # Audit system
│   │   │   ├── macro_intelligence/        # 7 macro modules
│   │   │   ├── graph_brain/               # Graph + risk engines
│   │   │   └── simulation_engine.py       # 8 scenario templates
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── frontend/
│       ├── src/
│       │   ├── app/                       # Next.js pages
│       │   │   ├── audit-dashboard/       # Governance dashboard
│       │   │   ├── control-room/          # Operations center
│       │   │   ├── graph-explorer/        # Graph visualization
│       │   │   └── scenario-lab/          # Simulation lab
│       │   ├── services/                  # API clients
│       │   │   ├── decision-api.ts        # Unified decision
│       │   │   ├── policy-api.ts          # Policy engine
│       │   │   ├── macro-api.ts           # Macro intelligence
│       │   │   ├── audit-api.ts           # Audit trail
│       │   │   └── platform-api.ts        # Health/version
│       │   └── components/                # React components
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml
├── .github/workflows/
└── .env.example
```

## License

Proprietary. All rights reserved.
