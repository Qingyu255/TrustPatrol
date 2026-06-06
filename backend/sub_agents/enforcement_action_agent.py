from backend.custom.deterministic_agent import DeterministicAgent


enforcement_action_agent = DeterministicAgent(
    name="EnforcementActionAgent",
    description="Converts the lead decision into a simulated Shopee Trust and Safety action log.",
    agent_kind="enforcement",
)
