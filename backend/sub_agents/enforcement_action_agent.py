from backend.sub_agents.phase2_base import Phase2DeterministicAgent


enforcement_action_agent = Phase2DeterministicAgent(
    name="EnforcementActionAgent",
    description="Converts the lead decision into a simulated Shopee Trust and Safety action log.",
    agent_kind="enforcement",
)
