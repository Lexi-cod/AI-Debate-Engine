import json
from typing import Any, TypedDict

from backend.services.openai_service import OpenAIServiceError, call_llm


class SummaryResult(TypedDict):
    executive_summary: str
    key_risks: list[str]
    key_opportunities: list[str]
    final_recommendation: str


class SummaryServiceError(Exception):
    """Raised when summary generation fails or returns invalid output."""


SUMMARY_SYSTEM_PROMPT = (
    "You are a senior strategy analyst. "
    "Given a topic, debate outputs, and judge results, produce a concise decision brief. "
    "Return strict JSON only with keys: executive_summary, key_risks, key_opportunities, final_recommendation. "
    "key_risks and key_opportunities must be arrays of short strings. "
    "No markdown and no extra keys."
)


async def generate_summary(
    topic: str,
    debate_results: dict[str, Any],
    judge_results: dict[str, Any],
) -> SummaryResult:
    if not topic or not topic.strip():
        raise SummaryServiceError("topic cannot be empty")
    if not isinstance(debate_results, dict):
        raise SummaryServiceError("debate_results must be an object")
    if not isinstance(judge_results, dict):
        raise SummaryServiceError("judge_results must be an object")

    user_payload = {
        "topic": topic.strip(),
        "debate_results": debate_results,
        "judge_results": judge_results,
    }

    try:
        result = await call_llm(
            system_prompt=SUMMARY_SYSTEM_PROMPT,
            user_prompt=json.dumps(user_payload, ensure_ascii=True),
            json_mode=True,
        )
    except OpenAIServiceError as exc:
        raise SummaryServiceError(str(exc)) from exc

    if not isinstance(result, dict):
        raise SummaryServiceError("Summary output must be a JSON object")

    executive_summary = result.get("executive_summary")
    key_risks = result.get("key_risks")
    key_opportunities = result.get("key_opportunities")
    final_recommendation = result.get("final_recommendation")

    if not isinstance(executive_summary, str) or not executive_summary.strip():
        raise SummaryServiceError("executive_summary must be a non-empty string")
    if not isinstance(final_recommendation, str) or not final_recommendation.strip():
        raise SummaryServiceError("final_recommendation must be a non-empty string")

    if not isinstance(key_risks, list) or not all(isinstance(item, str) for item in key_risks):
        raise SummaryServiceError("key_risks must be a list of strings")
    if not isinstance(key_opportunities, list) or not all(
        isinstance(item, str) for item in key_opportunities
    ):
        raise SummaryServiceError("key_opportunities must be a list of strings")

    return {
        "executive_summary": executive_summary.strip(),
        "key_risks": [item.strip() for item in key_risks if item and item.strip()],
        "key_opportunities": [item.strip() for item in key_opportunities if item and item.strip()],
        "final_recommendation": final_recommendation.strip(),
    }
