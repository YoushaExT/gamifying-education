import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import EmailStr
from sqlmodel import JSON, Column, Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    is_teacher: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    questions: list["Question"] = Relationship(
        back_populates="creator", cascade_delete=True
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# Subject model
class SubjectBase(SQLModel):
    name: str = Field(min_length=1, max_length=100, unique=True, index=True)


class SubjectCreate(SubjectBase):
    pass


class Subject(SubjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class SubjectPublic(SubjectBase):
    id: uuid.UUID


class SubjectsPublic(SQLModel):
    data: list[SubjectPublic]
    count: int


# Topic model
class TopicBase(SQLModel):
    name: str = Field(min_length=1, max_length=100, unique=True, index=True)


class TopicCreate(TopicBase):
    pass


class Topic(TopicBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


class TopicPublic(TopicBase):
    id: uuid.UUID


class TopicsPublic(SQLModel):
    data: list[TopicPublic]
    count: int


# Enums for Question
class QuestionDifficulty(str, Enum):
    EASY = "easy"
    HARD = "hard"


class QuestionType(str, Enum):
    MCQ = "mcq"
    MULTISELECT = "multiselect"


# Shared properties for Question
class QuestionBase(SQLModel):
    question_text: str = Field(min_length=1, max_length=10000)
    choices: list[str] = Field(sa_column=Column(JSON))  # Plain text choices (no labels)
    correct_answers: list[int] = Field(sa_column=Column(JSON))  # Indices (0-3)
    difficulty: QuestionDifficulty = Field(max_length=20)
    question_type: QuestionType = Field(max_length=20)
    subject: str = Field(min_length=1, max_length=100)
    topic: str | None = Field(default=None, max_length=100)


# Properties to receive on question creation
class QuestionCreate(QuestionBase):
    pass


# Properties to receive on question update
class QuestionUpdate(SQLModel):
    question_text: str | None = Field(default=None, min_length=1, max_length=10000)
    choices: list[str] | None = None
    correct_answers: list[int] | None = None  # Indices (0-3)
    difficulty: str | None = Field(default=None, max_length=20)
    question_type: str | None = Field(default=None, max_length=20)
    subject: str | None = Field(default=None, min_length=1, max_length=100)
    topic: str | None = Field(default=None, max_length=100)


# Database model, database table inferred from class name
class Question(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    question_text: str = Field(min_length=1, max_length=10000)
    choices: list[str] = Field(sa_column=Column(JSON))  # Plain text choices (no labels)
    correct_answers: list[int] = Field(sa_column=Column(JSON))  # Indices (0-3)
    difficulty: str = Field(max_length=20, default="easy")  # "easy" or "hard"
    question_type: str = Field(max_length=20, default="mcq")  # "mcq" or "multiselect"

    # Foreign keys to Subject and Topic tables
    subject_id: uuid.UUID = Field(
        foreign_key="subject.id", nullable=False, ondelete="CASCADE"
    )
    topic_id: uuid.UUID | None = Field(
        default=None, foreign_key="topic.id", ondelete="SET NULL"
    )

    created_by: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    creator: User | None = Relationship(back_populates="questions")
    subject_rel: Subject | None = Relationship()
    topic_rel: Topic | None = Relationship()


# Properties to return via API, id is always required
class QuestionPublic(QuestionBase):
    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    subject_id: uuid.UUID
    topic_id: uuid.UUID | None


class QuestionsPublic(SQLModel):
    data: list[QuestionPublic]
    count: int


# QuestionTemplate model for AI generation
class QuestionTemplateBase(SQLModel):
    subject: str = Field(min_length=1, max_length=100, index=True)
    topic: str | None = Field(default=None, max_length=100)
    difficulty: str = Field(max_length=20)  # "easy", "medium", "hard"
    template_prompt: str = Field(min_length=1, max_length=2000)
    example_questions: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    constraints: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    is_active: bool = True


# Properties to receive on template creation
class QuestionTemplateCreate(QuestionTemplateBase):
    pass


# Properties to receive on template update
class QuestionTemplateUpdate(SQLModel):
    subject: str | None = Field(default=None, min_length=1, max_length=100)
    topic: str | None = Field(default=None, max_length=100)
    difficulty: str | None = Field(default=None, max_length=20)
    template_prompt: str | None = Field(default=None, min_length=1, max_length=2000)
    example_questions: list[dict[str, Any]] | None = None
    constraints: dict[str, Any] | None = None
    is_active: bool | None = None


# Database model
class QuestionTemplate(QuestionTemplateBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Properties to return via API
class QuestionTemplatePublic(QuestionTemplateBase):
    id: uuid.UUID
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class QuestionTemplatesPublic(SQLModel):
    data: list[QuestionTemplatePublic]
    count: int


# GeneratedQuestion model for questions pending review
class GeneratedQuestionBase(SQLModel):
    question_data: dict[str, Any] = Field(sa_column=Column(JSON))
    template_id: uuid.UUID | None = Field(
        default=None, foreign_key="questiontemplate.id", ondelete="SET NULL"
    )
    batch_id: uuid.UUID = Field(index=True)
    status: str = Field(max_length=20, default="pending")  # pending, approved, rejected
    validation_score: int | None = None
    validation_feedback: str | None = Field(default=None, max_length=1000)
    rejection_reason: str | None = Field(default=None, max_length=500)
    # Diversity metadata
    subtopic: str | None = Field(
        default=None, max_length=200
    )  # e.g., "Closures", "Temporal Dead Zone"
    question_type: str | None = Field(
        default=None, max_length=100
    )  # e.g., "Output-Based", "Explanation-Based"
    diversity_score: float | None = None  # Combined score from frequency + importance


# Database model
class GeneratedQuestion(GeneratedQuestionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_by: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: datetime | None = None
    reviewed_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )


# Properties to return via API
class GeneratedQuestionPublic(GeneratedQuestionBase):
    id: uuid.UUID
    created_by: uuid.UUID
    generated_at: datetime
    reviewed_at: datetime | None
    reviewed_by: uuid.UUID | None


class GeneratedQuestionsPublic(SQLModel):
    data: list[GeneratedQuestionPublic]
    count: int


# ========================================
# Feature Flag Models
# ========================================


# Shared properties
class FeatureFlagBase(SQLModel):
    key: str = Field(unique=True, index=True, max_length=100)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=500)
    enabled: bool = False
    enabled_for_roles: list[str] = Field(default=[], sa_column=Column(JSON))
    enabled_for_users: list[str] = Field(default=[], sa_column=Column(JSON))
    env_var_name: str | None = Field(default=None, max_length=100)


# Properties to receive via API on creation
class FeatureFlagCreate(FeatureFlagBase):
    pass


# Properties to receive via API on update
class FeatureFlagUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    enabled_for_roles: list[str] | None = None
    enabled_for_users: list[str] | None = None


# Database model
class FeatureFlag(FeatureFlagBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Properties to return via API
class FeatureFlagPublic(FeatureFlagBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class FeatureFlagsPublic(SQLModel):
    data: list[FeatureFlagPublic]
    count: int


# Quiz models for MCQ test system
class QuizBase(SQLModel):
    title: str = Field(min_length=1, max_length=200)
    subjects: list[str] = Field(sa_column=Column(JSON))
    topics: list[str] | None = Field(default=None, sa_column=Column(JSON))
    num_questions: int = Field(default=5, ge=1, le=50)
    time_limit: int | None = None  # seconds, None = unlimited
    is_timed: bool = False


# Properties to receive on quiz creation
class QuizCreate(SQLModel):
    subjects: list[str]
    topics: list[str] | None = None
    num_questions: int = Field(default=5, ge=1, le=50)
    time_limit: int | None = None
    is_timed: bool = False


# Database model
class Quiz(QuizBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_by: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


# Properties to return via API
class QuizPublic(QuizBase):
    id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime


# QuizAttempt models
class QuizAttemptBase(SQLModel):
    quiz_id: uuid.UUID
    user_id: uuid.UUID
    question_ids: list[str] = Field(sa_column=Column(JSON))  # Order of questions
    user_answers: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )  # {question_id: [answers]}
    score: int | None = None  # Number correct (null until completed)
    total_questions: int
    time_taken: int | None = None  # seconds
    started_at: datetime
    completed_at: datetime | None = None
    status: str = Field(
        max_length=20, default="in_progress"
    )  # in_progress, completed, abandoned


# Properties to receive on attempt creation
class QuizAttemptCreate(SQLModel):
    quiz_id: uuid.UUID
    question_ids: list[str]
    total_questions: int


# Properties to receive on answer submission
class QuizAnswerSubmit(SQLModel):
    question_id: str
    selected_answers: list[int]  # [0] or [0, 2] for multi-select (indices)


# Database model
class QuizAttempt(QuizAttemptBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)


# Properties to return via API
class QuizAttemptPublic(QuizAttemptBase):
    id: uuid.UUID


# Quiz result with detailed information
class QuizResultDetail(SQLModel):
    question_id: str
    question_text: str
    choices: list[str]
    correct_answers: list[str]
    user_answers: list[str]
    is_correct: bool
    subject: str
    topic: str | None


class QuizResultPublic(SQLModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    score: int
    total_questions: int
    percentage: float
    time_taken: int | None
    started_at: datetime
    completed_at: datetime
    status: str
    details: list[QuizResultDetail]


class QuizAttemptsPublic(SQLModel):
    data: list[QuizAttemptPublic]
    count: int


# SubtopicTaxonomy model for storing subtopic hierarchies with importance weights
class SubtopicTaxonomyBase(SQLModel):
    subject: str = Field(min_length=1, max_length=100)
    topic: str = Field(min_length=1, max_length=100)
    subtopic: str = Field(min_length=1, max_length=200)
    importance_weight: float = Field(
        default=1.0, ge=0.0, le=10.0
    )  # LLM-suggested weight (1-5 scale)
    description: str | None = Field(default=None, max_length=500)


class SubtopicTaxonomy(SubtopicTaxonomyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )


class SubtopicTaxonomyPublic(SubtopicTaxonomyBase):
    id: uuid.UUID
    created_at: datetime
    created_by: uuid.UUID | None


class SubtopicTaxonomyCreate(SubtopicTaxonomyBase):
    pass


class SubtopicTaxonomiesPublic(SQLModel):
    data: list[SubtopicTaxonomyPublic]
    count: int


# ==================== Card Game Models ====================


# CardTemplate - Master card definitions loaded from YAML
class CardTemplateBase(SQLModel):
    card_key: str = Field(unique=True, index=True, max_length=50)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=500)
    card_type: str = Field(
        max_length=50
    )  # basic_damage, basic_shield, basic_heal, etc.
    effect_data: dict[str, Any] = Field(
        sa_column=Column(JSON)
    )  # Flexible structure per card type


class CardTemplate(CardTemplateBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CardTemplatePublic(CardTemplateBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CardTemplatesPublic(SQLModel):
    data: list[CardTemplatePublic]
    count: int


# DeckTemplate - Deck composition
class DeckTemplateBase(SQLModel):
    name: str = Field(unique=True, index=True, max_length=100)
    is_default: bool = Field(default=False)
    card_entries: list[dict[str, Any]] = Field(
        sa_column=Column(JSON)
    )  # [{ "card_key": "fireball", "count": 3 }, ...]


class DeckTemplate(DeckTemplateBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DeckTemplatePublic(DeckTemplateBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# CardGameSession - Main game state for card combat
class CardGameSessionBase(SQLModel):
    room_code: str = Field(max_length=6, unique=True, index=True)
    subjects: list[str] = Field(sa_column=Column(JSON))
    topics: list[str] | None = Field(default=None, sa_column=Column(JSON))
    status: str = Field(
        default="waiting", max_length=20
    )  # waiting, ready, in_progress, completed
    host_ready: bool = Field(default=False)
    guest_ready: bool = Field(default=False)
    # Health and shield
    host_health: int = Field(default=10)
    guest_health: int = Field(default=10)
    host_shield: int = Field(default=0)
    guest_shield: int = Field(
        default=3
    )  # Guest starts with shield for turn order balance
    max_health: int = Field(
        default=10
    )  # Changed from 30 - health caps at starting value
    # Card state (JSON arrays of card instances with question_id)
    host_hand: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    guest_hand: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    deck: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )  # Shuffled deck
    discard_pile: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    # Turn state
    current_turn: str = Field(default="host", max_length=10)  # "host" or "guest"
    turn_number: int = Field(default=0)
    fatigue_damage: int = Field(default=0)  # Escalates when deck is empty
    # Winner tracking
    winner: str | None = Field(default=None, max_length=10)  # "host", "guest", or None
    end_reason: str | None = Field(
        default=None, max_length=20
    )  # "health_zero", "forfeit"


class CardGameSession(CardGameSessionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    host_id: uuid.UUID = Field(foreign_key="user.id")
    guest_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: datetime | None = Field(default=None)
    completed_at: datetime | None = Field(default=None)

    # Relationships
    host: User | None = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[CardGameSession.host_id]",
            "lazy": "joined",
        }
    )
    guest: User | None = Relationship(
        sa_relationship_kwargs={
            "foreign_keys": "[CardGameSession.guest_id]",
            "lazy": "joined",
        }
    )
    answers: list["CardGameAnswer"] = Relationship(
        back_populates="game_session",
        cascade_delete=True,
    )


class CardGameSessionCreate(SQLModel):
    subjects: list[str]
    topics: list[str] | None = None


class CardGameSessionPublic(CardGameSessionBase):
    id: uuid.UUID
    host_id: uuid.UUID
    guest_id: uuid.UUID | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class CardGameSessionWithPlayers(CardGameSessionPublic):
    host_name: str | None = None
    guest_name: str | None = None


# CardGameAnswer - Tracks player answers/card plays in card games
class CardGameAnswerBase(SQLModel):
    turn_number: int = Field(ge=0)
    card_played: dict[str, Any] = Field(sa_column=Column(JSON))  # Card instance data
    selected_answers: list[int] = Field(
        sa_column=Column(JSON)
    )  # Indices of selected choices
    is_correct: bool
    effect_value: int = Field(ge=0)  # Actual value applied (min or max based on answer)


class CardGameAnswer(CardGameAnswerBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    game_session_id: uuid.UUID = Field(foreign_key="cardgamesession.id")
    user_id: uuid.UUID = Field(foreign_key="user.id")
    question_id: uuid.UUID = Field(foreign_key="question.id")
    answered_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    game_session: CardGameSession | None = Relationship(back_populates="answers")
    user: User | None = Relationship()
    question: Question | None = Relationship()


class CardGameAnswerCreate(SQLModel):
    card_index: int  # Index of card in player's hand
    selected_answers: list[int]  # Indices of selected choices


class CardGameAnswerPublic(CardGameAnswerBase):
    id: uuid.UUID
    game_session_id: uuid.UUID
    user_id: uuid.UUID
    question_id: uuid.UUID
    answered_at: datetime


class CardGameAnswersPublic(SQLModel):
    data: list[CardGameAnswerPublic]
    count: int


# Response models for card game API
class CardGameCreateResponse(SQLModel):
    room_code: str
    game_id: str
    subjects: list[str]
    topics: list[str] | None = None


class CardGameJoinResponse(SQLModel):
    game_id: str
    host_name: str
    status: str
    subjects: list[str]
    topics: list[str] | None = None


class CardGameAnswerResponse(SQLModel):
    is_correct: bool
    effect_value: int
    card_type: str
    target_health: int | None = None
    target_shield: int | None = None


class CardGamePlayerState(SQLModel):
    id: str
    name: str
    health: int
    shield: int
    hand_count: int
    is_current_turn: bool


class CardGameStatePublic(SQLModel):
    game_id: str
    status: str
    host: CardGamePlayerState
    guest: CardGamePlayerState | None
    deck_count: int
    turn_number: int
    fatigue_damage: int
    current_turn: str
    winner: str | None = None


class CardInstance(SQLModel):
    """Represents a card instance in a player's hand or deck"""

    card_key: str
    name: str
    card_type: str
    effect_data: dict[str, Any]
    question_id: str  # UUID as string


class CardGameResultsResponse(SQLModel):
    game_id: str
    status: str
    winner: str | None
    end_reason: str | None
    host: CardGamePlayerState
    guest: CardGamePlayerState | None
    total_turns: int
