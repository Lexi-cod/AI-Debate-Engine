from typing import TypedDict

from backend.services.openai_service import OpenAIServiceError, call_llm


class AnalyzerResult(TypedDict):
    decision_type: str
    entity: str | None
    requires_web: bool


class AnalyzerServiceError(Exception):
    """Raised when analyzer output is missing required fields or invalid."""


SYSTEM_PROMPT = (
    "You are an intent analyzer for a decision engine. "
    "Extract structured intent from user input and return JSON only. "
    "Return exactly one JSON object with keys: "
    "decision_type (string), entity (string or null), requires_web (boolean). "
    "Do not include markdown, comments, or extra keys."
)


async def analyze_user_input(raw_user_input: str) -> AnalyzerResult:
    if not raw_user_input or not raw_user_input.strip():
        raise AnalyzerServiceError("raw_user_input cannot be empty")

    user_prompt = (
        "Analyze this user request and produce the required JSON object.\n\n"
        f"User input: {raw_user_input.strip()}"
    )

    try:
        result = await call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            json_mode=True,
        )
    except OpenAIServiceError as exc:
        raise AnalyzerServiceError(str(exc)) from exc

    if not isinstance(result, dict):
        raise AnalyzerServiceError("Analyzer response must be a JSON object")

    decision_type = result.get("decision_type")
    entity = result.get("entity")
    requires_web = result.get("requires_web")

    if not isinstance(decision_type, str) or not decision_type.strip():
        raise AnalyzerServiceError("decision_type must be a non-empty string")

    if entity is not None and not isinstance(entity, str):
        raise AnalyzerServiceError("entity must be a string or null")

    if not isinstance(requires_web, bool):
        raise AnalyzerServiceError("requires_web must be a boolean")

    return {
        "decision_type": decision_type.strip(),
        "entity": entity.strip() if isinstance(entity, str) else None,
        "requires_web": requires_web,
    }
