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

1. Open `L-BRAND-001` from the listings dashboard.
2. Review the v1 to v2 listing diff.
3. Click `Run TrustPatrol`.
4. Watch the timeline run `InvestigationAgent` before `AssessmentAgent`.
5. Confirm the risk panel shows `CRITICAL`.
6. Click `Approve AI Action` in the human review panel.

## ADK Mode

Mock playback is the default because it is the most reliable noon demo path.

To try live ADK streaming:

1. Run the backend:

```bash
adk web --port 8001
```

2. Enable `Live ADK` in the frontend header.
3. Click `Run TrustPatrol`.

If live ADK streaming fails, the dashboard falls back to the mocked event playback. ADK Web remains the source-of-truth proof that the real agent runtime works.

## Scope

This frontend intentionally does not include production auth, database persistence, real image recognition, scraping, custom SSE infrastructure, seller graphing, or review fraud analysis.
