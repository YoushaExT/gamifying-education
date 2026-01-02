from fastapi import APIRouter

from app.api.routes import (
    admin_games,
    feature_flags,
    items,
    login,
    media,
    multiplayer_game,
    private,
    question_generation,
    question_templates,
    questions,
    quizzes,
    subjects,
    topics,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(questions.router)
api_router.include_router(subjects.router)
api_router.include_router(topics.router)
api_router.include_router(
    question_generation.router,
    prefix="/question-generation",
    tags=["question-generation"],
)
api_router.include_router(
    question_templates.router,
    prefix="/question-templates",
    tags=["question-templates"],
)
api_router.include_router(
    feature_flags.router,
    prefix="/feature-flags",
    tags=["feature-flags"],
)
api_router.include_router(
    quizzes.router,
    prefix="/quizzes",
    tags=["quizzes"],
)
api_router.include_router(
    multiplayer_game.router,
    prefix="/multiplayer",
    tags=["multiplayer-game"],
)
api_router.include_router(
    admin_games.router,
    tags=["admin"],
)
api_router.include_router(media.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
