# TrustPatrol
Sea x OpenAI Regional Codex Hackathon - Singapore

TrustPatrol is an autonomous marketplace trust-and-safety agent that detects
counterfeit risk by monitoring how listings change over time, not just by
analyzing one static snapshot.

## Quick Start
```bash
# create your virtual environment
python -m venv .venv
# For unix based systems:
source .venv/bin/activate
# For windows
.venv/Scripts/Activate

# if you dont have uv installed
pip install uv

# Install Python Packages
uv sync

# Configure your OpenAI API key
cp backend/.env.example backend/.env
# then edit backend/.env and set OPENAI_API_KEY

# If you wanna add a new package
uv add <your-package>


# Run the ADK web interface directly
make backend-adk

# View Backend API docs:
http://localhost:8001/docs
```

The ADK dev UI loads the `backend` app. Its `TrustPatrolRootAgent` is a
sequential ADK workflow backed by OpenAI through ADK's LiteLLM connector.
Change `OPENAI_MODEL` in `backend/.env` if you want to use a different OpenAI
model.

## Demo Architecture

The repo now has three independently runnable pieces:

- `backend/`: ADK TrustPatrol investigation workflow.
- `backend-shopee/`: Shopee-style marketplace API that owns listing mutations
  and automatically starts TrustPatrol investigations.
- `frontend-shopee/`: Vite React Shopee-like seller UI that only talks to
  `backend-shopee`.

Run the full demo with one command:

```bash
make install
make dev
```

Open:

```txt
Shopee seller frontend:   http://127.0.0.1:5173
TrustPatrol reviewer UI:  http://127.0.0.1:5174
Shopee backend API:       http://127.0.0.1:8000
ADK web / backend API:    http://127.0.0.1:8001
```

In the Shopee frontend, the seller can view their dashboard, create products,
edit products, inspect product details, view their shop profile, and edit shop
profile details. Listing `POST` and `PATCH` requests still trigger the ADK
TrustPatrol workflow through `backend-shopee`, but the seller website does not
show TrustPatrol timeline internals.

Useful Makefile targets:

```bash
make dev                  # start both backends and both frontends
make dev-backends         # start ADK backend + Shopee backend
make dev-frontends        # start both Vite frontends
make backend-adk          # start ADK backend on 8001
make backend-shopee       # start Shopee backend on 8000
make frontend-shopee      # start Shopee seller frontend on 5173
make frontend-trustpatrol # start TrustPatrol reviewer frontend on 5174
make check                # run backend case-file contract check
```

## ADK Web Litmus Test

Run:

```bash
make backend-adk
```

Open:

```txt
http://127.0.0.1:8001
```

Select the `backend` app and paste scenarios from `backend/LITMUS_TEST.MD`:

```txt
Investigate this listing timeline and return structured JSON.

Timeline:
[v1 JSON]
[v2 JSON]
```

The most important path is the Brand Injection scenario. It should produce
`CRITICAL`, score `90-100`, action
`TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW`, and evidence mentioning brand added
after approval, price drop, counterfeit keywords, and image swap.

## Curl SSE Test

Create a session:

```bash
curl -s -X POST \
  http://127.0.0.1:8001/apps/backend/users/litmus/sessions \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"litmus-brand-injection"}'
```

Run the agent:

```bash
curl -N -X POST http://127.0.0.1:8001/run_sse \
  -H 'Content-Type: application/json' \
  -d '{
    "app_name": "backend",
    "user_id": "litmus",
    "session_id": "litmus-brand-injection",
    "streaming": true,
    "new_message": {
      "role": "user",
      "parts": [{
        "text": "Investigate this listing timeline and return structured JSON.\n\nTimeline:\n{\"listing_id\":\"L-BRAND-001\",\"version\":1,\"status\":\"approved\",\"title\":\"Wireless Earbuds Bluetooth 5.0\",\"description\":\"Good condition wireless earbuds.\",\"brand\":null,\"price\":30,\"image_id\":\"generic_earbuds_01\",\"seller_id\":\"S-RISKY-001\"}\n{\"listing_id\":\"L-BRAND-001\",\"version\":2,\"status\":\"approved\",\"title\":\"Apple AirPods Pro OEM 1:1 Authentic\",\"description\":\"Factory batch, same production line, mirror quality.\",\"brand\":\"Apple\",\"price\":12,\"image_id\":\"airpods_branded_box_01\",\"seller_id\":\"S-RISKY-001\"}"
      }]
    }
  }'
```

## Known Issues

- Assessment scoring is LLM-instructed by design, so final score wording may vary
  slightly. The deterministic investigation tools provide the source evidence.
- Image evidence is mocked as `image_id` changes, not real image files or vision
  model output. This keeps the noon MVP focused on post-approval listing drift.
- No production database, auth, scraping, image recognition, or frontend is in
  scope for this backend-only MVP.
