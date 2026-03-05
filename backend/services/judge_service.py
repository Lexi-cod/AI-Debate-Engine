import json
from typing import Any, TypedDict

from backend.services.openai_service import OpenAIServiceError, call_llm


class AgentScores(TypedDict):
    logical_coherence: float
    evidence_strength: float
    risk_assessment: float
    relevance: float


class JudgeScores(TypedDict):
    agent_a: AgentScores
    agent_b: AgentScores


class JudgeResult(TypedDict):
    winner: str
    confidence: float
    reasoning: str
    scores: JudgeScores


class JudgeServiceError(Exception):
    """Raised when judging output is invalid or judge call fails."""


JUDGE_SYSTEM_PROMPT = (
    "You are an impartial adjudicator for an AI decision engine. "
    "Compare Agent A and Agent B arguments using these criteria: "
    "logical coherence, evidence strength, risk assessment, relevance. "
    "Return strict JSON only with keys: winner, confidence, reasoning, scores. "
    "winner must be 'A' or 'B'. confidence must be a float between 0 and 1. "
    "scores must include agent_a and agent_b objects, each containing numeric "
    "logical_coherence, evidence_strength, risk_assessment, relevance (0-10)."
)


def _normalize_score(value: Any, field_name: str) -> float:
    if not isinstance(value, (int, float)):
        raise JudgeServiceError(f"{field_name} must be numeric")
    score = float(value)
    if score < 0.0 or score > 10.0:
        raise JudgeServiceError(f"{field_name} must be between 0 and 10")
    return score


def _parse_agent_scores(raw: Any, agent_name: str) -> AgentScores:
    if not isinstance(raw, dict):
        raise JudgeServiceError(f"scores.{agent_name} must be an object")

    return {
        "logical_coherence": _normalize_score(
            raw.get("logical_coherence"), f"scores.{agent_name}.logical_coherence"
        ),
        "evidence_strength": _normalize_score(
            raw.get("evidence_strength"), f"scores.{agent_name}.evidence_strength"
        ),
        "risk_assessment": _normalize_score(
            raw.get("risk_assessment"), f"scores.{agent_name}.risk_assessment"
        ),
        "relevance": _normalize_score(raw.get("relevance"), f"scores.{agent_name}.relevance"),
    }


async def judge_arguments(agent_a: str, agent_b: str) -> JudgeResult:
    if not agent_a or not agent_a.strip():
        raise JudgeServiceError("agent_a cannot be empty")
    if not agent_b or not agent_b.strip():
        raise JudgeServiceError("agent_b cannot be empty")

    user_payload = {
        "agent_a": agent_a.strip(),
        "agent_b": agent_b.strip(),
        "criteria": [
            "logical coherence",
            "evidence strength",
            "risk assessment",
            "relevance",
        ],
    }

    try:
        raw_result = await call_llm(
            system_prompt=JUDGE_SYSTEM_PROMPT,
            user_prompt=json.dumps(user_payload, ensure_ascii=True),
            json_mode=True,
        )
    except OpenAIServiceError as exc:
        raise JudgeServiceError(str(exc)) from exc

    if not isinstance(raw_result, dict):
        raise JudgeServiceError("Judge output must be a JSON object")

    winner = raw_result.get("winner")
    confidence = raw_result.get("confidence")
    reasoning = raw_result.get("reasoning")
    raw_scores = raw_result.get("scores")

    if winner not in ("A", "B"):
        raise JudgeServiceError("winner must be 'A' or 'B'")

    if not isinstance(confidence, (int, float)):
        raise JudgeServiceError("confidence must be numeric")
    confidence_value = float(confidence)
    if confidence_value < 0.0 or confidence_value > 1.0:
        raise JudgeServiceError("confidence must be between 0 and 1")

    if not isinstance(reasoning, str) or not reasoning.strip():
        raise JudgeServiceError("reasoning must be a non-empty string")

    if not isinstance(raw_scores, dict):
        raise JudgeServiceError("scores must be an object")

    agent_a_scores = _parse_agent_scores(raw_scores.get("agent_a"), "agent_a")
    agent_b_scores = _parse_agent_scores(raw_scores.get("agent_b"), "agent_b")

    return {
        "winner": winner,
        "confidence": confidence_value,
        "reasoning": reasoning.strip(),
        "scores": {
            "agent_a": agent_a_scores,
            "agent_b": agent_b_scores,
        },
    }
