import json
from copy import deepcopy
from typing import Any


SPECIALIST_AGENTS = [
    "BrandProtectionAgent",
    "PricingAgent",
    "VisualEvidenceAgent",
    "SellerTrustAgent",
    "ReviewIntegrityAgent",
]

COUNTERFEIT_KEYWORDS = [
    "OEM",
    "1:1",
    "1-1",
    "AAA",
    "mirror",
    "mirror quality",
    "factory batch",
    "same production line",
    "replica",
    "authentic grade",
    "original quality",
    "factory direct",
    "no receipt",
]


def extract_case_from_text(text: str) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(text[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return normalize_case(value)
    raise ValueError("No JSON case object found in prompt.")


def normalize_case(case: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(case)
    timeline = normalized.get("timeline") or normalized.get("versions") or []
    normalized["timeline"] = sorted(timeline, key=lambda item: item.get("version", 0))
    if "listing_id" not in normalized and normalized["timeline"]:
        normalized["listing_id"] = normalized["timeline"][-1].get("listing_id", "UNKNOWN")
    normalized.setdefault("seller_profile", {})
    normalized.setdefault("review_profile", {})
    normalized.setdefault("image_metadata", {})
    return normalized


def _previous_current(case: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    timeline = case.get("timeline", [])
    if not timeline:
        raise ValueError("Cases require at least one listing version.")
    if len(timeline) == 1:
        return None, timeline[-1]
    return timeline[-2], timeline[-1]


def _text(version: dict[str, Any]) -> str:
    return f"{version.get('title', '')} {version.get('description', '')}".lower()


def _brand(value: Any) -> str:
    return str(value or "").strip()


def _risk_level(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _next_step(risk_level: str) -> str:
    return {
        "LOW": "ALLOW",
        "MEDIUM": "MONITOR",
        "HIGH": "REQUEST_VERIFICATION",
        "CRITICAL": "ESCALATE",
    }[risk_level]


def build_timeline_signals(case: dict[str, Any]) -> dict[str, Any]:
    case = normalize_case(case)
    previous, current = _previous_current(case)
    seller = case.get("seller_profile", {})
    review = case.get("review_profile", {})
    image = case.get("image_metadata", {})

    is_baseline_review = previous is None
    previous_brand = _brand(previous.get("brand")) if previous else ""
    current_brand = _brand(current.get("brand"))
    current_text = _text(current)
    brand_added = bool(
        current_brand
        and not is_baseline_review
        and previous_brand.lower() != current_brand.lower()
    )
    baseline_brand_claim = bool(current_brand and is_baseline_review)
    previous_price = float(previous.get("price") or 0) if previous else 0
    current_price = float(current.get("price") or 0)
    price_drop_pct = round(max((previous_price - current_price) / previous_price * 100, 0), 1) if previous_price else 0
    previous_text = _text(previous) if previous else ""
    introduced_keywords = [
        keyword
        for keyword in COUNTERFEIT_KEYWORDS
        if keyword.lower() in current_text
        and (is_baseline_review or keyword.lower() not in previous_text)
    ]
    image_swapped = bool(
        image.get("image_changed")
        or (previous and previous.get("image_id") != current.get("image_id"))
    )
    text_fields_unchanged = (
        not is_baseline_review
        and previous.get("title") == current.get("title")
        and previous.get("description") == current.get("description")
        and _brand(previous.get("brand")).lower()
        == _brand(current.get("brand")).lower()
        and float(previous.get("price") or 0)
        == float(current.get("price") or 0)
    )

    return {
        "review_type": "baseline_review" if is_baseline_review else "post_approval_edit",
        "baseline_review": is_baseline_review,
        "brand_added": brand_added,
        "baseline_brand_claim": baseline_brand_claim,
        "brand_added_value": current_brand if brand_added else None,
        "previous_brand": previous_brand or None,
        "current_brand": current_brand or None,
        "price_drop_pct": price_drop_pct,
        "previous_price": previous_price,
        "current_price": current_price,
        "counterfeit_keywords": introduced_keywords,
        "image_swapped": image_swapped,
        "text_fields_unchanged": text_fields_unchanged,
        "post_approval_edit": (
            bool(previous)
            and previous.get("status") == "approved"
            and previous.get("version") != current.get("version")
        ),
        "seller_prior_flags": int(seller.get("prior_flags") or 0),
        "seller_age_days": int(seller.get("seller_age_days") or 0),
        "similar_listing_count_24h": int(seller.get("similar_listing_count_24h") or 0),
        "review_burst_detected": bool(review.get("review_burst_detected")),
        "generic_review_ratio": float(review.get("generic_review_ratio") or 0),
        "image_contains_brand_logo": bool(image.get("contains_brand_logo")),
        "image_contains_packaging": bool(image.get("contains_packaging")),
        "image_category": image.get("image_category"),
    }


def build_investigation_plan(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    seller_trigger = (
        signals["seller_age_days"] < 30
        or signals["seller_prior_flags"] > 0
        or signals["similar_listing_count_24h"] >= 5
    )
    review_trigger = signals["review_burst_detected"] or signals["generic_review_ratio"] >= 0.5

    invoked = []
    reasons = {}
    baseline = signals.get("baseline_review", False)
    if signals["brand_added"] or signals["counterfeit_keywords"] or signals.get("baseline_brand_claim"):
        invoked.append("BrandProtectionAgent")
        reasons["BrandProtectionAgent"] = (
            "Brand or counterfeit-associated language is present in the baseline listing."
            if baseline
            else "Brand or counterfeit-associated language changed after approval."
        )
    if signals["price_drop_pct"] >= 30:
        invoked.append("PricingAgent")
        reasons["PricingAgent"] = f"Price dropped by {signals['price_drop_pct']:g}%."
    visual_trigger = (
        signals["image_contains_brand_logo"]
        or signals["image_contains_packaging"]
        or (not baseline and signals["image_swapped"] and signals["text_fields_unchanged"])
    )
    if visual_trigger:
        invoked.append("VisualEvidenceAgent")
        reasons["VisualEvidenceAgent"] = (
            "Baseline image metadata contains brand logo or packaging signals."
            if baseline
            else "Image metadata or image ID changed after approval."
        )
    if seller_trigger:
        invoked.append("SellerTrustAgent")
        reasons["SellerTrustAgent"] = "Seller metadata contains trust-risk signals."
    if review_trigger:
        invoked.append("ReviewIntegrityAgent")
        reasons["ReviewIntegrityAgent"] = "Review metadata contains integrity-risk signals."

    skipped = [
        {
            "agent": agent,
            "reason": reasons.get(agent, "Skipped because no relevant signal was present."),
        }
        for agent in SPECIALIST_AGENTS
        if agent not in invoked
    ]

    priority = "HIGH" if len(invoked) >= 3 or signals["counterfeit_keywords"] else "MEDIUM" if invoked else "LOW"
    return {
        "agent": "InvestigationRouterAgent",
        "agents_to_invoke": invoked,
        "agents_skipped": skipped,
        "routing_reason": (
            "Selected evidence lanes: " + ", ".join(invoked)
            if invoked
            else "No specialist lane met the routing threshold."
        ),
        "minimum_evidence_required": 2 if priority == "HIGH" else 1,
        "case_priority": priority,
        "selection_reasons": reasons,
    }


def timeline_diff(case: dict[str, Any]) -> dict[str, Any]:
    case = normalize_case(case)
    previous, current = _previous_current(case)
    if previous is None:
        changed_fields = ["created_listing"]
        summary = "Baseline review for newly created listing."
    else:
        changed_fields = [
            field
            for field in ("title", "description", "brand", "price", "image_id", "status")
            if previous.get(field) != current.get(field)
        ]
        summary = (
            "Listing changed after approval across: " + ", ".join(changed_fields)
            if changed_fields
            else "No material listing-field changes detected."
        )
    return {
        "agent": "TimelineDiffAgent",
        "status": "completed",
        "listing_id": case.get("listing_id"),
        "changed_fields": changed_fields,
        "signals": build_timeline_signals(case),
        "summary": summary,
    }


def brand_finding(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    evidence = []
    if signals["brand_added"]:
        evidence.append(f"Brand changed from {signals['previous_brand']} to {signals['brand_added_value']}.")
    if signals.get("baseline_brand_claim"):
        evidence.append(f"Baseline listing claims brand {signals['current_brand']}.")
    if signals["counterfeit_keywords"]:
        evidence.append("Replica-associated terms are present: " + ", ".join(signals["counterfeit_keywords"]) + ".")
    contribution = 0
    if signals["brand_added"]:
        contribution += 16
    if signals.get("baseline_brand_claim"):
        contribution += 8
    if signals["counterfeit_keywords"]:
        contribution += 14
    contribution = min(contribution, 30)
    return specialist_finding(
        "BrandProtectionAgent",
        contribution,
        0.88 if contribution >= 25 else 0.74,
        "Brand or IP risk signals were found." if evidence else "No material brand/IP risk signal was found.",
        evidence or ["No brand claim or counterfeit-associated terms were detected."],
        "Brand terms and authenticity language are risk signals; they do not prove counterfeit status.",
    )


def pricing_finding(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    drop = signals["price_drop_pct"]
    contribution = 24 if drop >= 70 else 18 if drop >= 50 else 12 if drop >= 30 else 0
    return specialist_finding(
        "PricingAgent",
        contribution,
        0.93 if contribution >= 18 else 0.7,
        f"The listing price dropped by {drop:g}% after approval." if drop else "No meaningful price anomaly was detected.",
        [
            f"Initial price was {signals['previous_price']:g}.",
            f"Current price is {signals['current_price']:g}.",
            f"Price dropped by {drop:g}%.",
        ] if drop else ["No large post-approval price drop was detected."],
        "Discounting can be legitimate, so pricing must be combined with other evidence lanes.",
    )


def visual_finding(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    evidence = []
    if signals["image_swapped"]:
        evidence.append("Image changed after approval.")
    if signals.get("baseline_review"):
        evidence.append("Baseline visual metadata was evaluated.")
    if signals["image_contains_brand_logo"]:
        evidence.append("Image metadata indicates a brand logo is present.")
    if signals["image_contains_packaging"]:
        evidence.append("Image metadata indicates branded packaging is present.")
    if signals["text_fields_unchanged"]:
        evidence.append("Title, description, brand, and price stayed mostly unchanged.")
    contribution = 0
    if signals["image_swapped"]:
        contribution += 8
    if signals["image_contains_brand_logo"]:
        contribution += 5
    if signals["image_contains_packaging"]:
        contribution += 5
    contribution = min(contribution, 20)
    return specialist_finding(
        "VisualEvidenceAgent",
        contribution,
        0.66 if contribution else 0.55,
        "Image evidence contains visual risk metadata." if evidence else "No image-risk metadata was detected.",
        evidence or ["Image metadata did not indicate visual risk."],
        "Visual evidence is insufficient on its own to verify authenticity.",
    )


def seller_finding(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    evidence = []
    if signals["seller_age_days"] < 30:
        evidence.append(f"Seller account is {signals['seller_age_days']} days old.")
    if signals["seller_prior_flags"]:
        evidence.append(f"Seller has {signals['seller_prior_flags']} prior flags.")
    if signals["similar_listing_count_24h"] >= 5:
        evidence.append(f"Seller posted {signals['similar_listing_count_24h']} similar listings in the past 24 hours.")
    contribution = min((5 if signals["seller_age_days"] < 30 else 0) + min(signals["seller_prior_flags"] * 4, 6) + (5 if signals["similar_listing_count_24h"] >= 5 else 0), 15)
    return specialist_finding(
        "SellerTrustAgent",
        contribution,
        0.82 if contribution else 0.65,
        "Seller-level signals increase the need for human review." if evidence else "Seller profile does not add risk.",
        evidence or ["Seller profile has no new account, prior-flag, or listing velocity signal."],
        "A new account or prior flag is not inherently abusive without listing-level evidence.",
    )


def review_finding(case: dict[str, Any], signals: dict[str, Any] | None = None) -> dict[str, Any]:
    signals = signals or build_timeline_signals(case)
    evidence = []
    if signals["generic_review_ratio"] >= 0.5:
        evidence.append(f"Generic review ratio is {signals['generic_review_ratio']:.0%}.")
    if signals["review_burst_detected"]:
        evidence.append("Review burst was detected.")
    contribution = min((6 if signals["generic_review_ratio"] >= 0.5 else 0) + (4 if signals["review_burst_detected"] else 0), 10)
    return specialist_finding(
        "ReviewIntegrityAgent",
        contribution,
        0.69 if contribution else 0.6,
        "Review metadata may warrant additional trust review." if evidence else "Review metadata does not add risk.",
        evidence or ["No review burst or high generic review ratio was detected."],
        "Review metadata is not enough to conclude review manipulation.",
    )


def specialist_finding(agent: str, contribution: int, confidence: float, finding: str, evidence: list[str], uncertainty: str) -> dict[str, Any]:
    risk_level = _risk_level(contribution)
    return {
        "agent": agent,
        "status": "completed",
        "risk_level": risk_level,
        "risk_contribution": contribution,
        "confidence": confidence,
        "finding": finding,
        "evidence": evidence,
        "uncertainty": uncertainty,
        "recommended_next_step": _next_step(risk_level),
    }


SPECIALIST_BUILDERS = {
    "BrandProtectionAgent": brand_finding,
    "PricingAgent": pricing_finding,
    "VisualEvidenceAgent": visual_finding,
    "SellerTrustAgent": seller_finding,
    "ReviewIntegrityAgent": review_finding,
}


def build_specialist_findings(case: dict[str, Any], router_plan: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    signals = build_timeline_signals(case)
    router_plan = router_plan or build_investigation_plan(case, signals)
    return [
        SPECIALIST_BUILDERS[agent](case, signals)
        for agent in router_plan["agents_to_invoke"]
    ]


def lead_decision(case: dict[str, Any], router_plan: dict[str, Any], findings: list[dict[str, Any]]) -> dict[str, Any]:
    raw_score = min(sum(finding["risk_contribution"] for finding in findings), 100)
    supporting_lanes = [
        finding["agent"]
        for finding in findings
        if finding["risk_contribution"] > 0
    ]

    if not supporting_lanes:
        score = 10
    elif len(supporting_lanes) == 1:
        only_lane = supporting_lanes[0]
        if only_lane == "VisualEvidenceAgent":
            score = 60
        elif only_lane == "PricingAgent":
            score = 50
        elif only_lane == "BrandProtectionAgent":
            score = 65
        else:
            score = 45
    else:
        score = raw_score
        if len(supporting_lanes) >= 2 and score < 40:
            score = 55

    if score >= 85 and len(supporting_lanes) < 2:
        score = 75

    risk_level = _risk_level(score)
    action = {
        "LOW": "ALLOW",
        "MEDIUM": "MONITOR",
        "HIGH": "REQUEST_VERIFICATION",
        "CRITICAL": "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW",
    }[risk_level]
    if supporting_lanes == ["VisualEvidenceAgent"]:
        action = "REQUEST_VERIFICATION"
    if action == "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW" and len(supporting_lanes) < 2:
        action = "REQUEST_VERIFICATION"
        risk_level = "HIGH"
    top_evidence = []
    for finding in findings:
        top_evidence.extend(finding["evidence"][:2])
    strong = [finding["agent"] for finding in findings if finding["risk_contribution"] >= 20]
    moderate = [finding["agent"] for finding in findings if 8 <= finding["risk_contribution"] < 20]
    weak = [finding["agent"] for finding in findings if finding["risk_contribution"] < 8]
    return {
        "agent": "LeadAdjudicatorAgent",
        "status": "completed",
        "final_risk_score": score,
        "risk_level": risk_level,
        "confidence": round(min(0.55 + len(supporting_lanes) * 0.08 + score / 400, 0.95), 2),
        "recommended_action": action,
        "policy_buckets": policy_buckets(findings),
        "top_evidence": top_evidence[:8],
        "agent_consensus": {
            "strong_support": strong,
            "moderate_support": moderate,
            "weak_or_uncertain": weak,
            "disagree": [],
        },
        "decision_reasoning": decision_reasoning(score, supporting_lanes, findings),
        "human_review_required": action != "ALLOW",
    }


def policy_buckets(findings: list[dict[str, Any]]) -> list[str]:
    agents = {finding["agent"] for finding in findings}
    buckets = []
    if "BrandProtectionAgent" in agents:
        buckets.append("Potential counterfeit listing")
        buckets.append("Misleading brand claim")
    if "VisualEvidenceAgent" in agents:
        buckets.append("Suspicious post-approval visual mutation")
    if "SellerTrustAgent" in agents:
        buckets.append("Seller trust risk")
    if "ReviewIntegrityAgent" in agents:
        buckets.append("Review integrity risk")
    return buckets or ["Low-risk listing maintenance"]


def decision_reasoning(score: int, supporting_lanes: list[str], findings: list[dict[str, Any]]) -> list[str]:
    reasoning = []
    if supporting_lanes:
        reasoning.append("Evidence was assessed across " + str(len(supporting_lanes)) + " independent lane(s).")
    if "VisualEvidenceAgent" in supporting_lanes:
        reasoning.append("Visual evidence is treated as supporting context and is not used alone for suppression.")
    if score >= 85:
        reasoning.append("Multiple independent evidence lanes support temporary suppression pending human review.")
    elif score >= 70:
        reasoning.append("Risk is elevated, but proportionality favors seller verification before harsher action.")
    elif score >= 40:
        reasoning.append("Risk signals warrant monitoring or verification, but not suppression.")
    else:
        reasoning.append("Signals are weak or benign; allow while preserving the audit trail.")
    return reasoning


def enforcement_action_log(decision: dict[str, Any]) -> dict[str, Any]:
    action = decision["recommended_action"]
    if action == "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW":
        actions = [
            {"action": "TEMPORARY_SUPPRESSION", "status": "simulated", "reason": "Critical risk score with multiple independent evidence lanes."},
            {"action": "CREATE_REVIEW_TICKET", "status": "simulated", "reason": "Human review required before irreversible enforcement."},
            {"action": "REQUEST_SELLER_VERIFICATION", "status": "simulated", "reason": "Seller should provide authenticity evidence."},
        ]
        queue = "Brand Protection / IP Review"
        seller_message = "Please provide verification documents for the listed branded item."
        audit = "Temporary suppression simulated pending human review."
    elif action == "REQUEST_VERIFICATION":
        actions = [
            {"action": "REQUEST_SELLER_VERIFICATION", "status": "simulated", "reason": "Evidence requires seller clarification before enforcement."},
            {"action": "CREATE_REVIEW_TICKET", "status": "simulated", "reason": "Trust & Safety reviewer should inspect the case file."},
        ]
        queue = "Seller Verification"
        seller_message = "Please provide additional information for this listing."
        audit = "Verification requested; no suppression simulated."
    elif action == "MONITOR":
        actions = [
            {"action": "MONITOR_LISTING", "status": "simulated", "reason": "Moderate signal detected without enough evidence for enforcement."},
        ]
        queue = "Monitoring"
        seller_message = "No seller message required."
        audit = "Listing added to monitoring queue."
    else:
        actions = [
            {"action": "ALLOW_LISTING", "status": "simulated", "reason": "No material trust-and-safety risk requiring action."},
        ]
        queue = "None"
        seller_message = "No seller message required."
        audit = "Listing allowed."
    return {
        "agent": "EnforcementActionAgent",
        "status": "completed",
        "actions": actions,
        "review_queue": queue,
        "seller_message_summary": seller_message,
        "audit_log_summary": audit,
    }


def build_phase2_case_file(case: dict[str, Any]) -> dict[str, Any]:
    case = normalize_case(case)
    diff = timeline_diff(case)
    router = build_investigation_plan(case, diff["signals"])
    findings = build_specialist_findings(case, router)
    decision = lead_decision(case, router, findings)
    enforcement = enforcement_action_log(decision)
    return {
        "listing_id": case.get("listing_id"),
        "timeline_diff": diff,
        "router_plan": router,
        "specialist_findings": findings,
        "lead_decision": decision,
        "enforcement_action_log": enforcement,
        "human_reviewer_decision": None,
    }
