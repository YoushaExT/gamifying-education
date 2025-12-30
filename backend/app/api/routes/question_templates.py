"""API routes for question templates."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentTeacherOrSuperuser, FeatureFlagsDep, SessionDep
from app.crud import (
    create_question_template,
    delete_question_template,
    get_question_template,
    update_question_template,
)
from app.models import (
    Message,
    QuestionTemplate,
    QuestionTemplateCreate,
    QuestionTemplatePublic,
    QuestionTemplatesPublic,
    QuestionTemplateUpdate,
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


@router.get("/", response_model=QuestionTemplatesPublic)
async def list_templates(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    skip: int = 0,
    limit: int = 100,
    subject: str | None = None,
    difficulty: str | None = None,
    is_active: bool = True,
) -> Any:
    """List question templates.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    statement = select(QuestionTemplate).where(QuestionTemplate.is_active == is_active)

    if subject:
        statement = statement.where(QuestionTemplate.subject == subject)
    if difficulty:
        statement = statement.where(QuestionTemplate.difficulty == difficulty)

    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    statement = statement.offset(skip).limit(limit)
    templates = session.exec(statement).all()

    return QuestionTemplatesPublic(data=templates, count=count)


@router.post("/", response_model=QuestionTemplatePublic)
async def create_template(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    template_in: QuestionTemplateCreate,
) -> Any:
    """Create a new question template.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    template = create_question_template(
        session=session, template_in=template_in, creator_id=current_user.id
    )
    return template


@router.get("/{template_id}", response_model=QuestionTemplatePublic)
async def get_template(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    template_id: uuid.UUID,
) -> Any:
    """Get a specific template by ID.

    Requires teacher or superuser permissions.
    """
    check_ai_generation_feature(feature_flags, current_user)

    template = get_question_template(session=session, template_id=template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=QuestionTemplatePublic)
async def update_template(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    template_id: uuid.UUID,
    template_in: QuestionTemplateUpdate,
) -> Any:
    """Update a question template.

    Requires teacher or superuser permissions.
    Only the creator or superuser can update a template.
    """
    check_ai_generation_feature(feature_flags, current_user)

    template = get_question_template(session=session, template_id=template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check permissions
    if not current_user.is_superuser and template.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    updated_template = update_question_template(
        session=session, db_template=template, template_in=template_in
    )
    return updated_template


@router.delete("/{template_id}", response_model=Message)
async def delete_template(
    *,
    session: SessionDep,
    current_user: CurrentTeacherOrSuperuser,
    feature_flags: FeatureFlagsDep,
    template_id: uuid.UUID,
) -> Any:
    """Delete a question template.

    Requires teacher or superuser permissions.
    Only the creator or superuser can delete a template.
    """
    check_ai_generation_feature(feature_flags, current_user)

    template = get_question_template(session=session, template_id=template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check permissions
    if not current_user.is_superuser and template.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    success = delete_question_template(session=session, template_id=template_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete template")

    return Message(message="Template deleted successfully")
