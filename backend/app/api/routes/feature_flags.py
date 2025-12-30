"""API routes for feature flag management."""

from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.crud import (
    get_feature_flag,
    get_feature_flags,
    update_feature_flag,
)
from app.models import (
    FeatureFlag,
    FeatureFlagPublic,
    FeatureFlagsPublic,
    FeatureFlagUpdate,
)
from app.services.feature_flags import FeatureFlagService

router = APIRouter()


@router.get("/", response_model=FeatureFlagsPublic)
def list_feature_flags_for_user(
    session: SessionDep,
    _current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List all feature flags with user-specific enabled status.

    Returns flags with their configuration, which frontend can use
    to determine feature availability.
    """
    flags = get_feature_flags(session=session, skip=skip, limit=limit)
    count_statement = select(func.count()).select_from(FeatureFlag)
    count = session.exec(count_statement).one()

    return FeatureFlagsPublic(data=flags, count=count)


@router.get("/admin", response_model=FeatureFlagsPublic)
def list_all_feature_flags(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List all feature flags for admin management.

    Only accessible to superusers.
    """
    get_current_active_superuser(current_user)  # Check superuser access
    flags = get_feature_flags(session=session, skip=skip, limit=limit)
    count_statement = select(func.count()).select_from(FeatureFlag)
    count = session.exec(count_statement).one()

    return FeatureFlagsPublic(data=flags, count=count)


@router.put("/{flag_key}", response_model=FeatureFlagPublic)
def update_flag(
    *,
    session: SessionDep,
    flag_key: str,
    flag_update: FeatureFlagUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update a feature flag configuration.

    Only accessible to superusers.
    """
    get_current_active_superuser(current_user)  # Check superuser access
    db_flag = get_feature_flag(session=session, flag_key=flag_key)
    if not db_flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    db_flag = update_feature_flag(session=session, db_flag=db_flag, flag_in=flag_update)
    return db_flag


@router.get("/{flag_key}/status")
def check_flag_status(
    *,
    session: SessionDep,
    flag_key: str,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """
    Check if a feature flag is enabled for the current user.

    Returns a simple boolean indicating whether the feature is available.
    """
    flag_service = FeatureFlagService(session)

    user_roles = []
    if current_user.is_superuser:
        user_roles.append("superuser")
    if current_user.is_teacher:
        user_roles.append("teacher")

    enabled = flag_service.is_enabled(
        flag_key=flag_key,
        user_id=current_user.id,
        user_roles=user_roles,
    )

    return {"enabled": enabled}
