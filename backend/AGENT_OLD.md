
# TrustPatrol Noon MVP

## Project

TrustPatrol is an AI-native marketplace trust-and-safety MVP that detects suspicious listing changes over time.

The key insight:

> Counterfeit listings are often not suspicious at creation time. They become suspicious after approval through edits such as brand injection, price drops, counterfeit keywords, image swaps, and misleading authenticity claims.

TrustPatrol should demonstrate an autonomous investigation workflow:

```txt
Listing version history
        ↓
Change investigation
        ↓
Risk assessment
        ↓
Human-in-the-loop moderation decision
````

The MVP should feel like an AI trust-and-safety operations center, not a chatbot.

---

## Current Hackathon Constraints

We are building for a one-day hackathon.

The noon MVP must be reliable, demoable, and scoped tightly.

We are using:

```txt
Google ADK
ADK web interface / ADK run SSE endpoint
Python agent files
React frontend
Mock listing data
Deterministic tools
Human review UI
```

Do not build custom SSE infrastructure unless ADK SSE cannot be consumed directly.

Prefer ADK’s existing runtime/web/SSE flow.

---

## Explicit Noon Non-Goals

Do NOT build these before the noon MVP works:

```txt
real Shopee scraping
real image recognition
clustering
adaptation layer
trend discovery
candidate rule generation
rule promotion
seller network graph
review integrity agent
multi-agent debate
Kafka / Redis / Celery
production auth
production database
```

These are afternoon stretch goals only.

---

## Target Architecture

Use one root sequential ADK agent.

```txt
React Frontend
        ↓
ADK Web / ADK Run SSE Endpoint
        ↓
TrustPatrolRootAgent
        ↓
InvestigationAgent
        ↓
AssessmentAgent
        ↓
Structured Recommendation
        ↓
Human Review UI
```

The frontend should mainly display:

```txt
ADK SSE events
agent timeline
tool calls
tool outputs
final risk result
human review controls
```

---

## Required Folder Structure

Use this project structure.

```txt
app/
├── agent.py
├── sub_agents/
│   ├── __init__.py
│   ├── investigation_agent.py
│   └── assessment_agent.py
├── tools/
│   ├── __init__.py
│   └── listing_tools.py
├── shared/
│   ├── __init__.py
│   ├── schemas.py
│   └── mock_data.py
└── README.md
```

Optional frontend structure:

```txt
frontend/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── ListingSimulator.tsx
│   │   ├── AgentTimeline.tsx
│   │   ├── RiskPanel.tsx
│   │   ├── EvidencePanel.tsx
│   │   ├── VersionDiff.tsx
│   │   └── HumanReviewPanel.tsx
│   └── lib/
│       ├── adkClient.ts
│       └── mockListings.ts
└── README.md
```

If the repo already has a different structure, preserve it where practical, but keep the logical separation:

```txt
root agent
sub agents
deterministic tools
shared schemas
mock data
frontend components
```

---

# ADK Agent Design

## Root Agent

File:

```txt
app/agent.py
```

Agent name:

```txt
TrustPatrolRootAgent
```

Type:

```txt
SequentialAgent
```

Responsibilities:

```txt
1. Receive a listing timeline.
2. Run InvestigationAgent.
3. Pass investigation output to AssessmentAgent.
4. Return final structured recommendation.
```

The root agent should not perform detailed analysis itself.

It only orchestrates.

Expected shape:

```python
from google.adk.agents import SequentialAgent

from .sub_agents.investigation_agent import investigation_agent
from .sub_agents.assessment_agent import assessment_agent

root_agent = SequentialAgent(
    name="TrustPatrolRootAgent",
    description="Sequential trust-and-safety workflow for investigating suspicious marketplace listing changes.",
    sub_agents=[
        investigation_agent,
        assessment_agent,
    ],
)
```

Adjust imports if the repo’s ADK template uses another import style.

---

## Sub Agent 1 — InvestigationAgent

File:

```txt
app/sub_agents/investigation_agent.py
```

Agent name:

```txt
InvestigationAgent
```

Role:

```txt
Marketplace Trust & Safety Investigator
```

Goal:

```txt
Gather evidence from listing changes.
```

Important:

```txt
The InvestigationAgent does NOT assign final risk.
The InvestigationAgent does NOT recommend enforcement.
The InvestigationAgent only identifies signals and evidence.
```

Use deterministic tools from:

```txt
app/tools/listing_tools.py
```

Tools to attach:

```txt
detect_brand_injection
detect_price_anomaly
detect_counterfeit_keywords
detect_image_swap
detect_post_approval_edit
build_evidence
```

Suggested instruction:

```txt
You are InvestigationAgent for TrustPatrol.

You investigate marketplace listing changes over time.

Your job is to gather evidence only.

Do not assign a final risk score.
Do not recommend enforcement.
Do not claim the seller is guilty.

Use the available tools to inspect:
- brand injection
- price anomalies
- suspicious counterfeit keywords
- image swaps
- post-approval edits

Return structured evidence and detected signals.

Use careful language:
- "risk signal"
- "suspicious"
- "requires review"
- "may indicate"

Do not say:
- "definitely counterfeit"
- "seller is guilty"
```

Expected output schema:

```json
{
  "agent": "InvestigationAgent",
  "status": "completed",
  "signals": {
    "brand_injection": true,
    "brand_added": "Apple",
    "price_drop_pct": 60,
    "counterfeit_keywords": ["OEM", "1:1", "factory batch"],
    "image_swapped": true,
    "post_approval_edit": true
  },
  "evidence": [
    "Brand Apple was added after approval.",
    "Price dropped by 60%.",
    "Counterfeit-associated keywords appeared: OEM, 1:1, factory batch.",
    "Listing image changed after approval."
  ]
}
```

---

## Sub Agent 2 — AssessmentAgent

File:

```txt
app/sub_agents/assessment_agent.py
```

Agent name:

```txt
AssessmentAgent
```

Role:

```txt
Senior Marketplace Risk Analyst
```

Goal:

```txt
Convert investigation evidence into risk score, risk level, confidence, and recommended human-review action.
```

Important:

```txt
AssessmentAgent may recommend action.
AssessmentAgent must not claim final guilt.
AssessmentAgent must preserve human-in-the-loop framing.
```

Suggested instruction:

```txt
You are AssessmentAgent for TrustPatrol.

You receive investigation evidence and detected signals from InvestigationAgent.

Your job is to assess marketplace trust-and-safety risk.

Score risk using this framework:
- Brand injection after approval: +25
- Counterfeit keywords: +25
- Price drop greater than or equal to 50%: +20
- Image swap after approval: +15
- Post-approval edit: +15

Clamp the final score to 100.

Risk levels:
- 0-39: LOW
- 40-69: MEDIUM
- 70-89: HIGH
- 90-100: CRITICAL

Recommended actions:
- LOW: ALLOW
- MEDIUM: MONITOR
- HIGH: REQUEST_VERIFICATION
- CRITICAL: TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW

Use evidence-based language.
Do not say the seller is guilty.
Return structured JSON only.
```

Expected output schema:

```json
{
  "agent": "AssessmentAgent",
  "status": "completed",
  "risk_score": 95,
  "risk_level": "CRITICAL",
  "confidence": 0.91,
  "recommended_action": "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW",
  "reasoning": [
    "Multiple high-risk signals appeared after approval.",
    "Brand injection occurred after approval.",
    "The price dropped significantly.",
    "Counterfeit-associated language was introduced."
  ],
  "human_review_required": true
}
```

---

# Deterministic Tools

File:

```txt
app/tools/listing_tools.py
```

Implement tools as normal Python functions callable by ADK.

Do not use LLM calls inside tools.

The tools should operate on listing versions.

A listing version should contain:

```json
{
  "listing_id": "L-1001",
  "version": 1,
  "status": "approved",
  "title": "Wireless Earbuds Bluetooth 5.0",
  "description": "Good condition wireless earbuds.",
  "brand": null,
  "price": 30,
  "image_id": "generic_earbuds_01",
  "seller_id": "S-1001"
}
```

---

## Tool: detect_brand_injection

Detect whether brand was absent before and present now, or changed to a higher-risk brand.

Return:

```json
{
  "brand_injection": true,
  "brand_added": "Apple",
  "message": "Brand Apple was added after approval."
}
```

---

## Tool: detect_price_anomaly

Detect price drop percentage.

Use previous/current price and first version price if available.

Return:

```json
{
  "price_drop_pct": 60,
  "price_anomaly": true,
  "message": "Price dropped by 60%."
}
```

Threshold:

```txt
price_anomaly = true if price_drop_pct >= 50
```

---

## Tool: detect_counterfeit_keywords

Detect suspicious keywords introduced in title or description.

Keyword list:

```txt
OEM
1:1
1-1
AAA
mirror
mirror quality
factory batch
same production line
replica
authentic grade
original quality
factory direct
no receipt
```

Return:

```json
{
  "counterfeit_keywords": ["OEM", "1:1", "factory batch"],
  "message": "Counterfeit-associated keywords appeared: OEM, 1:1, factory batch."
}
```

---

## Tool: detect_image_swap

Detect whether image ID changed.

Return:

```json
{
  "image_swapped": true,
  "previous_image_id": "generic_earbuds_01",
  "current_image_id": "airpods_branded_box_01",
  "message": "Listing image changed after approval."
}
```

---

## Tool: detect_post_approval_edit

Detect whether an edit happened while listing was already approved.

Return:

```json
{
  "post_approval_edit": true,
  "message": "Listing was edited after approval."
}
```

---

## Tool: build_evidence

Combine tool outputs into a concise evidence list.

Return:

```json
{
  "evidence": [
    "Brand Apple was added after approval.",
    "Price dropped by 60%.",
    "Counterfeit-associated keywords appeared: OEM, 1:1, factory batch.",
    "Listing image changed after approval.",
    "Listing was edited after approval."
  ]
}
```

---

# Shared Schemas

File:

```txt
app/shared/schemas.py
```

Create typed schemas using Pydantic if available.

Minimum models:

```python
class ListingVersion(BaseModel):
    listing_id: str
    version: int
    status: str
    title: str
    description: str
    brand: str | None = None
    price: float
    image_id: str
    seller_id: str

class ListingTimeline(BaseModel):
    listing_id: str
    versions: list[ListingVersion]

class InvestigationSignals(BaseModel):
    brand_injection: bool = False
    brand_added: str | None = None
    price_drop_pct: float = 0
    price_anomaly: bool = False
    counterfeit_keywords: list[str] = []
    image_swapped: bool = False
    post_approval_edit: bool = False

class InvestigationResult(BaseModel):
    agent: str = "InvestigationAgent"
    status: str
    signals: InvestigationSignals
    evidence: list[str]

class AssessmentResult(BaseModel):
    agent: str = "AssessmentAgent"
    status: str
    risk_score: int
    risk_level: str
    confidence: float
    recommended_action: str
    reasoning: list[str]
    human_review_required: bool
```

If Pydantic causes friction, use dataclasses or dictionaries.

Do not block on typing.

---

# Mock Data

File:

```txt
app/shared/mock_data.py
```

Create deterministic demo scenarios.

The frontend and ADK prompt should be able to use these.

---

## Scenario 1 — Safe Listing

Initial:

```json
{
  "listing_id": "L-SAFE-001",
  "version": 1,
  "status": "approved",
  "title": "Uniqlo Airism Cotton T-Shirt",
  "description": "Lightly used. Bought from Uniqlo Singapore.",
  "brand": "Uniqlo",
  "price": 12,
  "image_id": "uniqlo_tshirt_clear_photo",
  "seller_id": "S-SAFE"
}
```

Expected:

```txt
LOW risk
ALLOW
```

---

## Scenario 2 — Brand Injection

Initial:

```json
{
  "listing_id": "L-BRAND-001",
  "version": 1,
  "status": "approved",
  "title": "Wireless Earbuds Bluetooth 5.0",
  "description": "Good condition wireless earbuds.",
  "brand": null,
  "price": 30,
  "image_id": "generic_earbuds_01",
  "seller_id": "S-RISKY-001"
}
```

Update:

```json
{
  "listing_id": "L-BRAND-001",
  "version": 2,
  "status": "approved",
  "title": "Apple AirPods Pro OEM 1:1 Authentic",
  "description": "Factory batch, same production line, mirror quality.",
  "brand": "Apple",
  "price": 12,
  "image_id": "airpods_branded_box_01",
  "seller_id": "S-RISKY-001"
}
```

Expected:

```txt
CRITICAL risk
TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW
```

---

## Scenario 3 — Replica Reveal

Initial:

```json
{
  "listing_id": "L-REPLICA-001",
  "version": 1,
  "status": "approved",
  "title": "Premium Leather Handbag",
  "description": "Stylish leather handbag.",
  "brand": null,
  "price": 180,
  "image_id": "generic_handbag_01",
  "seller_id": "S-RISKY-002"
}
```

Update:

```json
{
  "listing_id": "L-REPLICA-001",
  "version": 2,
  "status": "approved",
  "title": "Luxury Designer Bag 1:1 Mirror Quality AAA",
  "description": "Original quality, factory direct, no receipt.",
  "brand": "Luxury Designer",
  "price": 39,
  "image_id": "designer_bag_packaging_01",
  "seller_id": "S-RISKY-002"
}
```

Expected:

```txt
CRITICAL risk
TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW
```

---

## Scenario 4 — Legitimate Edit

Initial:

```json
{
  "listing_id": "L-LEGIT-001",
  "version": 1,
  "status": "approved",
  "title": "Nike Running Shoes Size 9",
  "description": "Used pair, authentic, normal wear.",
  "brand": "Nike",
  "price": 70,
  "image_id": "nike_shoes_photo_blurry",
  "seller_id": "S-LEGIT-001"
}
```

Update:

```json
{
  "listing_id": "L-LEGIT-001",
  "version": 2,
  "status": "approved",
  "title": "Nike Running Shoes Size US 9",
  "description": "Used pair, authentic, normal wear. Added clearer photo.",
  "brand": "Nike",
  "price": 68,
  "image_id": "nike_shoes_photo_clear",
  "seller_id": "S-LEGIT-001"
}
```

Expected:

```txt
LOW or MEDIUM risk
ALLOW or MONITOR
```

---

# ADK Web / SSE Usage

Prioritize using ADK Web for early testing.

Use the ADK run SSE endpoint as the main runtime interface for the frontend.

Frontend should render stream events as a timeline.

Render at minimum:

```txt
agent started
tool call started
tool call completed
agent completed
final response
```

Do not build a parallel custom streaming system unless absolutely necessary.

If frontend-to-ADK SSE integration is too slow, fallback:

```txt
Use ADK Web directly for agent demonstration
and use React frontend with mocked event playback for judging polish.
```

Document this fallback clearly in README.

---

# Frontend Requirements

The frontend should look like a Trust & Safety operations center.

Build these components:

```txt
ListingSimulator
AgentTimeline
VersionDiff
EvidencePanel
RiskPanel
HumanReviewPanel
```

---

## ListingSimulator

Must support:

```txt
Load demo scenario
Apply suspicious update
Run TrustPatrol
```

It should send the listing timeline to ADK.

---

## AgentTimeline

Display ADK SSE events.

Example UI:

```txt
10:02:01 InvestigationAgent started
10:02:03 detect_brand_injection completed
10:02:04 detect_price_anomaly completed
10:02:05 detect_counterfeit_keywords completed
10:02:06 detect_image_swap completed
10:02:08 AssessmentAgent started
10:02:10 Risk Score: 95
10:02:11 Human Review Required
```

This is the main demo visual.

---

## VersionDiff

Show v1 vs v2.

Highlight changed fields:

```txt
title
description
brand
price
image_id
```

---

## EvidencePanel

Show investigation evidence.

---

## RiskPanel

Show:

```txt
risk_score
risk_level
confidence
recommended_action
reasoning
```

---

## HumanReviewPanel

Buttons:

```txt
Approve AI Action
Override To Allow
Request Verification
Escalate To Investigator
Mark False Positive
```

Store the selected decision in frontend state.

No backend persistence is required for noon.

---

# Codex Implementation Priorities

Build in this order:

```txt
1. app/shared/mock_data.py
2. app/tools/listing_tools.py
3. app/shared/schemas.py
4. app/sub_agents/investigation_agent.py
5. app/sub_agents/assessment_agent.py
6. app/agent.py
7. ADK web test
8. React ListingSimulator
9. React AgentTimeline using ADK SSE
10. VersionDiff + EvidencePanel + RiskPanel
11. HumanReviewPanel
12. README run instructions
```

If blocked on React-to-ADK SSE:

```txt
1. Keep ADK Web working.
2. Mock the same ADK event sequence in React.
3. Make the demo smooth.
4. Document that ADK Web is the source-of-truth agent runtime.
```

---

# 3-Person Team Split

## Person 1 — ADK Agent Owner

Owns:

```txt
app/agent.py
app/sub_agents/
app/tools/
app/shared/schemas.py
ADK Web testing
structured agent outputs
```

Goal:

```txt
TrustPatrolRootAgent works in ADK Web.
```

---

## Person 2 — Frontend / SSE Owner

Owns:

```txt
React dashboard
ADK SSE client
AgentTimeline
VersionDiff
RiskPanel
EvidencePanel
HumanReviewPanel
```

Goal:

```txt
Judges can see the investigation unfold live.
```

---

## Person 3 — Demo / Data / Integration Owner

Owns:

```txt
mock scenarios
demo script
README
fallback event playback
visual polish
pitch flow
integration testing
```

Goal:

```txt
The full demo works even if ADK SSE integration is flaky.
```

---

# Demo Flow

The demo should take under 3 minutes.

Steps:

```txt
1. Load "Brand Injection" scenario.
2. Show safe v1 listing.
3. Apply suspicious v2 update.
4. Click Run TrustPatrol.
5. Timeline streams InvestigationAgent events.
6. Timeline streams tool results.
7. AssessmentAgent returns risk score.
8. RiskPanel shows CRITICAL risk.
9. Human reviewer clicks "Approve AI Action".
10. Explain that TrustPatrol catches harmful post-approval mutation before buyers are exposed.
```

One-line pitch:

```txt
TrustPatrol is an autonomous AI trust-and-safety agent that detects counterfeit risk by monitoring how marketplace listings change over time, not just by analyzing one static snapshot.
```

---

# README Requirements

Create or update README.md with:

```txt
how to install dependencies
how to run ADK Web
how to test TrustPatrolRootAgent
how to run React frontend
how to run the fallback demo
known issues
what is in-scope for noon
what was intentionally cut
```

Also include:

```txt
If ADK Web works but React SSE is flaky, use ADK Web to prove the runtime agent and React mocked timeline to prove the product experience.
```

---

# Noon Definition of Done

The MVP is done when:

```txt
TrustPatrolRootAgent loads in ADK Web.
InvestigationAgent runs.
AssessmentAgent runs.
Tools detect suspicious listing changes.
A critical-risk demo scenario returns the expected result.
Frontend shows listing v1 vs v2.
Frontend shows agent timeline.
Frontend shows evidence.
Frontend shows risk score.
Frontend shows human review controls.
Demo can be completed in under 3 minutes.
```
