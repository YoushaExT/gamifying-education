import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_teacher_or_superuser
from app.models import (
    Message,
    Question,
    QuestionCreate,
    QuestionPublic,
    QuestionsPublic,
    QuestionUpdate,
    User,
)

router = APIRouter(prefix="/questions", tags=["questions"])


def question_to_public(question: Question, session: SessionDep) -> QuestionPublic:
    """Convert Question database model to QuestionPublic API model."""
    # Load subject and topic relationships if not already loaded
    if not question.subject_rel:
        from app.models import Subject

        question.subject_rel = session.get(Subject, question.subject_id)

    if question.topic_id and not question.topic_rel:
        from app.models import Topic

        question.topic_rel = session.get(Topic, question.topic_id)

    return QuestionPublic(
        id=question.id,
        question_text=question.question_text,
        choices=question.choices,
        correct_answers=question.correct_answers,
        subject=question.subject_rel.name if question.subject_rel else "",
        topic=question.topic_rel.name if question.topic_rel else None,
        subject_id=question.subject_id,
        topic_id=question.topic_id,
        created_by=question.created_by,
        created_at=question.created_at,
        updated_at=question.updated_at,
    )


@router.get("/", response_model=QuestionsPublic)
def read_questions(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    subject: str | None = None,
    topic: str | None = None,
) -> Any:
    """
    Retrieve questions with optional filtering.
    """
    # Build query with optional filters
    statement = select(Question)

    if subject:
        # Find subject by name
        from app.models import Subject

        subject_statement = select(Subject).where(Subject.name == subject)
        subject_obj = session.exec(subject_statement).first()
        if subject_obj:
            statement = statement.where(Question.subject_id == subject_obj.id)
        else:
            # No matching subject, return empty
            return QuestionsPublic(data=[], count=0)

    if topic:
        # Find topic by name
        from app.models import Topic

        topic_statement = select(Topic).where(Topic.name == topic)
        topic_obj = session.exec(topic_statement).first()
        if topic_obj:
            statement = statement.where(Question.topic_id == topic_obj.id)
        else:
            # No matching topic, return empty
            return QuestionsPublic(data=[], count=0)

    # Get count
    count_statement = select(func.count()).select_from(statement.subquery())
    count = session.exec(count_statement).one()

    # Get paginated results
    statement = statement.offset(skip).limit(limit)
    questions = session.exec(statement).all()

    return QuestionsPublic(
        data=[question_to_public(q, session) for q in questions], count=count
    )


@router.get("/{id}", response_model=QuestionPublic)
def read_question(
    session: SessionDep, _current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """
    Get question by ID.
    """
    question = session.get(Question, id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question_to_public(question, session)


@router.post("/", response_model=QuestionPublic)
def create_question(
    *,
    session: SessionDep,
    current_user: User = Depends(get_current_teacher_or_superuser),
    question_in: QuestionCreate,
) -> Any:
    """
    Create new question. Requires teacher or superuser role.
    """
    # Ensure subject exists
    crud.get_or_create_subject(session=session, name=question_in.subject)

    # Ensure topic exists if provided
    if question_in.topic:
        crud.get_or_create_topic(session=session, name=question_in.topic)

    question = crud.create_question(
        session=session, question_in=question_in, creator_id=current_user.id
    )
    return question_to_public(question, session)


@router.put("/{id}", response_model=QuestionPublic)
def update_question(
    *,
    session: SessionDep,
    id: uuid.UUID,
    current_user: User = Depends(get_current_teacher_or_superuser),
    question_in: QuestionUpdate,
) -> Any:
    """
    Update a question. Only the creator can update.
    """
    question = session.get(Question, id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if not current_user.is_superuser and (question.created_by != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    # Ensure subject exists if being updated
    if question_in.subject:
        crud.get_or_create_subject(session=session, name=question_in.subject)

    # Ensure topic exists if being updated
    if question_in.topic:
        crud.get_or_create_topic(session=session, name=question_in.topic)

    question = crud.update_question(
        session=session, db_question=question, question_in=question_in
    )
    return question_to_public(question, session)


@router.delete("/{id}")
def delete_question(
    session: SessionDep,
    id: uuid.UUID,
    current_user: User = Depends(get_current_teacher_or_superuser),
) -> Message:
    """
    Delete a question. Only the creator can delete.
    """
    question = session.get(Question, id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if not current_user.is_superuser and (question.created_by != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    session.delete(question)
    session.commit()
    return Message(message="Question deleted successfully")
