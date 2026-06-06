from backend.custom.tool_specialist_agent import ToolUsingSpecialistAgent, listing_timeline_arg
from backend.tools import detect_price_anomaly


pricing_agent = ToolUsingSpecialistAgent(
    name="PricingAgent",
    description="Inspects listing timelines for abnormal pricing behavior.",
    domain_instruction=(
        "Focus only on post-approval pricing behavior. "
        "Explain whether the price movement is a review signal while noting that discounts can be legitimate."
    ),
    tools_to_run=[
        ("detect_price_anomaly", lambda case: detect_price_anomaly(listing_timeline_arg(case))),
    ],
)
