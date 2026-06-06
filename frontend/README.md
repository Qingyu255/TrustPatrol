# TrustPatrol Frontend

React dashboard for the TrustPatrol noon MVP.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Demo Path

1. Run the ADK backend and create or edit listings through the seller flow.
2. Open the TrustPatrol frontend.
3. Review the ADK sessions queue.
4. Open a completed session.
5. Confirm the risk, score, recommended action, changed fields, signals, evidence lanes, and enforcement context come from the final `TrustPatrolRootAgent` JSON.
6. Record the human review decision in the right-side decision panel.

## ADK Sessions

The review queue is backed by ADK sessions for the `backend` app and `copee-demo` user.

Run the backend:

```bash
adk web --port 8001
```

The frontend reads `GET /apps/backend/users/copee-demo/sessions`, fetches each session detail, and extracts the final non-partial `TrustPatrolRootAgent` case-file JSON. Mock playback is not used.

## Scope

This frontend intentionally does not include production auth, database persistence, real image recognition, scraping, custom SSE infrastructure, seller graphing, or review fraud analysis.
