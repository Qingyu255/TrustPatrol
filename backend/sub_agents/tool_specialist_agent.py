import json
from collections.abc import AsyncGenerator, Callable
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types
from pydantic import Field

from backend.config import Config
from backend.shared.llm_enrichment import SPECIALIST_ANALYSIS_SCHEMA, _safe_call
from backend.shared.phase2_engine import build_timeline_signals, extract_case_from_text
from backend.sub_agents.phase2_base import _content_event, _latest_user_text


ToolSpec = tuple[str, Callable[[dict[str, Any]], dict[str, Any]]]


def listing_timeline_arg(case: dict[str, Any]) -> str:
    return json.dumps(case.get("timeline", []))


class ToolUsingSpecialistAgent(BaseAgent):
    tools_to_run: list[ToolSpec] = Field(default_factory=list)
    domain_instruction: str

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        case = extract_case_from_text(_latest_user_text(ctx))
        signals = build_timeline_signals(case)
        tool_outputs = []

        for tool_name, tool_func in self.tools_to_run:
            args = self._tool_args(tool_name, case)
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                partial=True,
                content=types.Content(
                    role="model",
                    parts=[types.Part.from_function_call(name=tool_name, args=args)],
                ),
            )
            result = tool_func(case)
            tool_outputs.append({"tool": tool_name, "args": args, "result": result})
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                partial=True,
                content=types.Content(
                    role="user",
                    parts=[
                        types.Part.from_function_response(
                            name=tool_name,
                            response={"result": result},
                        )
                    ],
                ),
            )

        llm_payload = await self._build_llm_payload(case, signals, tool_outputs)
        yield _content_event(ctx, self.name, llm_payload)

    def _tool_args(self, tool_name: str, case: dict[str, Any]) -> dict[str, Any]:
        if tool_name in {
            "detect_brand_injection",
            "detect_counterfeit_keywords",
            "build_evidence",
            "detect_price_anomaly",
            "detect_image_swap",
        }:
            return {"listing_timeline": listing_timeline_arg(case)}
        if tool_name == "detect_visual_risk":
            return {"case": case}
        if tool_name == "evaluate_seller_profile":
            return {"seller_profile": case.get("seller_profile", {})}
        if tool_name == "evaluate_review_profile":
            return {"review_profile": case.get("review_profile", {})}
        return {"case": case}

    async def _build_llm_payload(
        self,
        case: dict[str, Any],
        signals: dict[str, Any],
        tool_outputs: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not Config.TRUSTPATROL_LLM_SPECIALISTS:
            return {
                "agent": self.name,
                "status": "disabled",
                "llm_analysis": {
                    "status": "disabled",
                    "model": Config.OPENAI_MODEL,
                    "tool_outputs": tool_outputs,
                },
            }
        system_instruction = (
            f"You are {self.name}, a TrustPatrol specialist evidence agent. "
            "Write concise JSON only. Use the supplied tool outputs as your evidence. "
            "Do not calculate final risk score or enforcement action. "
            "Use cautious human-review language: risk signal, may indicate, warrants review. "
            "Never say definitely fake, definitely counterfeit, fraud, seller is guilty, or seller is malicious. "
            + self.domain_instruction
        )
        analysis = await _safe_call(
            self.name,
            system_instruction,
            {
                "case": {
                    "listing_id": case.get("listing_id"),
                    "timeline": case.get("timeline", []),
                    "seller_profile": case.get("seller_profile", {}),
                    "review_profile": case.get("review_profile", {}),
                    "image_metadata": case.get("image_metadata", {}),
                },
                "signals": signals,
                "tool_outputs": tool_outputs,
                "required_json_schema": SPECIALIST_ANALYSIS_SCHEMA,
            },
        )
        analysis["agent"] = self.name
        analysis["llm_analysis"] = {
            "status": analysis.get("status", "completed"),
            "model": analysis.get("model", Config.OPENAI_MODEL),
            "kind": analysis.get("kind", self.name),
            "tool_outputs": tool_outputs,
        }
        if analysis.get("error"):
            analysis["llm_analysis"]["error"] = analysis["error"]
        return analysis
