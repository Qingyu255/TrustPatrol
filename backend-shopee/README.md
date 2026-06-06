# Copee Demo Backend

Standalone marketplace simulation service for the TrustPatrol demo. It owns the
seller-facing Copee-like listing/profile APIs and triggers the existing ADK
investigation backend whenever listings are created or edited.

Run from the repo root:

```bash
uv run uvicorn shopee_backend.main:app --app-dir backend-shopee --host 127.0.0.1 --port 8000 --reload
```

The service expects the ADK backend to be running separately:

```bash
adk web --port 8001
```

Environment variables:

- `ADK_BASE_URL`, default `http://127.0.0.1:8001`
- `COPEE_CORS_ORIGINS`, comma-separated origins, default local demo ports
- `SHOPEE_CORS_ORIGINS`, legacy alias supported for existing local scripts

Seller-facing endpoints:

- `GET /seller/profile`
- `PATCH /seller/profile`
- `GET /listings`
- `GET /listings/{listing_id}`
- `POST /listings`
- `PATCH /listings/{listing_id}`
