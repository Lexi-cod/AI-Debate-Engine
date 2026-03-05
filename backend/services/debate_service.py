import asyncio
import json
from typing import Any, TypedDict

from backend.services.openai_service import OpenAIServiceError, call_llm


class DebateResult(TypedDict):
    agent_a: str   # full transcript — all rounds joined
    agent_b: str
    rounds: int    # how many rounds were actually run


class DebateServiceError(Exception):
    """Raised when debate generation fails."""


AGENT_A_SYSTEM_PROMPT = (
    "You are Agent A, a professional analyst arguing FOR the proposed decision. "
    "Use evidence and clear reasoning. If prior counter-arguments are provided, "
    "directly rebut them with specific points. Keep each response concise and analytical."
)

AGENT_B_SYSTEM_PROMPT = (
    "You are Agent B, a professional analyst arguing AGAINST the proposed decision. "
    "Identify risks, constraints, and counter-evidence. If prior arguments are provided, "
    "directly rebut them with specific challenges. Keep each response concise and analytical."
)


def _build_round_prompt(
    topic: str,
    structured_context: dict[str, Any],
    opponent_history: list[str],
    round_num: int,
) -> str:
    payload: dict[str, Any] = {
        "topic": topic.strip(),
        "context": structured_context,
        "round": round_num + 1,
    }
    if opponent_history:
        payload["opponent_arguments"] = opponent_history
        payload["instruction"] = (
            "Respond to your opponent's latest argument. Rebut their specific points "
            "before advancing your own new evidence. Be direct and focused."
        )
    else:
        payload["instruction"] = (
            "This is the opening round. Present your strongest argument for your position "
            "grounded in the context provided."
        )
    return json.dumps(payload, ensure_ascii=True)


async def run_debate(
    topic: str,
    structured_context: dict[str, Any],
    rounds: int = 2,
) -> DebateResult:
    if not topic or not topic.strip():
        raise DebateServiceError("topic cannot be empty")
    if not isinstance(structured_context, dict):
        raise DebateServiceError("structured_context must be a JSON-like object")

    rounds = max(1, min(int(rounds), 4))  # clamp 1–4 rounds

    history_a: list[str] = []
    history_b: list[str] = []

    for round_num in range(rounds):
        # Each agent sees the other's accumulated arguments as "opponent_history"
        prompt_a = _build_round_prompt(topic, structured_context, history_b, round_num)
        prompt_b = _build_round_prompt(topic, structured_context, history_a, round_num)

        try:
            response_a, response_b = await asyncio.gather(
                call_llm(system_prompt=AGENT_A_SYSTEM_PROMPT, user_prompt=prompt_a),
                call_llm(system_prompt=AGENT_B_SYSTEM_PROMPT, user_prompt=prompt_b),
            )
        except OpenAIServiceError as exc:
            raise DebateServiceError(str(exc)) from exc
        except Exception as exc:
            raise DebateServiceError(f"Debate generation failed at round {round_num + 1}: {exc}") from exc

        if not isinstance(response_a, str) or not response_a.strip():
            raise DebateServiceError(f"Agent A returned invalid response at round {round_num + 1}")
        if not isinstance(response_b, str) or not response_b.strip():
            raise DebateServiceError(f"Agent B returned invalid response at round {round_num + 1}")

        history_a.append(f"[Round {round_num + 1}]\n{response_a.strip()}")
        history_b.append(f"[Round {round_num + 1}]\n{response_b.strip()}")

    return {
        "agent_a": "\n\n".join(history_a),
        "agent_b": "\n\n".join(history_b),
        "rounds":  rounds,
    }