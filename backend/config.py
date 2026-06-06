import os

from google.adk.models.lite_llm import LiteLlm


class WebSerializableLiteLlm(LiteLlm):
    def model_dump(self, *args, **kwargs) -> str:
        return self.model


class Config:
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini")

    @classmethod
    def openai_model(cls) -> WebSerializableLiteLlm:
        return WebSerializableLiteLlm(model=cls.OPENAI_MODEL)
