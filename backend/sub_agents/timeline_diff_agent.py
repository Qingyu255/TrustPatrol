from backend.custom.deterministic_agent import DeterministicAgent


timeline_diff_agent = DeterministicAgent(
    name="TimelineDiffAgent",
    description="Computes structured listing-change signals from the submitted marketplace case.",
    agent_kind="timeline_diff",
)
