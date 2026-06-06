import json
import asyncio
from collections.abc import AsyncGenerator
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types

from backend.config import Config
from backend.shared.phase2_engine import (
    build_phase2_case_file,
    extract_case_from_text,
)
from backend.sub_agents import (
    enforcement_action_agent,
    investigation_router_agent,
    lead_adjudicator_agent,
    timeline_diff_agent,
)


def _latest_user_text(ctx: InvocationContext) -> str:
    if ctx.user_content and ctx.user_content.parts:
        return "".join(part.text or "" for part in ctx.user_content.parts)
    for event in reversed(ctx.session.events):
        if event.author == "user" and event.content and event.content.parts:
            return "".join(part.text or "" for part in event.content.parts)
    return ""


def _final_event(ctx: InvocationContext, payload: dict) -> Event:
    return Event(
        invocation_id=ctx.invocation_id,
        author="TrustPatrolRootAgent",
        branch=ctx.branch,
        content=types.Content(
            role="model",
            parts=[types.Part.from_text(text=json.dumps(payload, indent=2))],
        ),
        output=payload,
    )


def _progress_event(ctx: InvocationContext, message: str) -> Event:
    return Event(
        invocation_id=ctx.invocation_id,
        author="TrustPatrolRootAgent",
        branch=ctx.branch,
        partial=True,
        content=types.Content(
            role="model",
            parts=[types.Part.from_text(text=message)],
        ),
    )


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text or not text.strip():
        return None
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
            return None
    return value if isinstance(value, dict) else None


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value


def _event_payload(event: Event) -> dict[str, Any] | None:
    if isinstance(event.output, dict):
        return event.output

    for value in event.actions.state_delta.values():
        value = _model_dump(value)
        if isinstance(value, dict) and value.get("agent"):
            return value

    if not event.content or not event.content.parts:
        return None

    for part in event.content.parts:
        function_call = getattr(part, "function_call", None)
        if function_call and function_call.name == "finish_task":
            args = _model_dump(function_call.args)
            if isinstance(args, dict) and args.get("agent"):
                return args

    text = "".join(part.text or "" for part in event.content.parts)
    return _extract_json_object(text)


def _merge_specialist_llm(base: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    llm_status = payload.get("status") or "completed"
    if payload.get("llm_analysis"):
        merged["llm_analysis"] = payload["llm_analysis"]
        return merged

    merged["llm_analysis"] = {
        "status": llm_status,
        "model": Config.OPENAI_MODEL,
        "reviewer_note": payload.get("reviewer_note"),
    }
    if llm_status == "completed":
        if payload.get("finding"):
            merged["finding"] = payload["finding"]
        if isinstance(payload.get("evidence"), list) and payload["evidence"]:
            merged["evidence"] = payload["evidence"]
        if payload.get("uncertainty"):
            merged["uncertainty"] = payload["uncertainty"]
    return merged


class TrustPatrolPhase2RootAgent(BaseAgent):
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        case = extract_case_from_text(_latest_user_text(ctx))
        child_agents = {agent.name: agent for agent in self.sub_agents}
        enriched_router_plan = None
        enriched_specialist_findings = {}

        execution_order = [
            ("TimelineDiffAgent", "Computing listing timeline diff and normalized risk signals..."),
            ("InvestigationRouterAgent", "Routing the case to the necessary specialist evidence lanes..."),
            ("LeadAdjudicatorAgent", "Combining specialist evidence into a moderation decision..."),
            ("EnforcementActionAgent", "Preparing simulated enforcement and audit actions..."),
        ]

        for agent_name, progress_message in execution_order:
            yield _progress_event(ctx, progress_message)
            await asyncio.sleep(0.15)
            async for event in child_agents[agent_name].run_async(ctx):
                payload = _event_payload(event)
                if payload:
                    output_agent = payload.get("agent")
                    if output_agent == "InvestigationRouterAgent" and "agents_to_invoke" in payload:
                        enriched_router_plan = payload
                    elif output_agent in {
                        "BrandProtectionAgent",
                        "PricingAgent",
                        "VisualEvidenceAgent",
                        "SellerTrustAgent",
                        "ReviewIntegrityAgent",
                    }:
                        enriched_specialist_findings[output_agent] = payload
                yield event

        yield _progress_event(ctx, "Assembling the final TrustPatrol case file...")
        await asyncio.sleep(0.15)
        final_payload = build_phase2_case_file(case)
        if enriched_router_plan:
            final_payload["router_plan"] = enriched_router_plan
        if enriched_specialist_findings:
            final_payload["specialist_findings"] = [
                _merge_specialist_llm(
                    finding,
                    enriched_specialist_findings[finding["agent"]],
                )
                if finding["agent"] in enriched_specialist_findings
                else finding
                for finding in final_payload["specialist_findings"]
            ]
        yield _final_event(ctx, final_payload)


root_agent = TrustPatrolPhase2RootAgent(
    name="TrustPatrolRootAgent",
    description=(
        "Adaptive trust-and-safety case-file workflow that routes selected "
        "specialist evidence lanes before lead adjudication and enforcement."
    ),
    sub_agents=[
        timeline_diff_agent,
        investigation_router_agent,
        lead_adjudicator_agent,
        enforcement_action_agent,
    ],
)
