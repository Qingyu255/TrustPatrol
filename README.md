# TrustPatrol
Sea x OpenAI Regional Codex Hackathon - Singapore

TrustPatrol is an autonomous marketplace trust-and-safety agent that detects
counterfeit risk by monitoring how listings change over time, not just by
analyzing one static snapshot.

## Quick Start
```bash
# if you dont have uv installed
pip install uv

# Install Python Packages
uv sync

# Configure your OpenAI API key
cp backend/.env.example backend/.env
# then edit backend/.env and set OPENAI_API_KEY

# If you wanna add a new package
uv add <your-package>


# Run with web interface which also spins up the fast api server
adk web --port 8001

# View Backend API docs:
http://localhost:8001/docs
```

The ADK dev UI loads the `backend` app. Its `TrustPatrolRootAgent` is a
sequential ADK workflow backed by OpenAI through ADK's LiteLLM connector.
Change `OPENAI_MODEL` in `backend/.env` if you want to use a different OpenAI
model.

## Backend Scope

This MVP is backend-only for now:

- `InvestigationAgent` calls deterministic listing-change tools.
- `AssessmentAgent` uses prompt-instructed risk scoring from `backend/AGENT.md`.
- ADK Web and `/run_sse` are the source-of-truth demo surfaces.
- React frontend work is intentionally deferred.

## ADK Web Litmus Test

Run:

```bash
adk web --port 8001
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
