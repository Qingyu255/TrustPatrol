from google.adk.agents.llm_agent import Agent

from backend.config import Config
from backend.sub_agents import planning_agent, summary_agent

root_agent = Agent(
    model=Config.openai_model(),
    name="root_agent",
    description=(
        "Generic coordinator that handles normal user requests and delegates "
        "planning or summarization work to specialist agents."
    ),
    instruction=(
        "You are a generic root coordinator for a multi-agent ADK system. "
        "Understand the user's request, decide whether to answer directly or "
        "delegate, and keep the final response useful and concise.\n"
        "- Delegate planning, decomposition, roadmap, milestone, and next-step "
        "requests to planning_agent.\n"
        "- Delegate summaries, recaps, briefs, syntheses, and handoff notes to "
        "summary_agent.\n"
        "- Handle simple general questions directly when no specialist is needed.\n"
        "- If the request is missing critical context, ask one focused question "
        "instead of guessing."
    ),
    sub_agents=[planning_agent, summary_agent],
)
