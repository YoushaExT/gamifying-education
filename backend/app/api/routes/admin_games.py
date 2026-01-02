"""Admin routes for game management."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser

router = APIRouter()


class AdminGamePlayerInfo(BaseModel):
    """Player information for admin game list."""

    id: str
    name: str
    health: int
    shield: int


class AdminGameListItem(BaseModel):
    """Single game in admin active games list."""

    game_id: str
    room_code: str
    status: str
    host: AdminGamePlayerInfo
    guest: AdminGamePlayerInfo | None
    created_at: datetime
    started_at: datetime | None
    turn_number: int
    current_turn: str
    deck_count: int
    duration_minutes: int | None = Field(
        description="Duration in minutes since game started"
    )


class AdminGameListResponse(BaseModel):
    """Response for active games list."""

    games: list[AdminGameListItem]
    total: int


class ForceCompleteResponse(BaseModel):
    """Response for force complete action."""

    message: str
    game_id: str


@router.get(
    "/admin/games/active",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=AdminGameListResponse,
)
def get_active_games(
    *,
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
) -> AdminGameListResponse:
    """
    Get all active games (superuser only).

    Returns list of all games currently in progress with player details.
    """
    games, total = crud.get_active_games(session=session, skip=skip, limit=limit)

    # Build response
    game_list = []
    for game in games:
        # Calculate duration
        duration_minutes = None
        if game.started_at:
            duration = datetime.utcnow() - game.started_at
            duration_minutes = int(duration.total_seconds() / 60)

        # Build host info
        host_name = (
            game.host.full_name
            if game.host and game.host.full_name
            else game.host.email
            if game.host
            else "Unknown"
        )

        host_info = AdminGamePlayerInfo(
            id=str(game.host_id),
            name=host_name,
            health=game.host_health,
            shield=game.host_shield,
        )

        # Build guest info if exists
        guest_info = None
        if game.guest_id and game.guest:
            guest_name = (
                game.guest.full_name if game.guest.full_name else game.guest.email
            )
            guest_info = AdminGamePlayerInfo(
                id=str(game.guest_id),
                name=guest_name,
                health=game.guest_health,
                shield=game.guest_shield,
            )

        game_list.append(
            AdminGameListItem(
                game_id=str(game.id),
                room_code=game.room_code,
                status=game.status,
                host=host_info,
                guest=guest_info,
                created_at=game.created_at,
                started_at=game.started_at,
                turn_number=game.turn_number,
                current_turn=game.current_turn,
                deck_count=len(game.deck),
                duration_minutes=duration_minutes,
            )
        )

    return AdminGameListResponse(games=game_list, total=total)


@router.post(
    "/admin/games/{game_id}/force-complete",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ForceCompleteResponse,
)
def force_complete_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> ForceCompleteResponse:
    """
    Force complete a game (superuser only).

    Marks the game as completed with no winner. Used to clean up stuck games.
    """
    try:
        game = crud.force_complete_game(
            session=session, game_id=game_id, admin_user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ForceCompleteResponse(
        message=f"Game {game.room_code} has been force-completed.",
        game_id=str(game.id),
    )


@router.post(
    "/admin/games/cleanup",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=dict[str, Any],
)
def cleanup_abandoned_games(
    *,
    session: SessionDep,
    hours_inactive: int = 1,
) -> dict[str, Any]:
    """
    Clean up abandoned games (superuser only).

    Finds games that have been in progress for more than specified hours
    and marks them as completed with 'abandoned' end reason.
    """
    cleaned_games = crud.cleanup_abandoned_games(
        session=session, hours_inactive=hours_inactive
    )

    return {
        "message": f"Cleaned up {len(cleaned_games)} abandoned games.",
        "count": len(cleaned_games),
        "game_ids": [str(g.id) for g in cleaned_games],
    }
