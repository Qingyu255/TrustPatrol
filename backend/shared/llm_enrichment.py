import asyncio
import json
from typing import Any

from google.adk.models.llm_request import LlmRequest
from google.genai import types

from backend.config import Config


ROUTER_AGENT_SCHEMA = {
    "type": "object",
    "properties": {
        "case_summary": {"type": "string"},
        "routing_rationale": {"type": "string"},
        "skipped_agent_rationale": {
            "type": "array",
            "items": {"type": "string"},
        },
        "guardrail_note": {"type": "string"},
    },
    "required": [
        "case_summary",
        "routing_rationale",
        "skipped_agent_rationale",
        "guardrail_note",
    ],
}


SPECIALIST_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "finding": {"type": "string"},
        "evidence": {
            "type": "array",
            "items": {"type": "string"},
        },
        "uncertainty": {"type": "string"},
        "reviewer_note": {"type": "string"},
    },
    "required": ["finding", "evidence", "uncertainty", "reviewer_note"],
}


def disabled_llm(kind: str) -> dict[str, Any]:
    return {
        "status": "disabled",
        "model": Config.OPENAI_MODEL,
        "kind": kind,
    }


def fallback_llm(kind: str, status: str, error: Exception | str) -> dict[str, Any]:
    error_text = str(error)
    return {
        "status": status,
        "model": Config.OPENAI_MODEL,
        "kind": kind,
        "error": error_text[:300],
    }


def _json_text_from_response(response: Any) -> str:
    if not response.content or not response.content.parts:
        raise ValueError("LLM response did not include text content.")
    text = "".join(part.text or "" for part in response.content.parts)
    if not text.strip():
        raise ValueError("LLM response text was empty.")
    return text


def _extract_json(text: str) -> dict[str, Any]:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        for index, char in enumerate(text):
            if char != "{":
                continue
            try:
                value, _ = decoder.raw_decode(text[index:])
                break
            except json.JSONDecodeError:
                continue
        else:
            raise
    if not isinstance(value, dict):
        raise ValueError("LLM response JSON was not an object.")
    return value


async def _call_json_llm(system_instruction: str, user_payload: dict[str, Any]) -> dict[str, Any]:
    request = LlmRequest(
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=json.dumps(user_payload, indent=2))],
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            temperature=0.2,
            max_output_tokens=700,
        ),
    )
    model = Config.openai_model()
    response = None
    async for candidate in model.generate_content_async(request, stream=False):
        response = candidate
    if response is None:
        raise ValueError("LLM did not return a response.")
    if response.error_code or response.error_message:
        raise RuntimeError(response.error_message or response.error_code)
    return _extract_json(_json_text_from_response(response))


async def _safe_call(kind: str, system_instruction: str, user_payload: dict[str, Any]) -> dict[str, Any]:
    try:
        payload = await asyncio.wait_for(
            _call_json_llm(system_instruction, user_payload),
            timeout=Config.TRUSTPATROL_LLM_TIMEOUT_SECONDS,
        )
        payload["status"] = "completed"
        payload["model"] = Config.OPENAI_MODEL
        payload["kind"] = kind
        return payload
    except asyncio.TimeoutError as exc:
        if Config.TRUSTPATROL_REQUIRE_LLM:
            raise
        return fallback_llm(kind, "timeout", exc)
    except Exception as exc:
        if Config.TRUSTPATROL_REQUIRE_LLM:
            raise
        return fallback_llm(kind, "error", exc)


async def build_router_llm_analysis(
    case: dict[str, Any],
    signals: dict[str, Any],
    router_plan: dict[str, Any],
) -> dict[str, Any]:
    if not Config.TRUSTPATROL_LLM_ROUTER:
        return disabled_llm("router")
    system_instruction = (
        "You are InvestigationRouterAgent for TrustPatrol. Write concise JSON only. "
        "Explain why deterministic guardrails selected or skipped specialist evidence lanes. "
        "Do not add or remove agents. Do not claim the seller is guilty or the item is definitely fake."
    )
    payload = {
        "case": {
            "listing_id": case.get("listing_id"),
            "timeline": case.get("timeline", []),
            "seller_profile": case.get("seller_profile", {}),
            "review_profile": case.get("review_profile", {}),
            "image_metadata": case.get("image_metadata", {}),
        },
        "signals": signals,
        "deterministic_router_plan": router_plan,
        "required_json_schema": ROUTER_AGENT_SCHEMA,
    }
    analysis = await _safe_call("router", system_instruction, payload)
    if analysis.get("status") == "completed":
        analysis["guardrail_note"] = (
            analysis.get("guardrail_note")
            or "Final routing is determined by deterministic signal thresholds."
        )
    return analysis


async def build_specialist_llm_analysis(
    case: dict[str, Any],
    signals: dict[str, Any],
    finding: dict[str, Any],
) -> dict[str, Any]:
    if not Config.TRUSTPATROL_LLM_SPECIALISTS:
        return disabled_llm(finding["agent"])
    system_instruction = (
        f"You are {finding['agent']} for TrustPatrol. Write concise JSON only. "
        "Turn the deterministic evidence into an analyst-quality evidence note. "
        "Do not change risk scores, recommended action, or routing. "
        "Use cautious language: signal, may indicate, warrants review. "
        "Never say definitely counterfeit, fake, fraud, or seller guilty."
    )
    payload = {
        "case": {
            "listing_id": case.get("listing_id"),
            "timeline": case.get("timeline", []),
            "seller_profile": case.get("seller_profile", {}),
            "review_profile": case.get("review_profile", {}),
            "image_metadata": case.get("image_metadata", {}),
        },
        "signals": signals,
        "deterministic_finding": finding,
        "required_json_schema": SPECIALIST_ANALYSIS_SCHEMA,
    }
    return await _safe_call(finding["agent"], system_instruction, payload)
