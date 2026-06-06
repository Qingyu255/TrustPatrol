from google.adk.agents import SequentialAgent

from backend.sub_agents import assessment_agent, investigation_agent

root_agent = SequentialAgent(
    name="TrustPatrolRootAgent",
    description=(
        "Sequential trust-and-safety workflow for investigating suspicious "
        "marketplace listing changes."
    ),
    sub_agents=[
        investigation_agent,
        assessment_agent,
    ],
)
