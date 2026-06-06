import os

from google.adk.models.lite_llm import LiteLlm


class WebSerializableLiteLlm(LiteLlm):
    def model_dump(self, *args, **kwargs) -> str:
        return self.model


class Config:
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini")
    TRUSTPATROL_LLM_ROUTER = os.getenv("TRUSTPATROL_LLM_ROUTER", "true").lower() == "true"
    TRUSTPATROL_LLM_SPECIALISTS = os.getenv("TRUSTPATROL_LLM_SPECIALISTS", "true").lower() == "true"
    TRUSTPATROL_REQUIRE_LLM = os.getenv("TRUSTPATROL_REQUIRE_LLM", "false").lower() == "true"
    TRUSTPATROL_LLM_TIMEOUT_SECONDS = float(os.getenv("TRUSTPATROL_LLM_TIMEOUT_SECONDS", "15"))

    @classmethod
    def openai_model(cls) -> WebSerializableLiteLlm:
        return WebSerializableLiteLlm(model=cls.OPENAI_MODEL)
