import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.crud import (
    complete_quiz_attempt,
    create_quiz,
    create_quiz_attempt,
    get_quiz_attempt,
    get_random_questions,
    get_user_quiz_attempts,
    update_quiz_attempt_answer,
)
from app.models import (
    Quiz,
    QuizAnswerSubmit,
    QuizAttempt,
    QuizAttemptCreate,
    QuizAttemptPublic,
    QuizAttemptsPublic,
    QuizCreate,
    QuizPublic,
    QuizResultDetail,
    QuizResultPublic,
)
from app.services.feature_flags import FeatureFlagService

router = APIRouter()


def check_quiz_feature_flag(session: SessionDep, current_user: CurrentUser) -> None:
    """Check if quiz feature is enabled for the current user."""
    flag_service = FeatureFlagService(session)

    user_roles = []
    if current_user.is_superuser:
        user_roles.append("superuser")
    if current_user.is_teacher:
        user_roles.append("teacher")

    if not flag_service.is_enabled(
        flag_key="quiz_system",
        user_id=current_user.id,
        user_roles=user_roles,
    ):
        raise HTTPException(
            status_code=404,
            detail="Quiz feature is not enabled",
        )


@router.post("/start", response_model=QuizAttemptPublic)
def start_quiz(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    quiz_in: QuizCreate,
) -> Any:
    """
    Start a new quiz.

    Selects random questions based on subjects/topics and creates a quiz attempt.
    """
    check_quiz_feature_flag(session, current_user)

    # Get random questions
    questions = get_random_questions(
        session=session,
        subjects=quiz_in.subjects,
        topics=quiz_in.topics,
        limit=quiz_in.num_questions,
    )

    if len(questions) < quiz_in.num_questions:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough questions available. Found {len(questions)}, needed {quiz_in.num_questions}",
        )

    # Create quiz configuration
    quiz = create_quiz(session=session, quiz_in=quiz_in, user_id=current_user.id)

    # Create quiz attempt with question IDs
    question_ids = [str(q.id) for q in questions]
    attempt_in = QuizAttemptCreate(
        quiz_id=quiz.id,
        question_ids=question_ids,
        total_questions=len(questions),
    )

    attempt = create_quiz_attempt(
        session=session,
        attempt_in=attempt_in,
        user_id=current_user.id,
    )

    return attempt


@router.get("/attempts/{attempt_id}", response_model=QuizAttemptPublic)
def get_attempt(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    attempt_id: uuid.UUID,
) -> Any:
    """
    Get current quiz attempt state.

    Returns progress, answered questions, and time remaining.
    """
    check_quiz_feature_flag(session, current_user)

    attempt = get_quiz_attempt(session=session, attempt_id=attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")

    # Verify ownership
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this quiz attempt"
        )

    return attempt


@router.get("/quiz/{quiz_id}", response_model=QuizPublic)
def get_quiz_details(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    quiz_id: uuid.UUID,
) -> Any:
    """
    Get quiz configuration details including timer settings.
    """
    check_quiz_feature_flag(session, current_user)

    quiz = session.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Verify ownership
    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this quiz"
        )

    return quiz


@router.post("/attempts/{attempt_id}/answer")
def submit_answer(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    attempt_id: uuid.UUID,
    answer: QuizAnswerSubmit,
) -> dict[str, str]:
    """
    Submit an answer for a question in an active quiz.

    Does not reveal if the answer is correct until quiz is completed.
    """
    check_quiz_feature_flag(session, current_user)

    attempt = get_quiz_attempt(session=session, attempt_id=attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")

    # Verify ownership
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this quiz attempt"
        )

    # Check if quiz is still in progress
    if attempt.status != "in_progress":
        raise HTTPException(status_code=400, detail="Quiz is not in progress")

    # Validate question belongs to this quiz
    if answer.question_id not in attempt.question_ids:
        raise HTTPException(status_code=400, detail="Question not in this quiz")

    # Update the answer
    update_quiz_attempt_answer(
        session=session,
        attempt=attempt,
        question_id=answer.question_id,
        selected_answers=answer.selected_answers,
    )

    return {"message": "Answer recorded successfully"}


@router.post("/attempts/{attempt_id}/complete", response_model=QuizResultPublic)
def complete_quiz(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    attempt_id: uuid.UUID,
) -> Any:
    """
    Complete the quiz and calculate the score.

    Returns the final score and summary.
    """
    check_quiz_feature_flag(session, current_user)

    attempt = get_quiz_attempt(session=session, attempt_id=attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")

    # Verify ownership
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this quiz attempt"
        )

    # Check if quiz is still in progress
    if attempt.status != "in_progress":
        raise HTTPException(status_code=400, detail="Quiz already completed")

    # Get all questions for this quiz
    question_ids = [uuid.UUID(qid) for qid in attempt.question_ids]
    from app.models import Question, Subject, Topic

    questions = session.exec(
        select(Question).where(Question.id.in_(question_ids))  # type: ignore[attr-defined]
    ).all()

    # Create a map for quick lookup
    question_map = {str(q.id): q for q in questions}

    # Calculate score
    score = 0
    details = []

    for q_id in attempt.question_ids:
        question = question_map.get(q_id)
        if not question:
            continue

        # Load subject and topic relationships
        subject = session.get(Subject, question.subject_id)
        topic = session.get(Topic, question.topic_id) if question.topic_id else None

        user_answers = attempt.user_answers.get(q_id, [])
        correct_answers = sorted(question.correct_answers)
        user_answers_sorted = sorted(user_answers)
        is_correct = correct_answers == user_answers_sorted

        if is_correct:
            score += 1

        details.append(
            QuizResultDetail(
                question_id=q_id,
                question_text=question.question_text,
                choices=question.choices,
                correct_answers=question.correct_answers,
                user_answers=user_answers,
                is_correct=is_correct,
                subject=subject.name if subject else "",
                topic=topic.name if topic else None,
            )
        )

    # Calculate time taken
    from datetime import datetime

    time_taken = int((datetime.utcnow() - attempt.started_at).total_seconds())

    # Complete the attempt
    attempt = complete_quiz_attempt(
        session=session,
        attempt=attempt,
        score=score,
        time_taken=time_taken,
    )

    # Return detailed results
    percentage = (
        (score / attempt.total_questions) * 100 if attempt.total_questions > 0 else 0
    )

    return QuizResultPublic(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        score=score,
        total_questions=attempt.total_questions,
        percentage=percentage,
        time_taken=time_taken,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        status=attempt.status,
        details=details,
    )


@router.get("/attempts/{attempt_id}/results", response_model=QuizResultPublic)
def get_quiz_results(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    attempt_id: uuid.UUID,
) -> Any:
    """
    Get detailed results for a completed quiz.

    Shows all questions with user answers, correct answers, and explanations.
    """
    check_quiz_feature_flag(session, current_user)

    attempt = get_quiz_attempt(session=session, attempt_id=attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")

    # Verify ownership
    if attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this quiz attempt"
        )

    # Check if quiz is completed
    if attempt.status != "completed":
        raise HTTPException(status_code=400, detail="Quiz is not completed yet")

    # Get all questions for this quiz
    question_ids = [uuid.UUID(qid) for qid in attempt.question_ids]
    from app.models import Question, Subject, Topic

    questions = session.exec(
        select(Question).where(Question.id.in_(question_ids))  # type: ignore[attr-defined]
    ).all()

    # Create a map for quick lookup
    question_map = {str(q.id): q for q in questions}

    # Build detailed results
    details = []
    for q_id in attempt.question_ids:
        question = question_map.get(q_id)
        if not question:
            continue

        # Load subject and topic relationships
        subject = session.get(Subject, question.subject_id)
        topic = session.get(Topic, question.topic_id) if question.topic_id else None

        user_answers = attempt.user_answers.get(q_id, [])
        correct_answers = sorted(question.correct_answers)
        user_answers_sorted = sorted(user_answers)
        is_correct = correct_answers == user_answers_sorted

        details.append(
            QuizResultDetail(
                question_id=q_id,
                question_text=question.question_text,
                choices=question.choices,
                correct_answers=question.correct_answers,
                user_answers=user_answers,
                is_correct=is_correct,
                subject=subject.name if subject else "",
                topic=topic.name if topic else None,
            )
        )

    percentage = (
        ((attempt.score or 0) / attempt.total_questions) * 100
        if attempt.total_questions > 0
        else 0
    )

    return QuizResultPublic(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        score=attempt.score,
        total_questions=attempt.total_questions,
        percentage=percentage,
        time_taken=attempt.time_taken,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        status=attempt.status,
        details=details,
    )


@router.get("/attempts/history", response_model=QuizAttemptsPublic)
def get_quiz_history(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get user's quiz history.

    Returns a list of past quiz attempts with scores and dates.
    """
    check_quiz_feature_flag(session, current_user)

    attempts = get_user_quiz_attempts(
        session=session,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )

    # Get total count
    count_statement = (
        select(func.count())
        .select_from(QuizAttempt)
        .where(QuizAttempt.user_id == current_user.id)
    )
    count = session.exec(count_statement).one()

    return QuizAttemptsPublic(data=attempts, count=count)
