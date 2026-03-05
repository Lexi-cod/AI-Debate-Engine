import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import backend.services.db_service as db_service
import backend.services.openai_service as openai_service
from main import app


async def _fake_call_llm(system_prompt: str, user_prompt: str, json_mode: bool = False):
    system_prompt_l = (system_prompt or "").lower()

    if "intent analyzer" in system_prompt_l:
        return {"decision_type": "Strategic", "entity": None, "requires_web": False}

    if "research assistant" in system_prompt_l:
        return {"insights": ["No external search executed in smoke test."], "sources": []}

    if "agent a" in system_prompt_l:
        return "Proceed: benefits outweigh risks for this constrained scenario."

    if "agent b" in system_prompt_l:
        return "Do not proceed: risks and unknowns outweigh expected benefits."

    if "impartial adjudicator" in system_prompt_l:
        return {
            "winner": "A",
            "confidence": 0.7,
            "reasoning": "Agent A is slightly more coherent for the given constraints.",
            "scores": {
                "agent_a": {
                    "logical_coherence": 7,
                    "evidence_strength": 6,
                    "risk_assessment": 7,
                    "relevance": 8,
                },
                "agent_b": {
                    "logical_coherence": 6,
                    "evidence_strength": 5,
                    "risk_assessment": 7,
                    "relevance": 7,
                },
            },
        }

    if "senior strategy analyst" in system_prompt_l:
        return {
            "executive_summary": "Proceed with a limited pilot and explicit stop conditions.",
            "key_risks": ["Execution complexity", "Hidden costs"],
            "key_opportunities": ["Learning value", "Speed to market"],
            "final_recommendation": "Run a 4-week pilot, then reassess with measured outcomes.",
        }

    if json_mode:
        return {}
    return ""


def _install_fakes() -> None:
    openai_service.call_llm = _fake_call_llm  # type: ignore[assignment]

    def _fake_save_decision(decision_data: dict[str, Any]) -> dict[str, Any]:
        return {"id": "smoke-id", **decision_data}

    db_service.save_decision = _fake_save_decision  # type: ignore[assignment]


def main() -> None:
    _install_fakes()

    with TestClient(app) as client:
        resp = client.post(
            "/api/decision",
            data={"question": "Should we launch feature X?", "additional_details": "Constrained budget."},
        )
        resp.raise_for_status()
        payload = resp.json()

    required_top_level = ["topic", "analysis", "debate", "judge", "summary", "saved", "timestamp"]
    missing = [k for k in required_top_level if k not in payload]
    if missing:
        raise SystemExit(f"Smoke test failed: missing keys: {missing}")

    print("OK: decision flow returned summary:", payload["summary"].get("executive_summary"))


if __name__ == "__main__":
    main()
