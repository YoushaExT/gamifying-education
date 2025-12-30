import random
import string
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import desc, func
from sqlmodel import Session, select

from app.core.security import get_password_hash, verify_password
from app.models import (
    FeatureFlag,
    FeatureFlagCreate,
    FeatureFlagUpdate,
    GeneratedQuestion,
    Item,
    ItemCreate,
    Question,
    QuestionCreate,
    QuestionTemplate,
    QuestionTemplateCreate,
    QuestionTemplateUpdate,
    QuestionUpdate,
    Quiz,
    QuizAttempt,
    QuizAttemptCreate,
    QuizCreate,
    Subject,
    SubjectCreate,
    Topic,
    TopicCreate,
    User,
    UserCreate,
    UserUpdate,
)

if TYPE_CHECKING:
    from app.models import CardGameSession


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item


def create_question(
    *, session: Session, question_in: QuestionCreate, creator_id: uuid.UUID
) -> Question:
    # Get or create subject
    subject = get_or_create_subject(session=session, name=question_in.subject)

    # Get or create topic if provided
    topic = None
    if question_in.topic:
        topic = get_or_create_topic(session=session, name=question_in.topic)

    # Create question with foreign key IDs
    db_question = Question(
        question_text=question_in.question_text,
        choices=question_in.choices,
        correct_answers=question_in.correct_answers,
        subject_id=subject.id,
        topic_id=topic.id if topic else None,
        created_by=creator_id,
    )
    session.add(db_question)
    session.commit()
    session.refresh(db_question)
    return db_question


def update_question(
    *, session: Session, db_question: Question, question_in: QuestionUpdate
) -> Question:
    question_data = question_in.model_dump(exclude_unset=True)

    # Handle subject update
    if "subject" in question_data and question_data["subject"]:
        subject = get_or_create_subject(session=session, name=question_data["subject"])
        question_data["subject_id"] = subject.id
        del question_data["subject"]

    # Handle topic update
    if "topic" in question_data:
        if question_data["topic"]:
            topic = get_or_create_topic(session=session, name=question_data["topic"])
            question_data["topic_id"] = topic.id
        else:
            question_data["topic_id"] = None
        del question_data["topic"]

    db_question.sqlmodel_update(question_data, update={"updated_at": datetime.utcnow()})
    session.add(db_question)
    session.commit()
    session.refresh(db_question)
    return db_question


def get_or_create_subject(*, session: Session, name: str) -> Subject:
    """Get existing subject or create new one."""
    statement = select(Subject).where(Subject.name == name)
    subject = session.exec(statement).first()
    if not subject:
        subject_in = SubjectCreate(name=name)
        subject = Subject.model_validate(subject_in)
        session.add(subject)
        session.commit()
        session.refresh(subject)
    return subject


def get_or_create_topic(*, session: Session, name: str) -> Topic:
    """Get existing topic or create new one."""
    statement = select(Topic).where(Topic.name == name)
    topic = session.exec(statement).first()
    if not topic:
        topic_in = TopicCreate(name=name)
        topic = Topic.model_validate(topic_in)
        session.add(topic)
        session.commit()
        session.refresh(topic)
    return topic


def get_subjects(*, session: Session) -> list[Subject]:
    """Get all subjects."""
    statement = select(Subject)
    return list(session.exec(statement).all())


def get_topics(*, session: Session) -> list[Topic]:
    """Get all topics."""
    statement = select(Topic)
    return list(session.exec(statement).all())


# QuestionTemplate CRUD operations


def create_question_template(
    *,
    session: Session,
    template_in: QuestionTemplateCreate,
    creator_id: uuid.UUID | None = None,
) -> QuestionTemplate:
    """Create a new question template."""
    db_template = QuestionTemplate.model_validate(
        template_in, update={"created_by": creator_id}
    )
    session.add(db_template)
    session.commit()
    session.refresh(db_template)
    return db_template


def get_question_template(
    *, session: Session, template_id: uuid.UUID
) -> QuestionTemplate | None:
    """Get a question template by ID."""
    return session.get(QuestionTemplate, template_id)


def get_question_templates(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    subject: str | None = None,
    difficulty: str | None = None,
    is_active: bool | None = None,
) -> list[QuestionTemplate]:
    """Get question templates with optional filters."""
    statement = select(QuestionTemplate)

    if subject:
        statement = statement.where(QuestionTemplate.subject == subject)
    if difficulty:
        statement = statement.where(QuestionTemplate.difficulty == difficulty)
    if is_active is not None:
        statement = statement.where(QuestionTemplate.is_active == is_active)

    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def update_question_template(
    *,
    session: Session,
    db_template: QuestionTemplate,
    template_in: QuestionTemplateUpdate,
) -> QuestionTemplate:
    """Update a question template."""
    template_data = template_in.model_dump(exclude_unset=True)
    db_template.sqlmodel_update(template_data, update={"updated_at": datetime.utcnow()})
    session.add(db_template)
    session.commit()
    session.refresh(db_template)
    return db_template


def delete_question_template(*, session: Session, template_id: uuid.UUID) -> bool:
    """Delete a question template."""
    template = session.get(QuestionTemplate, template_id)
    if template:
        session.delete(template)
        session.commit()
        return True
    return False


# GeneratedQuestion CRUD operations


def create_generated_question(
    *,
    session: Session,
    question_data: dict[str, Any],
    template_id: uuid.UUID | None,
    batch_id: uuid.UUID,
    creator_id: uuid.UUID,
    validation_score: int | None = None,
    validation_feedback: str | None = None,
) -> GeneratedQuestion:
    """Create a generated question."""
    db_gen_question = GeneratedQuestion(
        question_data=question_data,
        template_id=template_id,
        batch_id=batch_id,
        created_by=creator_id,
        validation_score=validation_score,
        validation_feedback=validation_feedback,
        status="pending",
    )
    session.add(db_gen_question)
    session.commit()
    session.refresh(db_gen_question)
    return db_gen_question


def get_generated_question(
    *, session: Session, question_id: uuid.UUID
) -> GeneratedQuestion | None:
    """Get a generated question by ID."""
    return session.get(GeneratedQuestion, question_id)


def get_generated_questions(
    *,
    session: Session,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    batch_id: uuid.UUID | None = None,
    min_score: int | None = None,
) -> list[GeneratedQuestion]:
    """Get generated questions with optional filters."""
    statement = select(GeneratedQuestion)

    if status:
        statement = statement.where(GeneratedQuestion.status == status)
    if batch_id:
        statement = statement.where(GeneratedQuestion.batch_id == batch_id)
    if min_score is not None:
        statement = statement.where(GeneratedQuestion.validation_score >= min_score)  # type: ignore[operator]

    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def update_generated_question_status(
    *,
    session: Session,
    question_id: uuid.UUID,
    status: str,
    reviewer_id: uuid.UUID | None = None,
    rejection_reason: str | None = None,
) -> GeneratedQuestion | None:
    """Update the status of a generated question."""
    gen_question = session.get(GeneratedQuestion, question_id)
    if gen_question:
        gen_question.status = status
        gen_question.reviewed_at = datetime.utcnow()
        gen_question.reviewed_by = reviewer_id
        if rejection_reason:
            gen_question.rejection_reason = rejection_reason
        session.add(gen_question)
        session.commit()
        session.refresh(gen_question)
    return gen_question


# ========================================
# Feature Flags
# ========================================


def create_feature_flag(*, session: Session, flag_in: FeatureFlagCreate) -> FeatureFlag:
    """Create a new feature flag."""
    db_flag = FeatureFlag.model_validate(flag_in)
    session.add(db_flag)
    session.commit()
    session.refresh(db_flag)
    return db_flag


def get_feature_flag(*, session: Session, flag_key: str) -> FeatureFlag | None:
    """Get a feature flag by key."""
    statement = select(FeatureFlag).where(FeatureFlag.key == flag_key)
    return session.exec(statement).first()


def get_feature_flags(
    *, session: Session, skip: int = 0, limit: int = 100
) -> list[FeatureFlag]:
    """Get all feature flags."""
    statement = select(FeatureFlag).offset(skip).limit(limit)
    return list(session.exec(statement).all())


def update_feature_flag(
    *, session: Session, db_flag: FeatureFlag, flag_in: FeatureFlagUpdate
) -> FeatureFlag:
    """Update a feature flag."""
    flag_data = flag_in.model_dump(exclude_unset=True)
    db_flag.sqlmodel_update(flag_data, update={"updated_at": datetime.utcnow()})
    session.add(db_flag)
    session.commit()
    session.refresh(db_flag)
    return db_flag


def delete_feature_flag(*, session: Session, flag_key: str) -> None:
    """Delete a feature flag."""
    flag = get_feature_flag(session=session, flag_key=flag_key)
    if flag:
        session.delete(flag)
        session.commit()


# Quiz CRUD operations
def create_quiz(*, session: Session, quiz_in: QuizCreate, user_id: uuid.UUID) -> Quiz:
    """Create a new quiz with auto-generated title."""
    # Generate title from subjects
    subjects_str = ", ".join(quiz_in.subjects[:2])  # Take first 2 subjects
    if len(quiz_in.subjects) > 2:
        subjects_str += f" +{len(quiz_in.subjects) - 2} more"

    title = f"Quiz: {subjects_str}"

    db_quiz = Quiz(
        title=title,
        subjects=quiz_in.subjects,
        topics=quiz_in.topics,
        num_questions=quiz_in.num_questions,
        time_limit=quiz_in.time_limit,
        is_timed=quiz_in.is_timed,
        created_by=user_id,
    )
    session.add(db_quiz)
    session.commit()
    session.refresh(db_quiz)
    return db_quiz


def get_quiz(*, session: Session, quiz_id: uuid.UUID) -> Quiz | None:
    """Get a quiz by ID."""
    return session.get(Quiz, quiz_id)


def create_quiz_attempt(
    *, session: Session, attempt_in: QuizAttemptCreate, user_id: uuid.UUID
) -> QuizAttempt:
    """Create a new quiz attempt."""
    db_attempt = QuizAttempt(
        quiz_id=attempt_in.quiz_id,
        user_id=user_id,
        question_ids=attempt_in.question_ids,
        user_answers={},  # Empty initially
        total_questions=attempt_in.total_questions,
        started_at=datetime.utcnow(),
        status="in_progress",
    )
    session.add(db_attempt)
    session.commit()
    session.refresh(db_attempt)
    return db_attempt


def get_quiz_attempt(*, session: Session, attempt_id: uuid.UUID) -> QuizAttempt | None:
    """Get a quiz attempt by ID."""
    return session.get(QuizAttempt, attempt_id)


def update_quiz_attempt_answer(
    *,
    session: Session,
    attempt: QuizAttempt,
    question_id: str,
    selected_answers: list[str],
) -> QuizAttempt:
    """Update a quiz attempt with a user's answer to a question."""
    # Update the user_answers dict
    updated_answers = dict(attempt.user_answers)  # Create a new dict
    updated_answers[question_id] = selected_answers

    # Use sqlmodel_update to update the field
    attempt.sqlmodel_update({"user_answers": updated_answers})
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def complete_quiz_attempt(
    *, session: Session, attempt: QuizAttempt, score: int, time_taken: int | None
) -> QuizAttempt:
    """Complete a quiz attempt and set final score."""
    attempt.score = score
    attempt.time_taken = time_taken
    attempt.completed_at = datetime.utcnow()
    attempt.status = "completed"
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return attempt


def get_user_quiz_attempts(
    *, session: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[QuizAttempt]:
    """Get all quiz attempts for a user."""
    statement = (
        select(QuizAttempt)
        .where(QuizAttempt.user_id == user_id)
        .order_by(desc(QuizAttempt.started_at))  # type: ignore[arg-type]
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_random_questions(
    *,
    session: Session,
    subjects: list[str],
    topics: list[str] | None,
    limit: int,
) -> list[Question]:
    """Get random questions filtered by subjects and optionally topics."""
    # Convert subject names to IDs
    subject_statement = select(Subject).where(Subject.name.in_(subjects))  # type: ignore[attr-defined]
    subject_objs = session.exec(subject_statement).all()
    subject_ids = [s.id for s in subject_objs]

    if not subject_ids:
        return []

    statement = select(Question).where(Question.subject_id.in_(subject_ids))  # type: ignore[attr-defined]

    if topics:
        # Convert topic names to IDs
        topic_statement = select(Topic).where(Topic.name.in_(topics))  # type: ignore[attr-defined]
        topic_objs = session.exec(topic_statement).all()
        topic_ids = [t.id for t in topic_objs]

        if topic_ids:
            statement = statement.where(Question.topic_id.in_(topic_ids))  # type: ignore[union-attr]

    # Order by random and limit
    statement = statement.order_by(func.random()).limit(limit)

    return list(session.exec(statement).all())


# ==================== Card Game CRUD ====================


def generate_room_code(session: Session) -> str:
    """Generate a unique 6-character alphanumeric room code."""
    from app.models import CardGameSession

    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        # Check if code already exists
        existing = session.exec(
            select(CardGameSession).where(CardGameSession.room_code == code)
        ).first()
        if not existing:
            return code


def create_card_game_session(
    *,
    session: Session,
    game_in: Any,
    host_id: uuid.UUID,
    deck: list[dict[str, Any]],
) -> Any:
    """Create a new card game session with a prepared deck."""
    from app.models import CardGameSession

    # Generate unique room code
    room_code = generate_room_code(session)

    db_obj = CardGameSession(
        room_code=room_code,
        host_id=host_id,
        subjects=game_in.subjects,
        topics=game_in.topics,
        deck=deck,
        host_hand=[],
        guest_hand=[],
        discard_pile=[],
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def get_card_game_session(
    *, session: Session, game_id: uuid.UUID
) -> "CardGameSession | None":
    """Get card game session by ID."""
    from app.models import CardGameSession

    return session.get(CardGameSession, game_id)


def get_card_game_session_by_code(
    *, session: Session, room_code: str
) -> "CardGameSession | None":
    """Get card game session by room code."""
    from app.models import CardGameSession

    statement = select(CardGameSession).where(CardGameSession.room_code == room_code)
    return session.exec(statement).first()


def get_user_active_game(
    *, session: Session, user_id: uuid.UUID
) -> "CardGameSession | None":
    """Get user's active game (in_progress status) if any.

    Returns the game where user is either host or guest and status is 'in_progress'.
    Used for rejoin functionality.
    """
    from app.models import CardGameSession

    statement = select(CardGameSession).where(
        ((CardGameSession.host_id == user_id) | (CardGameSession.guest_id == user_id)),
        CardGameSession.status == "in_progress",
    )
    return session.exec(statement).first()


def join_card_game_session(
    *,
    session: Session,
    game_id: uuid.UUID,
    guest_id: uuid.UUID,
) -> Any:
    """Add a guest player to a card game session."""
    from app.models import CardGameSession

    game = session.get(CardGameSession, game_id)
    if not game:
        raise ValueError("Game session not found")

    if game.guest_id:
        raise ValueError("Game is already full")

    if game.host_id == guest_id:
        raise ValueError("Host cannot join as guest")

    game.guest_id = guest_id
    session.add(game)
    session.commit()
    session.refresh(game)
    return game


def mark_card_game_player_ready(
    *,
    session: Session,
    game_id: uuid.UUID,
    user_id: uuid.UUID,
    ready: bool = True,
) -> Any:
    """Mark a player as ready in a card game session."""
    from app.models import CardGameSession

    game = session.get(CardGameSession, game_id)
    if not game:
        raise ValueError("Game session not found")

    if game.host_id == user_id:
        game.host_ready = ready
    elif game.guest_id == user_id:
        game.guest_ready = ready
    else:
        raise ValueError("User is not part of this game")

    session.add(game)
    session.commit()
    session.refresh(game)
    return game


def start_card_game(*, session: Session, game_id: uuid.UUID) -> Any:
    """Start a card game session (both players ready)."""
    from app.models import CardGameSession

    game = session.get(CardGameSession, game_id)
    if not game:
        raise ValueError("Game session not found")

    if not game.guest_id:
        raise ValueError("Waiting for second player")

    if not (game.host_ready and game.guest_ready):
        raise ValueError("Both players must be ready")

    game.status = "in_progress"
    game.started_at = datetime.utcnow()
    session.add(game)
    session.commit()
    session.refresh(game)
    return game


def update_card_game_session(
    *,
    session: Session,
    game_id: uuid.UUID,
    **kwargs: Any,
) -> Any:
    """Update card game session fields."""
    from app.models import CardGameSession

    game = session.get(CardGameSession, game_id)
    if not game:
        raise ValueError("Game session not found")

    for key, value in kwargs.items():
        if hasattr(game, key):
            setattr(game, key, value)

    session.add(game)
    session.commit()
    session.refresh(game)
    return game


def complete_card_game(
    *, session: Session, game_id: uuid.UUID, winner: str | None = None
) -> Any:
    """Mark a card game as completed."""
    return update_card_game_session(
        session=session,
        game_id=game_id,
        status="completed",
        completed_at=datetime.utcnow(),
        winner=winner,
    )


def get_card_game_answers(
    *,
    session: Session,
    game_session_id: uuid.UUID,
    turn_number: int | None = None,
) -> list[Any]:
    """Get all answers for a card game session, optionally filtered by turn number."""
    from app.models import CardGameAnswer

    statement = select(CardGameAnswer).where(
        CardGameAnswer.game_session_id == game_session_id
    )

    if turn_number is not None:
        statement = statement.where(CardGameAnswer.turn_number == turn_number)

    return list(session.exec(statement).all())
