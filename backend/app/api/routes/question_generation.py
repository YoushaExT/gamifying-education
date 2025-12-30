"""API routes for question generation."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import func, select

from app.api.deps import CurrentTeacherOrSuperuser, FeatureFlagsDep, SessionDep
from app.core.config import settings
from app.models import (
    GeneratedQuestion,
    GeneratedQuestionsPublic,
    Message,
    QuestionPublic,
)
from app.services.openai_provider import OpenAIProvider
from app.services.question_generator import QuestionGeneratorService
from app.services.review_service import ReviewService
from app.services.template_service import TemplateService
from app.services.validators import (
    ContentValidator,
    FormatValidator,
    QuestionValidator,
)

router = APIRouter()


def check_ai_generation_feature(feature_flags: Any, current_user: Any) -> None:
    """Check if AI question generation feature is enabled for the current user."""
    user_roles = []
    if current_user.is_superuser:
        user_roles.append("superuser")
    if current_user.is_teacher:
        user_roles.append("teacher")

    if not feature_flags.is_enabled(
        "ai_question_generation",
        user_id=current_user.id,
        user_roles=user_roles,
    ):
        raise HTTPException(status_code=404, detail="Feature not available")


class GenerateQuestionRequest(BaseModel):
    """Request model for question generation."""

    template_id: uuid.UUID
    num_questions: int = 5
    skip_content_validation: bool = False
    temperature: float = 0.7


class GenerateQuestionResponse(BaseModel):
    """Response model for question generation."""

    batch_id: uuid.UUID
    total_requested: int
    successful: int
    failed: int
    questions: list[dict[str, Any]]


class RejectQuestionRequest(BaseModel):
    """Request model for rejecting a question."""

    reason: str


@router.post("/generate", response_model=GenerateQuestionResponse)
async def generate_questions(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    request: GenerateQuestionRequest,
) -> Any:
    """Generate questions using AI based on a template.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    if not settings.QUESTION_GENERATION_ENABLED:
        raise HTTPException(
            status_code=503, detail="Question generation is currently disabled"
        )

    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    if request.num_questions > settings.MAX_GENERATION_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate more than {settings.MAX_GENERATION_BATCH_SIZE} questions at once",
        )

    # Initialize services
    openai_provider = OpenAIProvider(
        api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_MODEL
    )
    template_service = TemplateService(session)
    format_validator = FormatValidator()
    content_validator = ContentValidator(
        provider=openai_provider, threshold=settings.CONTENT_VALIDATION_THRESHOLD
    )
    question_validator = QuestionValidator(format_validator, content_validator)
    generator = QuestionGeneratorService(
        provider=openai_provider,
        template_service=template_service,
        validator=question_validator,
        session=session,
        rate_limit=settings.GENERATION_RATE_LIMIT,
    )

    try:
        result = await generator.generate_batch(
            template_id=request.template_id,
            num_questions=request.num_questions,
            user_id=current_user.id,
            skip_content_validation=request.skip_content_validation,
            temperature=request.temperature,
        )

        return GenerateQuestionResponse(
            batch_id=result.batch_id,
            total_requested=result.total,
            successful=result.successful,
            failed=result.failed,
            questions=result.questions,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generated", response_model=GeneratedQuestionsPublic)
async def list_generated_questions(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    batch_id: uuid.UUID | None = None,
    min_score: int | None = None,
) -> Any:
    """List generated questions pending review.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    statement = select(GeneratedQuestion)

    if status:
        statement = statement.where(GeneratedQuestion.status == status)
    if batch_id:
        statement = statement.where(GeneratedQuestion.batch_id == batch_id)
    if min_score is not None:
        statement = statement.where(GeneratedQuestion.validation_score >= min_score)  # type: ignore[operator]

    # Non-superusers can only see their own generated questions
    if not current_user.is_superuser:
        statement = statement.where(GeneratedQuestion.created_by == current_user.id)

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.offset(skip).limit(limit)
    questions = session.exec(statement).all()

    return GeneratedQuestionsPublic(data=questions, count=count)


@router.post("/generated/{question_id}/approve", response_model=QuestionPublic)
async def approve_generated_question(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    question_id: uuid.UUID,
) -> Any:
    """Approve a generated question and add it to the question bank.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    review_service = ReviewService(session)

    try:
        question = await review_service.approve_question(question_id, current_user.id)
        # Convert Question to QuestionPublic with subject/topic names
        from app.api.routes.questions import question_to_public

        return question_to_public(question, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generated/{question_id}/reject", response_model=Message)
async def reject_generated_question(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    question_id: uuid.UUID,
    request: RejectQuestionRequest,
) -> Any:
    """Reject a generated question.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    review_service = ReviewService(session)

    try:
        await review_service.reject_question(
            question_id, current_user.id, request.reason
        )
        return Message(message="Question rejected successfully")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generated/batch/{batch_id}/approve-all")
async def approve_batch(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    batch_id: uuid.UUID,
) -> Any:
    """Approve all pending questions in a batch.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    review_service = ReviewService(session)

    try:
        result = await review_service.approve_batch(batch_id, current_user.id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
