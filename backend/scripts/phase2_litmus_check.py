import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.shared.scenarios import PHASE2_SCENARIOS
from backend.config import Config


BASE_URL = os.environ.get("ADK_BASE_URL", "http://127.0.0.1:8001").rstrip("/")
APP_NAME = os.environ.get("ADK_APP_NAME", "backend")
USER_ID = os.environ.get("ADK_LITMUS_USER", "phase2-litmus")

EXPECTED = {
    "baseline_safe_creation": {
        "invoked": [],
        "risk": "LOW",
        "action": "ALLOW",
        "review_type": "baseline_review",
    },
    "baseline_risky_creation": {
        "invoked": [
            "BrandProtectionAgent",
            "VisualEvidenceAgent",
            "SellerTrustAgent",
            "ReviewIntegrityAgent",
        ],
        "risk": "MEDIUM",
        "action": "MONITOR",
        "review_type": "baseline_review",
    },
    "legitimate_edit": {
        "invoked": [],
        "risk": "LOW",
        "action": "ALLOW",
        "review_type": "post_approval_edit",
    },
    "luxury_full_risk": {
        "invoked": [
            "BrandProtectionAgent",
            "PricingAgent",
            "VisualEvidenceAgent",
            "SellerTrustAgent",
            "ReviewIntegrityAgent",
        ],
        "risk": "CRITICAL",
        "action": "TEMPORARY_SUPPRESSION_AND_HUMAN_REVIEW",
        "review_type": "post_approval_edit",
    },
    "image_only_suspicious": {
        "invoked": ["VisualEvidenceAgent"],
        "risk": "MEDIUM",
        "action": "REQUEST_VERIFICATION",
        "review_type": "post_approval_edit",
    },
    "price_drop_only": {
        "invoked": ["PricingAgent"],
        "risk": "MEDIUM",
        "action": "MONITOR",
        "review_type": "post_approval_edit",
    },
    "review_abuse": {
        "invoked": ["SellerTrustAgent", "ReviewIntegrityAgent"],
        "risk": "MEDIUM",
        "action": "MONITOR",
        "review_type": "post_approval_edit",
    },
}


def post_json(path: str, payload: dict, timeout: int = 20) -> dict | str:
    request = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    body = urllib.request.urlopen(request, timeout=timeout).read().decode()
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body


def wait_for_adk() -> None:
    deadline = time.time() + 10
    last_error = None
    while time.time() < deadline:
        try:
            urllib.request.urlopen(
                BASE_URL + "/list-apps?relative_path=./",
                timeout=1,
            ).read()
            return
        except Exception as exc:
            last_error = exc
            time.sleep(0.25)
    raise RuntimeError(
        f"ADK web is not reachable at {BASE_URL}. "
        "Start it with: ./.venv/bin/adk web --port 8001"
    ) from last_error


def prompt_for(case: dict) -> str:
    return (
        "Run TrustPatrol Phase 2 investigation.\n\n"
        "You are given a marketplace listing case with:\n"
        "- listing timeline\n"
        "- seller profile\n"
        "- review profile\n"
        "- image metadata\n\n"
        "Tasks:\n"
        "1. Compute structured signals.\n"
        "2. Route to the appropriate specialist agents.\n"
        "3. Explain which agents are invoked and skipped.\n"
        "4. Run selected specialist agents.\n"
        "5. Produce a LeadAdjudicator decision.\n"
        "6. Produce an EnforcementActionAgent action log.\n"
        "7. Return structured JSON only.\n\n"
        "Case:\n"
        + json.dumps(case)
    )


def create_session(case_key: str) -> str:
    response = post_json(
        f"/apps/{APP_NAME}/users/{USER_ID}/sessions",
        {"state": {"litmus_case": case_key}},
        timeout=5,
    )
    if not isinstance(response, dict) or "id" not in response:
        raise RuntimeError(f"Unexpected session response for {case_key}: {response!r}")
    return response["id"]


def run_sse_case(case_key: str, case: dict) -> dict:
    session_id = create_session(case_key)
    response = post_json(
        "/run_sse",
        {
            "app_name": APP_NAME,
            "user_id": USER_ID,
            "session_id": session_id,
            "new_message": {
                "role": "user",
                "parts": [{"text": prompt_for(case)}],
            },
            "streaming": True,
        },
        timeout=30,
    )
    if not isinstance(response, str):
        raise RuntimeError(f"Expected SSE text for {case_key}, got {response!r}")

    events = []
    final_payload = None
    for line in response.splitlines():
        if not line.startswith("data: "):
            continue
        event = json.loads(line[len("data: ") :])
        events.append(event)
        if event.get("author") != "TrustPatrolRootAgent" or event.get("partial"):
            continue
        content = event.get("content") or {}
        parts = content.get("parts") or []
        if parts and "text" in parts[0]:
            final_payload = json.loads(parts[0]["text"])

    if final_payload is None:
        raise RuntimeError(f"No final TrustPatrolRootAgent JSON event for {case_key}")

    return {"session_id": session_id, "events": events, "final": final_payload}


def expected_author_order(invoked: list[str]) -> list[str]:
    return [
        "TimelineDiffAgent",
        "InvestigationRouterAgent",
        *invoked,
        "LeadAdjudicatorAgent",
        "EnforcementActionAgent",
        "TrustPatrolRootAgent",
    ]


def main() -> int:
    wait_for_adk()

    failures = []
    summary = {}
    for key, expected in EXPECTED.items():
        try:
            result = run_sse_case(key, PHASE2_SCENARIOS[key])
        except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError) as exc:
            failures.append(f"{key}: SSE request failed: {exc}")
            continue

        events = result["events"]
        final = result["final"]
        non_partial_authors = [
            event.get("author")
            for event in events
            if not event.get("partial")
        ]
        partial_events = [
            event
            for event in events
            if event.get("partial")
        ]
        actual = {
            "session_id": result["session_id"],
            "non_partial_authors": non_partial_authors,
            "partial_event_count": len(partial_events),
            "invoked": final["router_plan"]["agents_to_invoke"],
            "risk": final["lead_decision"]["risk_level"],
            "action": final["lead_decision"]["recommended_action"],
            "score": final["lead_decision"]["final_risk_score"],
            "review_type": final["timeline_diff"]["signals"]["review_type"],
            "router_llm_status": (final["router_plan"].get("llm_router_analysis") or {}).get("status"),
            "specialist_llm_statuses": {
                finding["agent"]: (finding.get("llm_analysis") or {}).get("status")
                for finding in final["specialist_findings"]
            },
        }
        summary[key] = actual

        expected_authors = expected_author_order(expected["invoked"])
        if non_partial_authors != expected_authors:
            failures.append(
                f"{key}.authors: expected {expected_authors!r}, got {non_partial_authors!r}"
            )
        if actual["partial_event_count"] == 0:
            failures.append(f"{key}.partial_event_count: expected visible progress events")
        if Config.TRUSTPATROL_LLM_ROUTER and not actual["router_llm_status"]:
            failures.append(f"{key}.router_llm_status: expected llm_router_analysis")
        if Config.TRUSTPATROL_REQUIRE_LLM and actual["router_llm_status"] != "completed":
            failures.append(
                f"{key}.router_llm_status: expected completed, got {actual['router_llm_status']!r}"
            )
        if Config.TRUSTPATROL_LLM_SPECIALISTS:
            missing = [
                agent
                for agent in expected["invoked"]
                if not actual["specialist_llm_statuses"].get(agent)
            ]
            if missing:
                failures.append(f"{key}.specialist_llm_statuses: missing {missing!r}")
        if Config.TRUSTPATROL_REQUIRE_LLM:
            incomplete = {
                agent: status
                for agent, status in actual["specialist_llm_statuses"].items()
                if status != "completed"
            }
            if incomplete:
                failures.append(
                    f"{key}.specialist_llm_statuses: expected completed, got {incomplete!r}"
                )
        for field in ("invoked", "risk", "action", "review_type"):
            if actual[field] != expected[field]:
                failures.append(
                    f"{key}.{field}: expected {expected[field]!r}, got {actual[field]!r}"
                )

    print(json.dumps(summary, indent=2))
    if failures:
        print("\nFAILURES:")
        print("\n".join(failures))
        return 1
    print("\nPhase 2 /run_sse litmus checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
