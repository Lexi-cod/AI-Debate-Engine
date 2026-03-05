import os
import uuid
from datetime import datetime, timezone
from typing import Any

from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosHttpResponseError


class DBServiceError(Exception):
    """Raised when Cosmos DB operations fail or inputs are invalid."""


# ---------------------------------------------------------------------------
# Singleton container client
# ---------------------------------------------------------------------------
# CosmosClient.from_connection_string() opens a TLS connection and authenticates
# against Azure. The original code called this inside every function, meaning a
# brand-new connection was created on every save/read — adding 200-500ms latency
# per request and risking connection pool exhaustion under load.
#
# Fix: build the client once at module level and reuse it for the lifetime of
# the process. FastAPI workers are long-lived, so this is safe and correct.
# ---------------------------------------------------------------------------

def _build_container():
    """Create and return the Cosmos container proxy. Called once at import time."""
    connection_string = os.getenv("COSMOS_CONNECTION_STRING", "").strip()
    database_id = os.getenv("COSMOS_DB_NAME", "").strip()
    container_id = os.getenv("COSMOS_CONTAINER_NAME", "").strip()

    if not connection_string:
        raise DBServiceError("Missing required environment variable: COSMOS_CONNECTION_STRING")
    if not database_id:
        raise DBServiceError("Missing required environment variable: COSMOS_DB_NAME")
    if not container_id:
        raise DBServiceError("Missing required environment variable: COSMOS_CONTAINER_NAME")

    try:
        client = CosmosClient.from_connection_string(connection_string)
        return client.get_database_client(database_id).get_container_client(container_id)
    except Exception as exc:
        raise DBServiceError(f"Failed to connect to Cosmos DB: {exc}") from exc


# Module-level singleton — one connection for the entire process lifetime
_container = None


def _get_container():
    """Return the shared container proxy, initialising it on first call."""
    global _container
    if _container is None:
        _container = _build_container()
    return _container


# ---------------------------------------------------------------------------
# Data sanitisation
# ---------------------------------------------------------------------------

def _sanitize_decision_data(decision_data: dict[str, Any]) -> dict[str, Any]:
    """
    Validate and normalise the decision record before writing to Cosmos.

    Required fields: topic, decision, confidence, summary
    Optional fields: debate, judge, full_summary, analysis, web_context, timestamp

    The full debate payload (agent arguments, judge scores, risks, opportunities)
    is now persisted alongside the summary so the history view can reconstruct
    the complete debate — not just the one-line executive summary.
    """
    if not isinstance(decision_data, dict):
        raise DBServiceError("decision_data must be an object")

    required_fields = ["topic", "decision", "confidence", "summary"]
    missing = [f for f in required_fields if f not in decision_data]
    if missing:
        raise DBServiceError(f"Missing required decision_data field(s): {', '.join(missing)}")

    topic = str(decision_data.get("topic", "")).strip()
    decision = str(decision_data.get("decision", "")).strip()
    summary = str(decision_data.get("summary", "")).strip()
    confidence = decision_data.get("confidence")

    if not topic:
        raise DBServiceError("topic must be a non-empty string")
    if not decision:
        raise DBServiceError("decision must be a non-empty string")
    if not summary:
        raise DBServiceError("summary must be a non-empty string")
    if not isinstance(confidence, (int, float)):
        raise DBServiceError("confidence must be numeric")

    timestamp = decision_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    item_id = str(decision_data.get("id") or uuid.uuid4())

    record: dict[str, Any] = {
        "id": item_id,
        "topic": topic,
        "decision": decision,
        "confidence": float(confidence),
        "summary": summary,
        "timestamp": str(timestamp),
    }

    # ---------------------------------------------------------------------------
    # Persist the full debate payload so history is actually useful.
    # Previously only 5 fields were saved — agent arguments, judge scores,
    # key risks, and opportunities were all discarded after each run.
    # ---------------------------------------------------------------------------

    # Full debate agent arguments
    debate = decision_data.get("debate")
    if isinstance(debate, dict):
        record["debate"] = debate

    # Full judge output (scores, reasoning, winner)
    judge = decision_data.get("judge")
    if isinstance(judge, dict):
        record["judge"] = judge

    # Full summary (risks, opportunities, recommendation — not just executive summary)
    full_summary = decision_data.get("full_summary")
    if isinstance(full_summary, dict):
        record["full_summary"] = full_summary

    # Analyzer output (decision_type, entity, requires_web)
    analysis = decision_data.get("analysis")
    if isinstance(analysis, dict):
        record["analysis"] = analysis

    # Web context (insights + sources used during debate)
    web_context = decision_data.get("web_context")
    if isinstance(web_context, dict):
        record["web_context"] = web_context

    return record


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_decision(decision_data: dict[str, Any]) -> dict[str, Any]:
    item = _sanitize_decision_data(decision_data)
    container = _get_container()
    try:
        return container.upsert_item(item)
    except CosmosHttpResponseError as exc:
        raise DBServiceError(f"Failed to save decision: {exc}") from exc


def get_all_decisions() -> list[dict[str, Any]]:
    """
    Returns a lightweight list for the history table — core fields only.
    Full debate payloads are fetched individually via get_decision_by_id.
    """
    container = _get_container()
    query = (
        "SELECT c.id, c.topic, c.decision, c.confidence, c.summary, c.timestamp "
        "FROM c ORDER BY c.timestamp DESC"
    )
    try:
        return [dict(item) for item in container.query_items(
            query=query, enable_cross_partition_query=True
        )]
    except CosmosHttpResponseError as exc:
        raise DBServiceError(f"Failed to fetch decisions: {exc}") from exc


def get_decision_by_id(decision_id: str) -> dict[str, Any] | None:
    """Returns the full record including debate, judge, and summary payloads."""
    decision_id = str(decision_id).strip()
    if not decision_id:
        raise DBServiceError("id cannot be empty")

    container = _get_container()
    query = "SELECT * FROM c WHERE c.id = @id"
    parameters = [{"name": "@id", "value": decision_id}]

    try:
        results = list(container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        ))
    except CosmosHttpResponseError as exc:
        raise DBServiceError(f"Failed to fetch decision by id: {exc}") from exc

    return dict(results[0]) if results else None