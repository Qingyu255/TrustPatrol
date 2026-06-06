import asyncio
from collections.abc import AsyncGenerator

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext

from backend.config import Config
from backend.shared.llm_enrichment import build_router_llm_analysis
from backend.shared.investigation_engine import SPECIALIST_BUILDERS, build_investigation_plan, build_timeline_signals, extract_case_from_text
from backend.sub_agents.investigation_router_agent.sub_agents.brand_protection_agent import brand_protection_agent
from backend.custom.deterministic_agent import _content_event, _latest_user_text
from backend.sub_agents.investigation_router_agent.sub_agents.pricing_agent import pricing_agent
from backend.sub_agents.investigation_router_agent.sub_agents.review_integrity_agent import review_integrity_agent
from backend.sub_agents.investigation_router_agent.sub_agents.seller_trust_agent import seller_trust_agent
from backend.sub_agents.investigation_router_agent.sub_agents.visual_evidence_agent import visual_evidence_agent


SPECIALIST_PROGRESS = {
    "BrandProtectionAgent": "Checking brand injection and counterfeit-language risk...",
    "PricingAgent": "Checking post-approval price anomaly signals...",
    "VisualEvidenceAgent": "Checking visual drift, logo, and packaging metadata...",
    "SellerTrustAgent": "Checking seller age, prior flags, and listing velocity...",
    "ReviewIntegrityAgent": "Checking review burst and generic-review metadata...",
}


def _branch_ctx(ctx: InvocationContext, parent_name: str, child_name: str) -> InvocationContext:
    child_ctx = ctx.model_copy()
    suffix = f"{parent_name}.{child_name}"
    child_ctx.branch = f"{ctx.branch}.{suffix}" if ctx.branch else suffix
    return child_ctx


async def _collect_child_events(agent, ctx: InvocationContext):
    events = []
    async for event in agent.run_async(ctx):
        events.append(event)
    return events


class InvestigationRouterOrchestratorAgent(BaseAgent):
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator:
        case = extract_case_from_text(_latest_user_text(ctx))
        signals = build_timeline_signals(case)
        router_plan = build_investigation_plan(case, signals)
        router_plan["llm_router_analysis"] = await build_router_llm_analysis(
            case, signals, router_plan
        )
        selected_agents = set(router_plan["agents_to_invoke"])

        yield _content_event(ctx, self.name, router_plan)

        child_agents = {agent.name: agent for agent in self.sub_agents}
        specialist_order = [
            "BrandProtectionAgent",
            "PricingAgent",
            "VisualEvidenceAgent",
            "SellerTrustAgent",
            "ReviewIntegrityAgent",
        ]
        selected_order = [
            agent_name for agent_name in specialist_order if agent_name in selected_agents
        ]
        child_tasks = {}
        if Config.TRUSTPATROL_LLM_SPECIALISTS:
            child_tasks = {
                agent_name: asyncio.create_task(
                    _collect_child_events(
                        child_agents[agent_name],
                        _branch_ctx(ctx, self.name, agent_name),
                    )
                )
                for agent_name in selected_order
            }

        for agent_name in selected_order:
            yield _content_event(
                ctx,
                self.name,
                {
                    "agent": "InvestigationRouterAgent",
                    "status": "invoking_specialist",
                    "specialist": agent_name,
                    "message": SPECIALIST_PROGRESS[agent_name],
                },
                partial=True,
            )
            await asyncio.sleep(0.12)

        task_results = {}
        if Config.TRUSTPATROL_LLM_SPECIALISTS and child_tasks:
            done, pending = await asyncio.wait(
                child_tasks.values(),
                timeout=Config.TRUSTPATROL_LLM_TIMEOUT_SECONDS + 1,
            )
            for task in pending:
                task.cancel()
            for agent_name, task in child_tasks.items():
                if task in pending:
                    task_results[agent_name] = [
                        _content_event(
                            ctx,
                            agent_name,
                            {
                                "agent": agent_name,
                                "status": "timeout",
                                "llm_analysis": {
                                    "status": "timeout",
                                    "model": Config.OPENAI_MODEL,
                                },
                            },
                        )
                    ]
                    continue
                try:
                    task_results[agent_name] = task.result()
                except Exception as exc:
                    task_results[agent_name] = [
                        _content_event(
                            ctx,
                            agent_name,
                            {
                                "agent": agent_name,
                                "status": "error",
                                "llm_analysis": {
                                    "status": "error",
                                    "model": Config.OPENAI_MODEL,
                                    "error": str(exc)[:300],
                                },
                            },
                        )
                    ]

        for agent_name in selected_order:
            if not Config.TRUSTPATROL_LLM_SPECIALISTS:
                finding = SPECIALIST_BUILDERS[agent_name](case, signals)
                finding["llm_analysis"] = {
                    "status": "disabled",
                    "model": Config.OPENAI_MODEL,
                }
                events = [_content_event(ctx, agent_name, finding)]
            else:
                events = task_results.get(agent_name, [])
            for event in events:
                yield event


investigation_router_agent = InvestigationRouterOrchestratorAgent(
    name="InvestigationRouterAgent",
    description="Selects relevant specialist evidence lanes and invokes only the needed specialist agents.",
    sub_agents=[
        brand_protection_agent,
        pricing_agent,
        visual_evidence_agent,
        seller_trust_agent,
        review_integrity_agent,
    ],
)
