.PHONY: dev build test lint docker-up docker-down docker-prod \
       seed-policies backend-dev frontend-dev db-migrate clean help

# ── Defaults ────────────────────────────────────────────────────
COMPOSE       = docker compose
COMPOSE_PROD  = $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml
BACKEND_DIR   = apps/backend
FRONTEND_DIR  = apps/frontend

# ── Development ─────────────────────────────────────────────────

dev: ## Start backend + frontend locally (no Docker)
	@echo "Starting backend and frontend..."
	@make -j2 backend-dev frontend-dev

backend-dev: ## Run FastAPI backend with hot reload
	cd $(BACKEND_DIR) && uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev: ## Run Next.js frontend dev server
	cd $(FRONTEND_DIR) && npm run dev

# ── Build ───────────────────────────────────────────────────────

build: ## Build all Docker images
	$(COMPOSE) --profile dev build

build-backend: ## Build backend Docker image only
	$(COMPOSE) --profile dev build backend

build-frontend: ## Build frontend Docker image only
	$(COMPOSE) --profile dev build frontend

# ── Test ────────────────────────────────────────────────────────

test: ## Run all tests
	cd $(BACKEND_DIR) && python -m pytest tests/ -v --tb=short

test-cov: ## Run tests with coverage report
	cd $(BACKEND_DIR) && python -m pytest tests/ -v --tb=short --cov=src --cov-report=term-missing

# ── Lint ────────────────────────────────────────────────────────

lint: ## Run all linters
	cd $(BACKEND_DIR) && ruff check src/ && ruff format --check src/
	cd $(FRONTEND_DIR) && npm run lint

lint-fix: ## Auto-fix lint issues
	cd $(BACKEND_DIR) && ruff check src/ --fix && ruff format src/

# ── Docker (Development) ────────────────────────────────────────

docker-up: ## Start all services in dev mode
	$(COMPOSE) --profile dev up -d

docker-down: ## Stop all services
	$(COMPOSE) --profile dev down

docker-logs: ## Tail all service logs
	$(COMPOSE) --profile dev logs -f

docker-infra: ## Start only infrastructure (postgres, neo4j, redis)
	$(COMPOSE) --profile infra up -d

# ── Docker (Production) ─────────────────────────────────────────

docker-prod: ## Start all services in production mode
	$(COMPOSE_PROD) --profile prod --profile infra up -d

docker-prod-down: ## Stop production services
	$(COMPOSE_PROD) --profile prod --profile infra down

# ── Database ────────────────────────────────────────────────────

db-migrate: ## Run Alembic migrations
	cd $(BACKEND_DIR) && alembic upgrade head

seed-policies: ## Seed policy data
	cd $(BACKEND_DIR) && python -m src.services.seed_runner

# ── Cleanup ─────────────────────────────────────────────────────

clean: ## Remove all containers, volumes, and orphans
	$(COMPOSE) --profile dev down -v --remove-orphans
	$(COMPOSE_PROD) --profile prod down -v --remove-orphans 2>/dev/null || true

# ── Help ────────────────────────────────────────────────────────

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
