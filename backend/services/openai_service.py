import json
import os
from typing import Any

import httpx

REQUEST_TIMEOUT_SECONDS = 120.0  # raised from 30s — LLM + web search can take 40-60s


class OpenAIServiceError(Exception):
    """Raised when Azure OpenAI request or parsing fails."""


def _get_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise OpenAIServiceError(f"Missing required environment variable: {name}")
    return value


def _get_float_env_optional(name: str) -> float | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError as exc:
        raise OpenAIServiceError(f"Invalid float for environment variable: {name}") from exc


def _get_int_env_optional(name: str) -> int | None:
    raw = os.getenv(name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise OpenAIServiceError(f"Invalid int for environment variable: {name}") from exc


def _get_api_version() -> str:
    # Bumped default to 2025-01-01-preview — required for web_search_preview tool
    # and reliable json_object response_format support.
    return os.getenv("AZURE_OPENAI_API_VERSION", "").strip() or "2025-01-01-preview"


def _build_url(endpoint: str, deployment: str, api_version: str) -> str:
    endpoint = endpoint.rstrip("/")
    return (
        f"{endpoint}/openai/deployments/{deployment}/chat/completions"
        f"?api-version={api_version}"
    )


async def call_llm(system_prompt: str, user_prompt: str, json_mode: bool = False) -> Any:
    """Standard LLM call — no tools, optional JSON mode."""
    endpoint = _get_env("AZURE_OPENAI_ENDPOINT")
    api_key = _get_env("AZURE_OPENAI_API_KEY")
    deployment = _get_env("AZURE_OPENAI_DEPLOYMENT")
    api_version = _get_api_version()

    temperature = _get_float_env_optional("LLM_TEMPERATURE")
    max_tokens = _get_int_env_optional("LLM_MAX_TOKENS")

    payload: dict[str, Any] = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2 if temperature is None else temperature,
    }

    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        payload["messages"][0]["content"] = (
            f"{system_prompt}\nReturn a strict JSON object response only."
        )

    headers = {"api-key": api_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
            response = await client.post(
                _build_url(endpoint, deployment, api_version),
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise OpenAIServiceError("Azure OpenAI request timed out") from exc
    except httpx.HTTPStatusError as exc:
        raise OpenAIServiceError(
            f"Azure OpenAI request failed with status {exc.response.status_code}: "
            f"{exc.response.text[:500]}"
        ) from exc
    except httpx.HTTPError as exc:
        raise OpenAIServiceError(f"Azure OpenAI HTTP error: {exc}") from exc

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise OpenAIServiceError("Invalid Azure OpenAI response format") from exc

    if json_mode:
        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise OpenAIServiceError("Model did not return valid JSON in json_mode") from exc

    return content


class WebSearchResult:
    """Parsed result from a single web search citation returned by the model."""
    __slots__ = ("title", "url", "snippet")

    def __init__(self, title: str, url: str, snippet: str) -> None:
        self.title = title
        self.url = url
        self.snippet = snippet

    def to_dict(self) -> dict[str, str]:
        return {"title": self.title, "url": self.url, "snippet": self.snippet}


class WebSearchResponse:
    """Return value from call_llm_with_search."""
    __slots__ = ("answer", "sources")

    def __init__(self, answer: str, sources: list[WebSearchResult]) -> None:
        self.answer = answer
        self.sources = sources


async def call_llm_with_search(
    system_prompt: str,
    user_prompt: str,
    search_deployment: str | None = None,
) -> WebSearchResponse:
    """
    Call Azure OpenAI with the web_search_preview tool enabled.

    The model performs live web searches grounded in the query and returns
    a synthesised answer plus citations — no Bing API key required.

    Requirements
    ------------
    - Your Azure OpenAI deployment must be gpt-4o or gpt-4o-mini
    - API version must be 2025-01-01-preview or later (set AZURE_OPENAI_API_VERSION)
    - Optionally set AZURE_OPENAI_SEARCH_DEPLOYMENT to use a separate deployment
      for search calls (e.g. a gpt-4o deployment while agents use gpt-4o-mini)

    Returns
    -------
    WebSearchResponse with:
      .answer  — the model's synthesised text response
      .sources — list of WebSearchResult(title, url, snippet) from citations
    """
    endpoint = _get_env("AZURE_OPENAI_ENDPOINT")
    api_key = _get_env("AZURE_OPENAI_API_KEY")
    api_version = _get_api_version()

    # Use a dedicated search deployment if configured, else fall back to default
    deployment = (
        search_deployment
        or os.getenv("AZURE_OPENAI_SEARCH_DEPLOYMENT", "").strip()
        or _get_env("AZURE_OPENAI_DEPLOYMENT")
    )

    payload: dict[str, Any] = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        # web_search_preview tells the model it can run live web searches
        "tools": [{"type": "web_search_preview"}],
        # auto = model decides when to search; set to {"type": "web_search_preview"}
        # to force a search on every call
        "tool_choice": "auto",
        "temperature": 0.2,
    }

    headers = {"api-key": api_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS)) as client:
            response = await client.post(
                _build_url(endpoint, deployment, api_version),
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise OpenAIServiceError("Azure OpenAI web-search request timed out") from exc
    except httpx.HTTPStatusError as exc:
        raise OpenAIServiceError(
            f"Azure OpenAI web-search request failed ({exc.response.status_code}): "
            f"{exc.response.text[:500]}"
        ) from exc
    except httpx.HTTPError as exc:
        raise OpenAIServiceError(f"Azure OpenAI web-search HTTP error: {exc}") from exc

    try:
        data = response.json()
    except ValueError as exc:
        raise OpenAIServiceError("Azure OpenAI returned invalid JSON") from exc

    # ── Extract answer text ───────────────────────────────────────────────────
    # The model may return multiple content blocks (text + tool_use).
    # Concatenate all text blocks into a single answer string.
    message = data.get("choices", [{}])[0].get("message", {})
    raw_content = message.get("content", "")

    if isinstance(raw_content, list):
        # Structured content blocks — join all text parts
        answer = " ".join(
            block.get("text", "")
            for block in raw_content
            if isinstance(block, dict) and block.get("type") == "text"
        ).strip()
    elif isinstance(raw_content, str):
        answer = raw_content.strip()
    else:
        answer = ""

    if not answer:
        raise OpenAIServiceError("Azure OpenAI web-search returned an empty answer")

    # ── Extract citations ─────────────────────────────────────────────────────
    # Azure OpenAI returns citations in message.context.citations
    sources: list[WebSearchResult] = []
    context = message.get("context", {})
    citations = context.get("citations", []) if isinstance(context, dict) else []

    for citation in citations:
        if not isinstance(citation, dict):
            continue
        title = str(citation.get("title", "")).strip()
        url = str(citation.get("url", "")).strip()
        snippet = str(citation.get("content", citation.get("snippet", ""))).strip()
        if title or url:
            sources.append(WebSearchResult(title=title, url=url, snippet=snippet[:400]))

    return WebSearchResponse(answer=answer, sources=sources)