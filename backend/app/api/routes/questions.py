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
        difficulty=question.difficulty,
        question_type=question.question_type,
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
    # Validate question type and correct answers consistency
    question_type = question_in.question_type
    correct_answers_count = len(question_in.correct_answers)

    if question_type == "mcq" and correct_answers_count != 1:
        raise HTTPException(
            status_code=400,
            detail="MCQ questions must have exactly 1 correct answer",
        )
    elif question_type == "multiselect" and correct_answers_count < 2:
        raise HTTPException(
            status_code=400,
            detail="Multiselect questions must have at least 2 correct answers",
        )

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

    # Validate question type and correct answers consistency if both are being updated
    question_type = question_in.question_type or question.question_type
    correct_answers = question_in.correct_answers or question.correct_answers
    correct_answers_count = len(correct_answers)

    if question_type == "mcq" and correct_answers_count != 1:
        raise HTTPException(
            status_code=400,
            detail="MCQ questions must have exactly 1 correct answer",
        )
    elif question_type == "multiselect" and correct_answers_count < 2:
        raise HTTPException(
            status_code=400,
            detail="Multiselect questions must have at least 2 correct answers",
        )

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
    from app.models import CardGameAnswer, CardGameSession

    question = session.get(Question, id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    if not current_user.is_superuser and (question.created_by != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    # Check if question is used in any games
    statement = select(CardGameAnswer).where(CardGameAnswer.question_id == id)
    answers = session.exec(statement).all()

    if answers:
        # Get all unique game sessions that used this question
        game_ids = {answer.game_session_id for answer in answers}

        # Check if any of these games are still in progress
        # Active statuses: "waiting", "ready", "in_progress"
        # Inactive statuses: "completed"
        active_games = []
        for game_id in game_ids:
            game = session.get(CardGameSession, game_id)
            if game and game.status in ("waiting", "ready", "in_progress"):
                active_games.append(game.room_code or str(game.id)[:8])

        if active_games:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete question: still being used in active game(s): {', '.join(active_games)}",
            )

        # All games are finished - delete answer history first
        for answer in answers:
            session.delete(answer)
        session.commit()

    # Now safe to delete the question
    session.delete(question)
    session.commit()
    return Message(message="Question deleted successfully")
