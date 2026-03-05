import os
from typing import Any, TypedDict

import httpx


class AzureSearchResult(TypedDict, total=False):
    title: str
    snippet: str
    url: str
    score: float


class AzureSearchServiceError(Exception):
    """Raised when Azure AI Search query fails or is misconfigured."""


API_VERSION = "2023-11-01"
REQUEST_TIMEOUT_SECONDS = 15.0


def _get_env_optional(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def _get_endpoint() -> str | None:
    endpoint = _get_env_optional("AZURE_SEARCH_ENDPOINT")
    if not endpoint:
        return None
    return endpoint.rstrip("/")


def _guess_title(doc: dict[str, Any]) -> str:
    for key in ("title", "name", "filename", "file_name", "id", "document_id", "key"):
        value = doc.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Result"


def _guess_url(doc: dict[str, Any]) -> str:
    for key in ("url", "source", "metadata_storage_path", "path", "link"):
        value = doc.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _guess_snippet(doc: dict[str, Any]) -> str:
    for key in ("snippet", "content", "chunk", "text", "body", "summary"):
        value = doc.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:500]
    return ""


async def search_private_docs(query: str, top: int = 5) -> list[AzureSearchResult]:
    endpoint = _get_endpoint()
    api_key = _get_env_optional("AZURE_SEARCH_API_KEY")
    index_name = _get_env_optional("AZURE_SEARCH_INDEX_NAME")

    if not endpoint or not api_key or not index_name:
        return []

    url = f"{endpoint}/indexes/{index_name}/docs/search?api-version={API_VERSION}"
    headers = {"api-key": api_key, "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "search": query.strip() or "*",
        "top": max(1, min(int(top), 10)),
        "queryType": "simple",
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException as exc:
        raise AzureSearchServiceError("Azure Search request timed out") from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        body_text = exc.response.text[:500]
        raise AzureSearchServiceError(
            f"Azure Search request failed with status {status_code}: {body_text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise AzureSearchServiceError(f"Azure Search HTTP error: {exc}") from exc
    except ValueError as exc:
        raise AzureSearchServiceError("Azure Search returned invalid JSON") from exc

    raw_items = data.get("value")
    if not isinstance(raw_items, list):
        return []

    results: list[AzureSearchResult] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "title": _guess_title(item),
                "snippet": _guess_snippet(item),
                "url": _guess_url(item),
                "score": float(item.get("@search.score", 0.0) or 0.0),
            }
        )

    return results

