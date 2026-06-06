import json
from collections.abc import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types
from pydantic import Field

from backend.shared.phase2_engine import (
    SPECIALIST_BUILDERS,
    build_investigation_plan,
    build_phase2_case_file,
    build_specialist_findings,
    build_timeline_signals,
    enforcement_action_log,
    extract_case_from_text,
    lead_decision,
    timeline_diff,
)
from backend.shared.llm_enrichment import build_specialist_llm_analysis


def _latest_user_text(ctx: InvocationContext) -> str:
    if ctx.user_content and ctx.user_content.parts:
        return "".join(part.text or "" for part in ctx.user_content.parts)
    for event in reversed(ctx.session.events):
        if event.author == "user" and event.content and event.content.parts:
            return "".join(part.text or "" for part in event.content.parts)
    return ""


def _content_event(
    ctx: InvocationContext,
    author: str,
    payload: dict,
    partial: bool | None = None,
) -> Event:
    return Event(
        invocation_id=ctx.invocation_id,
        author=author,
        branch=ctx.branch,
        partial=partial,
        content=types.Content(
            role="model",
            parts=[types.Part.from_text(text=json.dumps(payload, indent=2))],
        ),
        output=None if partial else payload,
    )


class Phase2DeterministicAgent(BaseAgent):
    agent_kind: str = Field(description="The deterministic Phase 2 agent kind.")

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        case = extract_case_from_text(_latest_user_text(ctx))
        signals = build_timeline_signals(case)
        router_plan = build_investigation_plan(case, signals)

        if self.agent_kind == "timeline_diff":
            payload = timeline_diff(case)
        elif self.agent_kind == "router":
            payload = router_plan
        elif self.agent_kind in SPECIALIST_BUILDERS:
            payload = SPECIALIST_BUILDERS[self.agent_kind](case, signals)
            payload["llm_analysis"] = await build_specialist_llm_analysis(
                case, signals, payload
            )
        elif self.agent_kind == "lead":
            findings = build_specialist_findings(case, router_plan)
            payload = lead_decision(case, router_plan, findings)
        elif self.agent_kind == "enforcement":
            findings = build_specialist_findings(case, router_plan)
            decision = lead_decision(case, router_plan, findings)
            payload = enforcement_action_log(decision)
        else:
            payload = build_phase2_case_file(case)

        yield _content_event(ctx, self.name, payload)
