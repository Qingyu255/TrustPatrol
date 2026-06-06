from backend.custom.deterministic_agent import DeterministicAgent


lead_adjudicator_agent = DeterministicAgent(
    name="LeadAdjudicatorAgent",
    description="Combines selected specialist findings into an appeal-defensible moderation decision.",
    agent_kind="lead",
)
