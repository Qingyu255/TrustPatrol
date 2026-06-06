from google.adk.agents.llm_agent import Agent

from backend.config import Config


def create_task_plan(goal: str, constraints: str = "") -> dict:
    """Creates a concise implementation plan for a user goal.

    Args:
        goal: The outcome the user wants.
        constraints: Optional limits, requirements, or preferences.
    """
    return {
        "goal": goal,
        "constraints": constraints or "No explicit constraints provided.",
        "plan": [
            "clarify the expected outcome and acceptance criteria",
            "identify the smallest useful first version",
            "break the work into ordered steps",
            "verify the result against the acceptance criteria",
        ],
    }


planning_agent = Agent(
    model=Config.openai_model(),
    name="planning_agent",
    description=(
        "Breaks broad goals, project requests, and ambiguous tasks into clear "
        "plans, milestones, and acceptance criteria."
    ),
    instruction=(
        "You are the Planning Agent. Turn a user goal into a practical plan. "
        "Use create_task_plan when the user asks for a plan, roadmap, "
        "decomposition, milestones, or next steps. Keep the plan short and "
        "action-oriented."
    ),
    tools=[create_task_plan],
)
