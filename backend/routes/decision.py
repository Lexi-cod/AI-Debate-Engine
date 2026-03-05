import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from backend.dependencies import verify_api_key
from backend.models.decision import DecisionResponse
from backend.services.analyzer_service import AnalyzerServiceError, analyze_user_input
from backend.services.db_service import DBServiceError, get_all_decisions, get_decision_by_id, save_decision
from backend.services.debate_service import DebateServiceError, run_debate
from backend.services.document_service import DocumentServiceError, parse_uploaded_documents
from backend.services.judge_service import JudgeServiceError, judge_arguments
from backend.services.retrieval_service import RetrievalServiceError, fetch_web_context
from backend.services.summary_service import SummaryServiceError, generate_summary

router = APIRouter(tags=["decision"], dependencies=[Depends(verify_api_key)])


@router.post("/decision", response_model=DecisionResponse)
async def create_decision(
    question:           str                    = Form(...),
    additional_details: str | None             = Form(default=None),
    decision_type:      str | None             = Form(default=None),   # e.g. Strategic, Financial
    rounds:             int                    = Form(default=2),       # debate rounds 1-4
    files:              list[UploadFile] | None = File(default=None),
) -> DecisionResponse:

    topic = question.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="question cannot be empty")

    rounds = max(1, min(rounds, 4))
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Parse uploaded documents ──────────────────────────────────────────────
    try:
        document_context = await parse_uploaded_documents(files)
    except DocumentServiceError as exc:
        raise HTTPException(status_code=400, detail=f"Document parsing failed: {exc}") from exc

    # ── Build analysis input ──────────────────────────────────────────────────
    analysis_input = topic
    if additional_details and additional_details.strip():
        analysis_input += f"\n\nAdditional details:\n{additional_details.strip()}"
    if document_context["combined_text"]:
        analysis_input += f"\n\nUploaded document context:\n{document_context['combined_text'][:30000]}"

    # ── 1+2) Analyse input AND speculatively start retrieval in parallel ──────
    # We kick off both tasks concurrently. If analysis says requires_web=False
    # we discard the retrieval result; the overlap still saves ~1-2s on average.
    analysis_task  = analyze_user_input(analysis_input)
    retrieval_task = fetch_web_context(
        query=topic,
        additional_details=additional_details,
        document_context=document_context["combined_text"],
    )

    try:
        analysis, speculative_web = await asyncio.gather(
            analysis_task,
            retrieval_task,
            return_exceptions=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Pipeline initialisation failed: {exc}") from exc

    if isinstance(analysis, AnalyzerServiceError):
        raise HTTPException(status_code=502, detail=f"Input analysis failed: {analysis}")
    if isinstance(analysis, Exception):
        raise HTTPException(status_code=502, detail=f"Input analysis failed: {analysis}")

    # Only use web context if analysis actually requested it
    web_context: dict[str, Any] | None = None
    if analysis.get("requires_web") is True:
        if isinstance(speculative_web, RetrievalServiceError):
            raise HTTPException(status_code=502, detail=f"Web retrieval failed: {speculative_web}")
        if isinstance(speculative_web, Exception):
            raise HTTPException(status_code=502, detail=f"Web retrieval failed: {speculative_web}")
        web_context = speculative_web  # type: ignore[assignment]

    # ── 3) Run debate (multi-round) ───────────────────────────────────────────
    debate_context = {
        "analysis":         analysis,
        "web_context":      web_context,
        "additional_details": (additional_details or "").strip(),
        "documents":        document_context["documents"],
        "decision_type":    decision_type or "General",
    }
    try:
        debate = await run_debate(
            topic=topic,
            structured_context=debate_context,
            rounds=rounds,
        )
    except DebateServiceError as exc:
        raise HTTPException(status_code=502, detail=f"Debate generation failed: {exc}") from exc

    # ── 4) Run judge ──────────────────────────────────────────────────────────
    try:
        judge = await judge_arguments(agent_a=debate["agent_a"], agent_b=debate["agent_b"])
    except JudgeServiceError as exc:
        raise HTTPException(status_code=502, detail=f"Judging failed: {exc}") from exc

    # ── 5) Generate summary ───────────────────────────────────────────────────
    try:
        summary = await generate_summary(
            topic=topic,
            debate_results=debate,
            judge_results=judge,
        )
    except SummaryServiceError as exc:
        raise HTTPException(status_code=502, detail=f"Summary generation failed: {exc}") from exc

    # ── 6) Save to Cosmos DB ──────────────────────────────────────────────────
    # Use human-readable verdict as the primary decision field
    decision_record = {
        "topic":        topic,
        "decision":     judge.get("verdict", judge["winner"]),   # human-readable
        "confidence":   judge["confidence"],
        "summary":      summary["executive_summary"],
        "timestamp":    timestamp,
        "decision_type": decision_type or "General",
        "debate":       debate,
        "judge":        judge,
        "full_summary": summary,
        "analysis":     analysis,
        "web_context":  web_context,
    }

    saved = False
    saved_id: str | None = None
    try:
        saved_doc = await run_in_threadpool(save_decision, decision_record)
        saved = True
        saved_id = str(saved_doc.get("id", "")).strip() or None
    except DBServiceError as exc:
        raise HTTPException(status_code=500, detail=f"Database save failed: {exc}") from exc

    # ── 7) Return response ────────────────────────────────────────────────────
    return DecisionResponse(
        id=saved_id,
        topic=topic,
        additional_details=(additional_details or "").strip() or None,
        documents=document_context["documents"],
        analysis=analysis,
        web_context=web_context,
        debate=debate,
        judge=judge,
        summary=summary,
        saved=saved,
        timestamp=timestamp,
    )


@router.get("/decisions")
async def list_decisions() -> list[dict[str, Any]]:
    try:
        return await run_in_threadpool(get_all_decisions)
    except DBServiceError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch decisions: {exc}") from exc


@router.get("/decisions/{id}")
async def get_decision(id: str) -> dict[str, Any]:
    try:
        decision = await run_in_threadpool(get_decision_by_id, id)
    except DBServiceError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch decision: {exc}") from exc

    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not found")

    return decision