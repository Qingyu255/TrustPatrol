from google.adk.agents.llm_agent import Agent
from google.genai import types
from pydantic import BaseModel, Field

from backend.config import Config


class SpecialistLLMOutput(BaseModel):
    agent: str
    status: str = "completed"
    finding: str
    evidence: list[str] = Field(default_factory=list)
    uncertainty: str
    reviewer_note: str


BASE_SPECIALIST_INSTRUCTION = (
    "You are a TrustPatrol specialist evidence agent. You receive a marketplace "
    "listing case as JSON in the user message. Use only your assigned tools. "
    "Return JSON only through the required output schema. Do not calculate final "
    "risk score or enforcement action. Use cautious human-review language: "
    "risk signal, may indicate, warrants review. Never say definitely fake, "
    "definitely counterfeit, fraud, seller is guilty, or seller is malicious."
)


def specialist_agent(
    *,
    name: str,
    description: str,
    domain_instruction: str,
    tools: list,
) -> Agent:
    return Agent(
        model=Config.openai_model(),
        name=name,
        description=description,
        instruction=BASE_SPECIALIST_INSTRUCTION + "\n\n" + domain_instruction,
        tools=tools,
        output_key=f"{name}_llm_output",
        output_schema=SpecialistLLMOutput,
        timeout=Config.TRUSTPATROL_LLM_TIMEOUT_SECONDS,
        generate_content_config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=700,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                maximum_remote_calls=2,
            ),
        ),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )
