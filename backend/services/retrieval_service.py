import json
from typing import Any, TypedDict

from backend.services.azure_search_service import AzureSearchServiceError, search_private_docs
from backend.services.openai_service import (
    OpenAIServiceError,
    WebSearchResponse,
    call_llm,
    call_llm_with_search,
)


class WebResult(TypedDict):
    title: str
    snippet: str
    url: str


class WebContext(TypedDict):
    query: str
    insights: list[str]
    sources: list[WebResult]


class RetrievalServiceError(Exception):
    """Raised when web-context synthesis fails."""


_DOC_CONTEXT_LIMIT = 30_000  # chars — GPT-4o supports 128k context


def _normalise_source(raw: dict[str, Any]) -> WebResult:
    return {
        "title": str(raw.get("title", "")).strip(),
        "snippet": str(raw.get("snippet", "")).strip(),
        "url": str(raw.get("url", "")).strip(),
    }


async def fetch_web_context(
    query: str,
    additional_details: str | None = None,
    document_context: str | None = None,
) -> WebContext:
    """
    Gather context for the debate pipeline from three sources (in priority order):

      1. Azure OpenAI web_search_preview — live web results, no extra API key needed.
         Requires a gpt-4o / gpt-4o-mini deployment + API version 2025-01-01-preview.
         Gracefully skipped if the call fails (falls through to source 2).

      2. Azure AI Search — searches your private/uploaded document index.
         Skipped if AZURE_SEARCH_* env vars are not set.

      3. LLM synthesis — when neither source above is available the model
         synthesises context from the uploaded document text + its own knowledge.
    """
    query = query.strip()
    if not query:
        raise RetrievalServiceError("query cannot be empty")

    # ── 1. Try live web search via Azure OpenAI web_search_preview ───────────
    web_search: WebSearchResponse | None = None
    web_search_system = (
        "You are a research assistant for a business decision engine. "
        "Search the web for current, relevant information about the query. "
        "Provide a concise, factual summary of the most important findings. "
        "Focus on evidence, data, and context that would help evaluate the decision."
    )
    try:
        web_search = await call_llm_with_search(
            system_prompt=web_search_system,
            user_prompt=(
                f"Research this decision topic and provide key facts, context, and "
                f"recent developments:\n\n{query}"
                + (f"\n\nAdditional context: {additional_details}" if additional_details else "")
            ),
        )
    except OpenAIServiceError:
        # web_search_preview not available on this deployment — fall through gracefully
        web_search = None

    # ── 2. Query Azure AI Search (private / uploaded documents) ──────────────
    try:
        private_doc_results = await search_private_docs(query=query, top=5)
    except AzureSearchServiceError as exc:
        raise RetrievalServiceError(f"Azure Search error: {exc}") from exc

    has_web_search = web_search is not None and bool(web_search.sources or web_search.answer)
    has_private_docs = bool(private_doc_results)

    # ── 3. Synthesise insights via LLM ────────────────────────────────────────
    # Build a combined context payload from whatever sources are available.
    synthesis_prompt: dict[str, Any] = {
        "query": query,
        "additional_details": additional_details or "",
        "uploaded_document_context": (document_context or "")[:_DOC_CONTEXT_LIMIT],
    }

    if has_web_search:
        synthesis_prompt["live_web_search_summary"] = web_search.answer  # type: ignore[union-attr]
        synthesis_prompt["instruction"] = (
            "Extract concise, structured insights from the live_web_search_summary "
            "and uploaded_document_context. Focus on facts most relevant to evaluating "
            "the decision. Return sources as an empty array."
        )
    elif has_private_docs:
        synthesis_prompt["private_search_results"] = private_doc_results
        synthesis_prompt["instruction"] = (
            "Extract concise insights from private_search_results and "
            "uploaded_document_context. Return sources as an empty array."
        )
    else:
        synthesis_prompt["instruction"] = (
            "No external search results available. Synthesise relevant context from "
            "uploaded_document_context and your knowledge. "
            "Reflect uncertainty where appropriate. Return sources as an empty array."
        )

    system_prompt = (
        "You are a research assistant for a decision engine. "
        "Produce strict JSON with exactly two keys: insights, sources. "
        "insights: array of concise bullet strings grounded ONLY in the provided context. "
        "sources: always return as an empty array — the system attaches real verified sources. "
        "Do not use markdown. Do not add extra keys."
    )

    try:
        llm_output = await call_llm(
            system_prompt=system_prompt,
            user_prompt=json.dumps(synthesis_prompt, ensure_ascii=True),
            json_mode=True,
        )
    except OpenAIServiceError as exc:
        raise RetrievalServiceError(str(exc)) from exc

    # ── 4. Validate LLM output ────────────────────────────────────────────────
    if not isinstance(llm_output, dict):
        raise RetrievalServiceError("Web context output must be a JSON object")

    raw_insights = llm_output.get("insights")
    if not isinstance(raw_insights, list) or not all(isinstance(i, str) for i in raw_insights):
        raise RetrievalServiceError("insights must be a list of strings")

    # ── 5. Attach verified sources (priority: web search > private docs > none) ─
    # Never use LLM-generated URLs — always use sources from real search APIs.
    if has_web_search and web_search is not None:
        sources: list[WebResult] = [s.to_dict() for s in web_search.sources[:5]]  # type: ignore[attr-defined]
    elif has_private_docs:
        sources = [
            _normalise_source(r)
            for r in private_doc_results[:5]
            if isinstance(r, dict)
        ]
    else:
        sources = []

    return {
        "query": query,
        "insights": [i.strip() for i in raw_insights if i and i.strip()],
        "sources": sources,
    }