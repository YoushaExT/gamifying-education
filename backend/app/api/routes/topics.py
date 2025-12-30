from typing import Any

from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Topic, TopicsPublic

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("/", response_model=TopicsPublic)
def read_topics(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve all topics.
    """
    count_statement = select(func.count()).select_from(Topic)
    count = session.exec(count_statement).one()

    statement = select(Topic).order_by(Topic.name).offset(skip).limit(limit)
    topics = session.exec(statement).all()

    return TopicsPublic(data=topics, count=count)
