Litmus test it with **4 tiny scenarios** and check whether the agent produces the expected risk/action. Don’t test everything — test whether the agent understands the core product.

## 1. Safe edit should stay safe

**Input:** typo fix, clearer photo, tiny price change.

Expected:

```txt
Risk: LOW or maybe MEDIUM
Action: ALLOW or MONITOR
Evidence: should not overreact
```

This checks that the agent is not paranoid.

---

## 2. Brand injection should spike risk

**v1**

```json
{
  "title": "Wireless Earbuds Bluetooth 5.0",
  "description": "Good condition wireless earbuds.",
  "brand": null,
  "price": 30,
  "image_id": "generic_earbuds_01",
  "status": "approved"
}
```

**v2**

```json
{
  "title": "Apple AirPods Pro OEM 1:1 Authentic",
  "description": "Factory batch, same production line, mirror quality.",
  "brand": "Apple",
  "price": 12,
  "image_id": "airpods_branded_box_01",
  "status": "approved"
}
```

Expected:

```txt
Risk: CRITICAL
Score: 90–100
Action: TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW
Evidence must mention:
- brand added after approval
- price drop
- OEM / 1:1 / mirror quality
- image swap
```

This is your main demo path.

---

## 3. Replica reveal should be critical

**v1**

```json
{
  "title": "Premium Leather Handbag",
  "description": "Stylish leather handbag.",
  "brand": null,
  "price": 180,
  "image_id": "generic_handbag_01",
  "status": "approved"
}
```

**v2**

```json
{
  "title": "Luxury Designer Bag 1:1 Mirror Quality AAA",
  "description": "Original quality, factory direct, no receipt.",
  "brand": "Luxury Designer",
  "price": 39,
  "image_id": "designer_bag_packaging_01",
  "status": "approved"
}
```

Expected:

```txt
Risk: CRITICAL
Action: TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW
Evidence should mention:
- replica keywords
- massive price drop
- brand/luxury positioning
```

This checks if it generalizes beyond AirPods.

---

## 4. Image-only suspicious edit should be medium/high, not ignored

**v1**

```json
{
  "title": "Sports Shoes",
  "description": "Comfortable running shoes.",
  "brand": null,
  "price": 45,
  "image_id": "generic_shoes_01",
  "status": "approved"
}
```

**v2**

```json
{
  "title": "Sports Shoes",
  "description": "Comfortable running shoes.",
  "brand": null,
  "price": 45,
  "image_id": "branded_luxury_shoes_box_01",
  "status": "approved"
}
```

Expected:

```txt
Risk: MEDIUM or HIGH
Action: MONITOR or REQUEST_VERIFICATION
Evidence should mention:
- image changed after approval
- text stayed mostly unchanged
```

This checks whether the agent catches behavioral drift even without obvious keywords.

---

## Pass/fail checklist

Your agent passes the litmus test if:

```txt
Safe edit is not over-flagged
Obvious counterfeit mutation becomes CRITICAL
Evidence matches the actual signals
Assessment follows your scoring rules
It does not say "definitely fake"
It recommends human-in-the-loop action
ADK timeline shows tool calls clearly
Final JSON is parseable
```

## Fastest way to run it

In ADK Web, paste one scenario at a time as:

```txt
Investigate this listing timeline and return structured JSON.

Timeline:
[v1 JSON]
[v2 JSON]
```

Then verify:

```txt
1. Did InvestigationAgent call the right tools?
2. Did AssessmentAgent compute the expected score?
3. Did the final response match the expected action?
4. Did the trace/timeline look demo-worthy?
```

The single most important test is the **Brand Injection** case. If that works smoothly end-to-end, your noon MVP is basically alive.
