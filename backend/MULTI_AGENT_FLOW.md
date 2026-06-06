# TrustPatrol Multi-Agent Flow

TrustPatrol is a controlled multi-agent workflow. The root agent owns the full
case flow, but delegates evidence gathering to specialist agents only when the
router says they are needed.

## Agent Tree

```text
TrustPatrolRootAgent
├── TimelineDiffAgent
├── InvestigationRouterAgent
│   ├── BrandProtectionAgent
│   ├── PricingAgent
│   ├── VisualEvidenceAgent
│   ├── SellerTrustAgent
│   └── ReviewIntegrityAgent
├── LeadAdjudicatorAgent
└── EnforcementActionAgent
```

## Core Logic

`TrustPatrolRootAgent` is the entrypoint ADK loads from `backend/agent.py`. It
takes the user prompt, extracts the JSON case, and runs the workflow in order.

`TimelineDiffAgent` computes structured timeline signals from the listing
versions: title changes, brand injection, price changes, image changes, seller
metadata, review metadata, and visual metadata.

`InvestigationRouterAgent` decides which specialist lanes are relevant. The
routing itself is deterministic so the demo is stable, but it also adds LLM
analysis explaining the routing rationale.

The specialist agents are lightweight tool-using agents. Each one runs its
dedicated deterministic tools first, then makes one bounded OpenAI call to turn
those tool outputs into analyst-quality evidence. This avoids ADK tool-loop
stalls while still giving visible tool traces and LLM specialist reasoning.

## Specialist Agents

`BrandProtectionAgent`

Checks brand injection, luxury/counterfeit wording, and suspicious
title/description edits.

`PricingAgent`

Checks post-approval price drops and price anomaly signals.

`VisualEvidenceAgent`

Checks image swap, brand logo, packaging, and visual drift metadata.

`SellerTrustAgent`

Checks seller age, prior flags, and listing velocity.

`ReviewIntegrityAgent`

Checks generic-review ratio and review burst metadata.

## Expected Flow

For a high-risk case, the flow should look like this:

```text
User submits JSON case
↓
TrustPatrolRootAgent extracts case
↓
TimelineDiffAgent computes structured signals
↓
InvestigationRouterAgent builds routing plan
↓
Router invokes selected specialists only
↓
Each selected specialist runs tools + one LLM evidence summary
↓
LeadAdjudicatorAgent produces final risk decision
↓
EnforcementActionAgent produces action log
↓
Root agent returns final structured JSON
```

## Example: Full Luxury Counterfeit-Risk Case

`TimelineDiffAgent`

Detects a major edit from a generic handbag to a luxury designer bag.

`InvestigationRouterAgent`

Invokes:

- `BrandProtectionAgent`
- `PricingAgent`
- `VisualEvidenceAgent`
- `SellerTrustAgent`
- `ReviewIntegrityAgent`

`BrandProtectionAgent`

Finds brand injection and counterfeit-style language such as `1:1`, `AAA`, and
`factory direct`.

`PricingAgent`

Finds a sharp price drop from `180` to `39`.

`VisualEvidenceAgent`

Finds the image changed to branded packaging with logo and packaging metadata.

`SellerTrustAgent`

Finds a young seller account, prior flags, and high listing velocity.

`ReviewIntegrityAgent`

Finds a high generic review ratio and review burst.

`LeadAdjudicatorAgent`

Combines signals into `CRITICAL` risk.

`EnforcementActionAgent`

Outputs `TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW`.

## Example: Price Drop Only

For a simpler price-drop-only case:

```text
TimelineDiffAgent
Detects price dropped significantly.

InvestigationRouterAgent
Invokes only:
- PricingAgent

Skipped:
- BrandProtectionAgent
- VisualEvidenceAgent
- SellerTrustAgent
- ReviewIntegrityAgent

LeadAdjudicatorAgent
Returns MEDIUM risk.

EnforcementActionAgent
Returns MONITOR.
```

## Design Principle

The router controls which specialists run, and specialists do not decide final
enforcement. They only produce evidence.

The final decision always comes from `LeadAdjudicatorAgent`, and the final
action always comes from `EnforcementActionAgent`.
