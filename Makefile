SHELL := /bin/bash

ADK_PORT ?= 8001
SHOPEE_BACKEND_PORT ?= 8000
SHOPEE_FRONTEND_PORT ?= 5173
TRUSTPATROL_FRONTEND_PORT ?= 5174

.PHONY: help install dev dev-backends dev-frontends backend-adk backend-shopee frontend-shopee frontend-trustpatrol check

help:
	@echo "TrustPatrol dev commands"
	@echo ""
	@echo "  make install              Install Python and frontend dependencies"
	@echo "  make dev                  Start both backends and both frontends"
	@echo "  make dev-backends         Start ADK backend + Shopee backend"
	@echo "  make dev-frontends        Start Shopee frontend + TrustPatrol frontend"
	@echo "  make backend-adk          Start Google ADK backend on $(ADK_PORT)"
	@echo "  make backend-shopee       Start Shopee API backend on $(SHOPEE_BACKEND_PORT)"
	@echo "  make frontend-shopee      Start Shopee seller frontend on $(SHOPEE_FRONTEND_PORT)"
	@echo "  make frontend-trustpatrol Start TrustPatrol reviewer frontend on $(TRUSTPATROL_FRONTEND_PORT)"
	@echo "  make check                Run backend contract check"

install:
	uv sync
	npm --prefix frontend install
	npm --prefix frontend-shopee install

dev:
	$(MAKE) -j4 backend-adk backend-shopee frontend-shopee frontend-trustpatrol

dev-backends:
	$(MAKE) -j2 backend-adk backend-shopee

dev-frontends:
	$(MAKE) -j2 frontend-shopee frontend-trustpatrol

backend-adk:
	./.venv/bin/adk web --port $(ADK_PORT)

backend-shopee:
	ADK_BASE_URL=http://127.0.0.1:$(ADK_PORT) uv run uvicorn shopee_backend.main:app --app-dir backend-shopee --host 127.0.0.1 --port $(SHOPEE_BACKEND_PORT) --reload

frontend-shopee:
	VITE_SHOPEE_API_BASE=http://127.0.0.1:$(SHOPEE_BACKEND_PORT) npm --prefix frontend-shopee run dev -- --host 127.0.0.1 --port $(SHOPEE_FRONTEND_PORT)

frontend-trustpatrol:
	VITE_ADK_PROXY_TARGET=http://127.0.0.1:$(ADK_PORT) npm --prefix frontend run dev -- --host 127.0.0.1 --port $(TRUSTPATROL_FRONTEND_PORT)

check:
	./.venv/bin/python backend/scripts/casefile_contract_check.py
