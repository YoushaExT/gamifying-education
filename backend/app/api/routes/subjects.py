from typing import Any

from fastapi import APIRouter
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Subject, SubjectsPublic

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("/", response_model=SubjectsPublic)
def read_subjects(
    session: SessionDep, _current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve all subjects.
    """
    count_statement = select(func.count()).select_from(Subject)
    count = session.exec(count_statement).one()

    statement = select(Subject).order_by(Subject.name).offset(skip).limit(limit)
    subjects = session.exec(statement).all()

    return SubjectsPublic(data=subjects, count=count)
