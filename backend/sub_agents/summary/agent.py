from google.adk.agents.llm_agent import Agent

from backend.config import Config


def summarize_content(content: str, audience: str = "general") -> dict:
    """Summarizes user-provided content for a target audience.

    Args:
        content: Notes, text, findings, or conversation context to summarize.
        audience: The intended reader of the summary.
    """
    return {
        "audience": audience,
        "summary": content.strip(),
        "next_steps": [
            "confirm missing details",
            "decide the next concrete action",
            "track any unresolved assumptions",
        ],
    }


summary_agent = Agent(
    model=Config.openai_model(),
    name="summary_agent",
    description=(
        "Summarizes notes, documents, decisions, and conversation context into "
        "concise handoff-ready outputs."
    ),
    instruction=(
        "You are the Summary Agent. Summarize user-provided content without "
        "adding unsupported facts. Use summarize_content when the user asks for "
        "a summary, brief, recap, handoff note, or synthesis."
    ),
    tools=[summarize_content],
)
