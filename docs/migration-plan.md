# Impact Observatory | مرصد الأثر — Migration Plan

## Migration Type
Controlled in-place replatforming. No repo wipe.

## Execution Summary

### Step 1: Audit ✅
- 112 backend files classified (58 KEEP, 15 REFACTOR, 3 REPLACE, 36 NEW)
- 25 frontend files classified (4 KEEP, 5 REFACTOR, 13 REPLACE, 1 REMOVE, 2 NEW)

### Step 2: Structure Refactor ✅
- Created `schemas/` (12 typed schemas)
- Created `services/` (12 service modules + orchestrator)
- Created `api/v1/` (versioned endpoints)
- Created `i18n/` (bilingual labels)
- Created `rules/` (banking, insurance, regulatory thresholds)
- Created `orchestration/` (run orchestrator alias)
- Created `docs/`, `deployment/`

### Step 3: Product Rename ✅
- main.py title → "Impact Observatory | مرصد الأثر"
- config.py DB name → "impact_observatory"
- README.md → full rewrite
- Frontend package.json → "impact-observatory-frontend"
- Frontend layout.tsx → light theme, new title
- Frontend page.tsx → executive dashboard

### Step 4: Schema Alignment ✅
- 12 Pydantic schemas: Scenario, Entity, Edge, FlowState, FinancialImpact, BankingStress, InsuranceStress, FintechStress, DecisionAction, DecisionPlan, ExplanationPack, RegulatoryState

### Step 5: Backend Services ✅
- 12 services: scenario, physics, propagation, entity_graph, financial, banking, insurance, fintech, decision, explainability, reporting, audit
- Run orchestrator chains all 12
- 28 integration tests passing

### Step 6: UI Redesign ✅
- Tailwind config: dark→light (io-* prefix)
- layout.tsx: bg-gcc-dark → bg-io-bg
- globals.css: dark scrollbar → light theme import
- ExecutiveDashboard.tsx: premium cards, boardroom aesthetic
- page.tsx: scenario selector + dashboard
- Types: observatory.ts with full RunResult typing
- API client: observatory.* endpoints
- i18n: ar.json + en.json

### Step 7: V1 Hormuz ✅
- Hormuz Closure - 14D - Severe produces:
  - $23.50B headline loss
  - Peak Day 5
  - Banking: ELEVATED (0.64)
  - Insurance: ELEVATED (claims 1.58x)
  - 3 prioritized decision actions
  - 20-step bilingual causal chain

### Step 8: Dead Code Archive ✅
- app/globals.css: dark theme replaced with import redirect
- Legacy routes (decision.py, insurance.py, scenarios.py): still mounted for backward compat

## Preserved Infrastructure
- All engine modules (math, math_core, physics, physics_core, scenario, scenario_engine)
- All DB adapters (postgres, neo4j, redis)
- All connectors (conflict, flight, maritime)
- All ORM models
- Seed data
- CRUD routes (flights, vessels)
- Frontend: api.ts, use-api.ts, types/index.ts, providers.tsx

### Step 9: Full Light Theme Migration ✅
- 11 legacy files migrated from gcc-* dark theme to io-* light theme
- control-room/page.tsx: gcc-panel/gcc-border/gcc-accent → io-surface/io-border/io-accent
- components/controls/control-room.tsx: full light theme migration
- entity/[id]/page.tsx: light cards, io-* palette, dashboard nav
- graph-explorer/page.tsx: light canvas (#F8FAFC bg), io-* UI chrome
- scenario-lab/page.tsx: light panels, io-* palette, rounded-xl cards
- panels/scenario-panel.tsx: io-* colors
- panels/impact-panel.tsx: io-* colors
- panels/scientist-bar.tsx: io-* colors
- globe/index.tsx: slate-900 bg for 3D (intentionally dark for space)
- globe/deckgl-overlay.tsx: slate-800 overlay badge
- globe/cesium-globe.tsx: #0f172a (io-primary) for scene background
- Legacy gcc-* tailwind colors REMOVED (0 references remaining)
- types/index.ts: comment updated to "Impact Observatory"
- All "Control Room" nav links → "Dashboard" pointing to /
- All branding: "DC" / "Decision Core" removed, "Impact Observatory" / "مرصد الأثر" throughout

### Step 10: Detail Panels ✅
- Banking detail panel: stress decomposition bars, Basel III metrics, institution table
- Insurance detail panel: ratio gauges with thresholds, IFRS-17 indicators, affected lines table
- Fintech detail panel: metric rings (SVG), platform disruption table
- Decision detail panel: priority formula bars, all actions table, causal chain timeline
- Executive dashboard: clickable sector cards → drill-down navigation
- Tab navigation: Dashboard | Banking | Insurance | Fintech | Decisions
- Back button context-aware (detail → dashboard → scenario selector)

## Deferred Items
- Consolidate engines/math + engines/math_core into single module
- Consolidate engines/physics + engines/physics_core into single module
- Remove services/pipeline.py (after run_orchestrator fully replaces it)
- Remove legacy API routes when frontend fully migrated to v1
- Add PostgreSQL persistence for runs (currently in-memory)
- Add Redis caching for run results
- Frontend: analyst mode content differentiation (currently shows same data, needs role-filtered views)
- Frontend: regulatory brief PDF export
