# TrustPatrol Frontend Agent

## Mission

Build TrustPatrol as a Trust & Safety / Listing Violation reviewer dashboard.

The product should feel like an operator decision-support system for marketplace enforcement, not an AI experiment. The reviewer should be able to make a faster, safer, defensible decision in about 30 seconds.

Core user questions:

```txt
Can I make a faster, safer enforcement decision?
Can I explain this decision if the seller appeals?
Can I avoid false positives against legitimate sellers?
Can I protect buyers before harm happens?
Can I reduce review queue load?
```

The main idea remains:

```txt
Counterfeit risk is detected by tracking how listings change over time,
not by judging one static snapshot.
```

---

## Primary User

Design first for Trust & Safety / Listing Violation reviewers.

Their job:

```txt
Review flagged listings
Understand why the system flagged them
Decide whether to allow, monitor, request verification, suppress, or escalate
Handle seller appeals
Avoid wrongly punishing legitimate sellers
```

Do not make the interface feel like:

```txt
Look, agents are talking.
```

Make it feel like:

```txt
This system packaged the evidence so I can make and defend a decision quickly.
```

---

## Product Language

Do not use `Multi-Agent Debate` in the product UI.

Use:

```txt
Specialist Evidence Review
```

Internally, the backend may use agents. In the UI, show evidence lanes and a decision summary.

Agent/runtime events may exist, but they should be minimized by default and only expanded when the reviewer wants provenance.

---

## Listing Details Page

The details page is a case file.

Default structure:

```txt
Decision Header
        ↓
Evidence Lanes + Decision Summary
        ↓
Human Review Actions
```

Keep listing context compact. Avoid long transcripts as a primary surface.

### Top Section: Decision Header

Show:

```txt
Listing Risk: CRITICAL
Recommended Action: Temporary Suppression + Human Review
Confidence: 91%
Human Review Required
```

This should be the first thing a reviewer can scan.

### Main Section: Decision Summary

Show reviewer-ready top reasons:

```txt
1. Brand Apple was added after approval.
2. Price dropped 60%.
3. "OEM", "1:1", and "mirror quality" appeared.
4. Product image changed to branded packaging.
5. Seller has prior suspicious edits.
```

Also show:

```txt
policy-grounded judgement
why the recommended action is proportionate
false-positive guardrail language
how seller verification or reviewer override can narrow/reverse action
```

Use careful language. Do not claim the seller is guilty.

### Evidence Lanes

Show these lanes instead of an agent debate:

```txt
Brand & Policy Evidence
Pricing Evidence
Visual Evidence
Seller Trust Evidence
Timeline Evidence
```

Each lane should include:

```txt
lane title
severity
short summary
supporting facts
```

Render evidence lanes as one combined card with a vertical scroll. Each evidence category inside that card should be collapsible. The evidence card should have the main visual weight on the details page. Keep the first/highest-priority lane expanded by default and let reviewers expand the others as needed.

Examples:

```txt
Brand & Policy Evidence
HIGH
Brand Apple was added after approval. Counterfeit-associated terms appeared.

Pricing Evidence
HIGH
Price dropped from $30 to $12, a 60% drop.

Visual Evidence
MEDIUM
Image changed to branded packaging.

Seller Trust Evidence
MEDIUM
Seller account is new / prior flags / repeated edits.

Timeline Evidence
MEDIUM
High-risk changes occurred after approval.
```

### Specialist Evidence Review

Keep the runtime/agent timeline in a small collapsed panel on the left.

Default state:

```txt
collapsed
compact
secondary
```

When expanded, it may show:

```txt
ADK/mock runtime events
tool calls
report generated events
final recommendation event
```

This panel is provenance, not the main product story.

### Human Review And Assessment

Merge human review and assessment reasoning into one compact right-side module. Keep it smaller than the evidence section.

Do not show long reasoning paragraphs here. The evidence lanes should carry the detailed support. The assessment/human decision module should only show:

```txt
risk score
risk level
recommended action
short judgement based on evidence lanes
primary approve action
optional other human decisions
```

Default human decision UI:

```txt
Approve
```

Optional decisions should be tucked behind an expandable `Other human decisions` control:

```txt
Request Seller Verification
Override to Allow
Escalate
Mark False Positive
```

When the reviewer clicks Approve, record `Approve Suppression`.

Store the selected decision in frontend state. No backend persistence is required for the noon MVP.

---

## Listings Overview Page

The overview page remains a queue for newly created or edited listings.

It should support:

```txt
category filters
expected risk filter
changed-field filter
timeframe filter
recommended action filter
seller search
pagination
```

The first screen should be the review queue, not a landing page.

---

## Visual Direction

Use actual Material UI components.

Reference:

```txt
Material UI Minimal Free dashboard style
Shopee-style warm orange accent
dark bold headings
soft white cards
colored rounded tags
clean operator console layout
```

Tags should be visually pleasant and meaningful:

```txt
risk tags
category tags
changed-field tags
evidence-lane severity tags
status tags
```

Prefer icons for navigation controls, with accessible labels and tooltips.

---

## ADK And Fallback

Preferred runtime:

```txt
React Frontend
        ↓
ADK run SSE endpoint
        ↓
TrustPatrolRootAgent
        ↓
InvestigationAgent
        ↓
AssessmentAgent
        ↓
Structured recommendation
```

For demo reliability:

```txt
Use ADK Web to prove the real agent runtime.
Use React mocked event playback to prove the polished product experience.
```

Mock playback should auto-run when a listing details page opens.

---

## Noon Non-Goals

Do not build:

```txt
real Shopee scraping
real image recognition
production auth
production database
real seller history
real Shopee policy integrations
custom SSE infrastructure
seller network graph
multi-agent debate UI
```

Use frontend mock seller-trust evidence for the demo.

---

## Definition Of Done

Frontend MVP is ready when:

```txt
Listings overview exists with filters and pagination.
Opening a listing auto-runs TrustPatrol.
Details page shows a decision header first.
Details page shows evidence lanes.
Details page shows compact policy-grounded judgement.
Details page shows false-positive guardrails.
Evidence lanes are combined into one vertically scrollable card with collapsible sections.
Specialist Evidence Review is collapsed by default.
Human review defaults to one Approve action with other decisions hidden behind expansion.
Brand Injection scenario can be demoed smoothly.
```
