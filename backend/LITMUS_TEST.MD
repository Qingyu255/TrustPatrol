# TrustPatrol Phase 2 Litmus Test

The goal is to verify that TrustPatrol behaves like a Shopee Trust & Safety case-file system.

Do not test everything.

Test whether the system can:

1. Route to the right specialist agents
2. Skip irrelevant agents with reasons
3. Produce useful evidence cards
4. Avoid over-enforcement on weak evidence
5. Produce a defensible final human-review recommendation
```

---

# 1. Legitimate edit should not trigger unnecessary agents

## Input

```json
{
  "listing_id": "L-LEGIT-001",
  "timeline": [
    {
      "version": 1,
      "status": "approved",
      "title": "Nike Running Shoes Size 9",
      "description": "Used pair, authentic, normal wear.",
      "brand": "Nike",
      "price": 70,
      "image_id": "nike_shoes_photo_blurry",
      "seller_id": "S-LEGIT-001"
    },
    {
      "version": 2,
      "status": "approved",
      "title": "Nike Running Shoes Size US 9",
      "description": "Used pair, authentic, normal wear. Added clearer photo.",
      "brand": "Nike",
      "price": 68,
      "image_id": "nike_shoes_photo_clear",
      "seller_id": "S-LEGIT-001"
    }
  ],
  "seller_profile": {
    "seller_id": "S-LEGIT-001",
    "seller_age_days": 900,
    "prior_flags": 0,
    "similar_listing_count_24h": 1
  },
  "review_profile": {
    "avg_rating": 4.8,
    "review_count": 82,
    "generic_review_ratio": 0.12,
    "review_burst_detected": false
  },
  "image_metadata": {
    "previous_image_id": "nike_shoes_photo_blurry",
    "current_image_id": "nike_shoes_photo_clear",
    "image_changed": true,
    "contains_brand_logo": false,
    "contains_packaging": false,
    "image_category": "running_shoes"
  }
}
```

## Expected

```txt
Router:
- Should skip most specialist agents
- VisualEvidenceAgent may be invoked only as LOW risk, or skipped as benign clearer photo
- PricingAgent should be skipped
- SellerTrustAgent should be skipped
- ReviewIntegrityAgent should be skipped

Final:
Risk: LOW
Action: ALLOW
Evidence: should mention benign edit / minor price change / trusted seller
```

## What this tests

```txt
The system is not paranoid.
The router avoids unnecessary investigation.
The final decision protects honest sellers from over-enforcement.
```

---

# 2. Full luxury counterfeit-risk mutation should become critical

## Input

```json
{
  "listing_id": "L-LUX-001",
  "timeline": [
    {
      "version": 1,
      "status": "approved",
      "title": "Premium Leather Handbag",
      "description": "Stylish leather handbag in good condition.",
      "brand": null,
      "price": 180,
      "image_id": "generic_handbag_01",
      "seller_id": "S-RISKY-001"
    },
    {
      "version": 2,
      "status": "approved",
      "title": "Luxury Designer Bag 1:1 Mirror Quality AAA",
      "description": "Original quality, factory direct, no receipt.",
      "brand": "Luxury Designer",
      "price": 39,
      "image_id": "designer_bag_packaging_01",
      "seller_id": "S-RISKY-001"
    }
  ],
  "seller_profile": {
    "seller_id": "S-RISKY-001",
    "seller_age_days": 8,
    "prior_flags": 3,
    "similar_listing_count_24h": 12
  },
  "review_profile": {
    "avg_rating": 4.9,
    "review_count": 128,
    "generic_review_ratio": 0.72,
    "review_burst_detected": true
  },
  "image_metadata": {
    "previous_image_id": "generic_handbag_01",
    "current_image_id": "designer_bag_packaging_01",
    "image_changed": true,
    "contains_brand_logo": true,
    "contains_packaging": true,
    "image_category": "luxury_bag_packaging"
  }
}
```

## Expected

```txt
Router:
Invoke:
- BrandProtectionAgent
- PricingAgent
- VisualEvidenceAgent
- SellerTrustAgent
- ReviewIntegrityAgent

Final:
Risk: CRITICAL
Score: 85–100
Action: TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW

Evidence must mention:
- brand/luxury positioning added after approval
- 1:1 / mirror quality / AAA / factory direct / no receipt
- 78% price drop
- image changed to branded packaging
- seller has prior flags or high listing velocity
- review burst or generic review ratio

LeadAdjudicator:
- Must cite multiple independent evidence lanes
- Must explain that visual evidence is not used alone
```

## What this tests

```txt
The full specialist system works.
The router invokes all relevant agents.
The final action is defensible because multiple evidence lanes agree.
```

---

# 3. Image-only suspicious edit should trigger visual route but not over-enforce

## Input

```json
{
  "listing_id": "L-IMAGE-001",
  "timeline": [
    {
      "version": 1,
      "status": "approved",
      "title": "Sports Shoes",
      "description": "Comfortable running shoes.",
      "brand": null,
      "price": 45,
      "image_id": "generic_shoes_01",
      "seller_id": "S-IMAGE-001"
    },
    {
      "version": 2,
      "status": "approved",
      "title": "Sports Shoes",
      "description": "Comfortable running shoes.",
      "brand": null,
      "price": 45,
      "image_id": "branded_luxury_shoes_box_01",
      "seller_id": "S-IMAGE-001"
    }
  ],
  "seller_profile": {
    "seller_id": "S-IMAGE-001",
    "seller_age_days": 120,
    "prior_flags": 0,
    "similar_listing_count_24h": 1
  },
  "review_profile": {
    "avg_rating": 4.6,
    "review_count": 35,
    "generic_review_ratio": 0.18,
    "review_burst_detected": false
  },
  "image_metadata": {
    "previous_image_id": "generic_shoes_01",
    "current_image_id": "branded_luxury_shoes_box_01",
    "image_changed": true,
    "contains_brand_logo": true,
    "contains_packaging": true,
    "image_category": "branded_shoes_packaging"
  }
}
```

## Expected

```txt
Router:
Invoke:
- VisualEvidenceAgent
- BrandProtectionAgent or TimelineDiffAgent

Skip:
- PricingAgent, because price did not change
- SellerTrustAgent, unless seller metadata is suspicious
- ReviewIntegrityAgent, because no review anomaly exists

Final:
Risk: MEDIUM or HIGH
Action: REQUEST_VERIFICATION
Not: TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW

Evidence must mention:
- image changed after approval
- new image appears to contain branded packaging/logo
- title and price stayed mostly unchanged
- visual evidence alone is insufficient for suppression
```

## What this tests

```txt
The system catches image-based behavioral drift.
The router avoids irrelevant agents.
The adjudicator does not over-enforce from one moderate-confidence visual signal.
```

---

# 4. Price-drop-only case should not become critical

## Input

```json
{
  "listing_id": "L-PRICE-001",
  "timeline": [
    {
      "version": 1,
      "status": "approved",
      "title": "Leather Wallet",
      "description": "Used leather wallet in good condition.",
      "brand": null,
      "price": 120,
      "image_id": "wallet_photo_01",
      "seller_id": "S-PRICE-001"
    },
    {
      "version": 2,
      "status": "approved",
      "title": "Leather Wallet",
      "description": "Used leather wallet in good condition. Clearance sale.",
      "brand": null,
      "price": 45,
      "image_id": "wallet_photo_01",
      "seller_id": "S-PRICE-001"
    }
  ],
  "seller_profile": {
    "seller_id": "S-PRICE-001",
    "seller_age_days": 600,
    "prior_flags": 0,
    "similar_listing_count_24h": 1
  },
  "review_profile": {
    "avg_rating": 4.7,
    "review_count": 50,
    "generic_review_ratio": 0.2,
    "review_burst_detected": false
  },
  "image_metadata": {
    "previous_image_id": "wallet_photo_01",
    "current_image_id": "wallet_photo_01",
    "image_changed": false,
    "contains_brand_logo": false,
    "contains_packaging": false,
    "image_category": "wallet"
  }
}
```

## Expected

```txt
Router:
Invoke:
- PricingAgent

Skip:
- VisualEvidenceAgent
- BrandProtectionAgent
- SellerTrustAgent
- ReviewIntegrityAgent

Final:
Risk: MEDIUM
Action: MONITOR or REQUEST_VERIFICATION

Evidence must mention:
- large price drop
- no brand injection
- no image swap
- no suspicious seller/review signals

Must not recommend:
- temporary suppression
- escalation
```

## What this tests

```txt
The system understands proportionality.
A single pricing signal should not trigger harsh enforcement.
```

---

# 5. Review-abuse case should route to review + seller agents

## Input

```json
{
  "listing_id": "L-REVIEW-001",
  "timeline": [
    {
      "version": 1,
      "status": "approved",
      "title": "Luxury Watch Strap",
      "description": "Watch strap compatible with many watches.",
      "brand": null,
      "price": 35,
      "image_id": "watch_strap_01",
      "seller_id": "S-REVIEW-001"
    },
    {
      "version": 2,
      "status": "approved",
      "title": "Luxury Watch Strap",
      "description": "Watch strap compatible with many watches.",
      "brand": null,
      "price": 35,
      "image_id": "watch_strap_01",
      "seller_id": "S-REVIEW-001"
    }
  ],
  "seller_profile": {
    "seller_id": "S-REVIEW-001",
    "seller_age_days": 20,
    "prior_flags": 1,
    "similar_listing_count_24h": 9
  },
  "review_profile": {
    "avg_rating": 5.0,
    "review_count": 220,
    "generic_review_ratio": 0.83,
    "review_burst_detected": true
  },
  "image_metadata": {
    "previous_image_id": "watch_strap_01",
    "current_image_id": "watch_strap_01",
    "image_changed": false,
    "contains_brand_logo": false,
    "contains_packaging": false,
    "image_category": "watch_accessory"
  }
}
```

## Expected

```txt
Router:
Invoke:
- ReviewIntegrityAgent
- SellerTrustAgent

Skip:
- PricingAgent
- VisualEvidenceAgent
- BrandProtectionAgent

Final:
Risk: MEDIUM or HIGH
Action: MONITOR or REQUEST_VERIFICATION

Evidence must mention:
- high generic review ratio
- review burst
- new seller or prior flag
- high similar listing velocity

Must not say:
- reviews are fake
- seller is guilty
```

## What this tests

```txt
The system supports adjacent Shopee abuse cases beyond counterfeit.
The router chooses review/seller evidence lanes without forcing brand or image analysis.
```

---

# Phase 2 Pass/Fail Checklist

Your system passes if:

```txt
Router behavior:
[ ] Invokes relevant agents
[ ] Skips irrelevant agents
[ ] Explains why each agent was selected or skipped

Specialist evidence:
[ ] Each specialist returns parseable JSON
[ ] Each specialist has risk_level, confidence, evidence, uncertainty
[ ] VisualEvidenceAgent always includes uncertainty
[ ] PricingAgent does not overclaim from price alone
[ ] ReviewIntegrityAgent does not claim reviews are fake

Lead adjudication:
[ ] Final risk score matches evidence strength
[ ] Temporary suppression requires at least two independent evidence lanes
[ ] Final reasoning is appeal-defensible
[ ] Uses human-in-the-loop language
[ ] Does not say "definitely counterfeit" or "seller is guilty"

Dashboard:
[ ] InvestigationPlan shows invoked and skipped agents
[ ] SpecialistEvidenceGrid renders cards correctly
[ ] LeadDecisionPanel shows risk score, confidence, action, policy buckets, and top evidence
[ ] EnforcementActionLog shows simulated platform actions
[ ] HumanReviewPanel still works

Demo quality:
[ ] Full luxury scenario completes under 3 minutes
[ ] ADK timeline or mocked event playback looks smooth
[ ] Final JSON is parseable
[ ] Safe edit is not over-flagged
```

---

# Fastest Way to Test in ADK Web

Paste each scenario as:

```txt
Run TrustPatrol Phase 2 investigation.

You are given a marketplace listing case with:
- listing timeline
- seller profile
- review profile
- image metadata

Tasks:
1. Compute structured signals.
2. Route to the appropriate specialist agents.
3. Explain which agents are invoked and skipped.
4. Run selected specialist agents.
5. Produce a LeadAdjudicator decision.
6. Produce an EnforcementActionAgent action log.
7. Return structured JSON only.

Case:
[PASTE SCENARIO JSON]
```

---

# Most Important Scenario

The single most important test is still the **Full Luxury Counterfeit Risk** scenario.

It validates:

```txt
router
brand agent
pricing agent
visual agent
seller agent
review agent
lead adjudicator
enforcement action
human-review framing
dashboard case-file value
```

If that works smoothly, Phase 2 is alive.
