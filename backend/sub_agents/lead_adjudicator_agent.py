from backend.sub_agents.phase2_base import Phase2DeterministicAgent


lead_adjudicator_agent = Phase2DeterministicAgent(
    name="LeadAdjudicatorAgent",
    description="Combines selected specialist findings into an appeal-defensible moderation decision.",
    agent_kind="lead",
)
