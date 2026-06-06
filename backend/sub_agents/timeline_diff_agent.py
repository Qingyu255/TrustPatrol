from backend.sub_agents.phase2_base import Phase2DeterministicAgent


timeline_diff_agent = Phase2DeterministicAgent(
    name="TimelineDiffAgent",
    description="Computes structured listing-change signals from the submitted marketplace case.",
    agent_kind="timeline_diff",
)
