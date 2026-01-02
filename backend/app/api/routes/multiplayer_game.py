"""Card game API routes with WebSocket support."""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import Session

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.core.db import engine
from app.models import (
    CardGameAnswerCreate,
    CardGameAnswerResponse,
    CardGameCreateResponse,
    CardGameJoinResponse,
    CardGamePlayerState,
    CardGameResultsResponse,
    CardGameSessionCreate,
    CardGameSessionWithPlayers,
    CardGameStatePublic,
    Question,
)
from app.services.card_template_service import CardTemplateService
from app.services.game_service import CardGameService

router = APIRouter()
logger = logging.getLogger(__name__)

# Store active game tasks
active_game_tasks: dict[str, asyncio.Task[Any]] = {}


# ==================== REST API Endpoints ====================


@router.post("/games/create", response_model=CardGameCreateResponse)
def create_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_in: CardGameSessionCreate,
) -> CardGameCreateResponse:
    """
    Create a new card game session.
    Returns room code that can be shared with other player.
    """
    # Check if user already has an active game
    active_game = crud.get_user_active_game(session=session, user_id=current_user.id)
    if active_game:
        raise HTTPException(
            status_code=400,
            detail="You already have an active game. Please finish or forfeit it first.",
        )

    # Ensure card templates are seeded
    card_service = CardTemplateService(session)
    card_service.seed_if_empty()

    # Create game service to build the deck
    game_service_temp = CardGameService(session, uuid.uuid4())
    deck = game_service_temp.create_game_deck(
        subjects=game_in.subjects,
        topics=game_in.topics,
    )

    if len(deck) < 10:
        raise HTTPException(
            status_code=400,
            detail="Not enough questions for the selected subjects/topics. "
            "Need at least 10 questions.",
        )

    try:
        game = crud.create_card_game_session(
            session=session,
            game_in=game_in,
            host_id=current_user.id,
            deck=deck,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CardGameCreateResponse(
        room_code=game.room_code,
        game_id=str(game.id),
        subjects=game.subjects,
        topics=game.topics,
    )


@router.post("/games/join/{room_code}", response_model=CardGameJoinResponse)
def join_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    room_code: str,
) -> CardGameJoinResponse:
    """
    Join an existing card game session using room code.
    """
    game = crud.get_card_game_session_by_code(
        session=session, room_code=room_code.upper()
    )

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if user already has an active game (but allow rejoining same game)
    active_game = crud.get_user_active_game(session=session, user_id=current_user.id)
    if active_game and active_game.id != game.id:
        raise HTTPException(
            status_code=400,
            detail="You already have an active game. Please finish or forfeit it first.",
        )

    if game.status != "waiting":
        raise HTTPException(status_code=400, detail="Game has already started or ended")

    try:
        game = crud.join_card_game_session(
            session=session,
            game_id=game.id,
            guest_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    host_name = (
        game.host.full_name
        if game.host and game.host.full_name
        else game.host.email
        if game.host
        else "Unknown"
    )

    return CardGameJoinResponse(
        game_id=str(game.id),
        host_name=host_name,
        status=game.status,
        subjects=game.subjects,
        topics=game.topics,
    )


@router.get("/games/active", response_model=CardGameSessionWithPlayers | None)
def get_active_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get user's active game if they have one.

    Returns the game session where user is participating and status is 'in_progress'.
    Used by frontend to show rejoin bar. Returns None if no active game.
    """
    game = crud.get_user_active_game(session=session, user_id=current_user.id)

    if not game:
        return None

    host_name = (
        game.host.full_name
        if game.host and game.host.full_name
        else game.host.email
        if game.host
        else "Unknown"
    )
    guest_name = None
    if game.guest:
        guest_name = game.guest.full_name if game.guest.full_name else game.guest.email

    return CardGameSessionWithPlayers(
        **game.model_dump(),
        host_name=host_name,
        guest_name=guest_name,
    )


# ==================== Game History ====================


class GameHistoryItem(BaseModel):
    """Single game in user's history."""

    game_id: str
    room_code: str
    opponent_name: str
    outcome: str  # "won" | "lost" | "abandoned" | "forced_ended"
    completed_at: datetime | None
    duration_minutes: int | None
    user_final_health: int
    opponent_final_health: int
    total_turns: int


class GameHistoryResponse(BaseModel):
    """Response for game history list."""

    games: list[GameHistoryItem]
    total: int


@router.get("/games/history", response_model=GameHistoryResponse)
def get_game_history(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
) -> GameHistoryResponse:
    """
    Get user's game history.

    Returns completed games where user was host or guest, with outcome from user's perspective.
    """
    history, total = crud.get_user_game_history(
        session=session, user_id=current_user.id, skip=skip, limit=limit
    )

    # Convert dict history to Pydantic models
    game_items = [GameHistoryItem(**game_dict) for game_dict in history]

    return GameHistoryResponse(games=game_items, total=total)


@router.get("/games/{game_id}", response_model=CardGameSessionWithPlayers)
def get_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> Any:
    """
    Get card game session details.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.host_id != current_user.id and game.guest_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this game")

    host_name = (
        game.host.full_name
        if game.host and game.host.full_name
        else game.host.email
        if game.host
        else "Unknown"
    )
    guest_name = None
    if game.guest:
        guest_name = game.guest.full_name if game.guest.full_name else game.guest.email

    return CardGameSessionWithPlayers(
        **game.model_dump(),
        host_name=host_name,
        guest_name=guest_name,
    )


@router.get("/games/{game_id}/state", response_model=CardGameStatePublic)
def get_game_state(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> CardGameStatePublic:
    """
    Get current game state including health, shield, deck count, etc.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if user is part of this game
    if game.host_id != current_user.id and game.guest_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    game_service = CardGameService(session, game_id)
    state = game_service.get_game_state()

    return CardGameStatePublic(
        game_id=state["game_id"],
        status=state["status"],
        host=CardGamePlayerState(**state["host"]),
        guest=CardGamePlayerState(**state["guest"]) if state["guest"] else None,
        deck_count=state["deck_count"],
        turn_number=state["turn_number"],
        fatigue_damage=state["fatigue_damage"],
        current_turn=state["current_turn"],
        winner=state["winner"],
    )


@router.get("/games/{game_id}/random-question")
def get_random_question_for_game(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> Question:
    """Get a random question from the game's question pool for ability mechanic."""
    game = crud.get_card_game_session(session=session, game_id=game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Verify user is a player in this game
    if current_user.id not in [game.host_id, game.guest_id]:
        raise HTTPException(status_code=403, detail="Not a player in this game")

    # Get random question from game's subjects/topics
    game_service = CardGameService(session, game_id)
    questions = game_service._get_random_questions(game.subjects, game.topics, limit=1)

    if not questions:
        raise HTTPException(status_code=404, detail="No questions available")

    return questions[0]


@router.post("/games/{game_id}/ready")
def mark_ready(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
    ready: bool = True,
) -> dict[str, Any]:
    """
    Mark current player as ready.
    """
    try:
        game = crud.mark_card_game_player_ready(
            session=session,
            game_id=game_id,
            user_id=current_user.id,
            ready=ready,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "game_id": str(game.id),
        "host_ready": game.host_ready,
        "guest_ready": game.guest_ready,
        "status": game.status,
    }


@router.get("/games/{game_id}/hand")
def get_player_hand(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """
    Get the current player's hand of cards.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Determine which player this is
    if game.host_id == current_user.id:
        player = "host"
    elif game.guest_id == current_user.id:
        player = "guest"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    game_service = CardGameService(session, game_id)
    return game_service.get_player_hand(player)


@router.post("/games/{game_id}/play-card", response_model=CardGameAnswerResponse)
def play_card(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
    answer_in: CardGameAnswerCreate,
) -> CardGameAnswerResponse:
    """
    Play a card and submit the answer to the MCQ.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.status != "in_progress":
        raise HTTPException(status_code=400, detail="Game is not in progress")

    # Determine which player this is
    if game.host_id == current_user.id:
        player = "host"
    elif game.guest_id == current_user.id:
        player = "guest"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if it's this player's turn
    if game.current_turn != player:
        raise HTTPException(status_code=400, detail="Not your turn")

    game_service = CardGameService(session, game_id)

    # Play the card and get the question
    card, question = game_service.play_card(player, answer_in.card_index)

    if not card or not question:
        raise HTTPException(status_code=400, detail="Invalid card index")

    # Resolve the answer
    is_correct, effect_value = game_service.resolve_answer(
        player=player,
        card=card,
        question=question,
        selected_answers=answer_in.selected_answers,
    )

    # Get updated game state for the response
    game = crud.get_card_game_session(session=session, game_id=game_id)

    # Determine target health/shield based on card type
    target_health = None
    target_shield = None
    card_type = card.get("card_type", "")

    if card_type == "basic_damage":
        # Damage affects opponent
        if player == "host":
            target_health = game.guest_health if game else 0
            target_shield = game.guest_shield if game else 0
        else:
            target_health = game.host_health if game else 0
            target_shield = game.host_shield if game else 0
    elif card_type in ("basic_shield", "basic_heal"):
        # Shield/Heal affects self
        if player == "host":
            target_health = game.host_health if game else 0
            target_shield = game.host_shield if game else 0
        else:
            target_health = game.guest_health if game else 0
            target_shield = game.guest_shield if game else 0

    return CardGameAnswerResponse(
        is_correct=is_correct,
        effect_value=effect_value,
        card_type=card_type,
        target_health=target_health,
        target_shield=target_shield,
    )


@router.post("/games/{game_id}/skip-turn")
def skip_turn(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Skip the current turn.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.status != "in_progress":
        raise HTTPException(status_code=400, detail="Game is not in progress")

    # Determine which player this is
    if game.host_id == current_user.id:
        player = "host"
    elif game.guest_id == current_user.id:
        player = "guest"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if it's this player's turn
    if game.current_turn != player:
        raise HTTPException(status_code=400, detail="Not your turn")

    game_service = CardGameService(session, game_id)
    result = game_service.skip_turn()

    return result


@router.get("/games/{game_id}/results", response_model=CardGameResultsResponse)
def get_game_results(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    game_id: uuid.UUID,
) -> CardGameResultsResponse:
    """
    Get final card game results.
    """
    game = crud.get_card_game_session(session=session, game_id=game_id)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Check if user is part of this game
    if game.host_id != current_user.id and game.guest_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    host_name = (
        game.host.full_name
        if game.host and game.host.full_name
        else game.host.email
        if game.host
        else "Unknown"
    )
    guest_name = None
    if game.guest:
        guest_name = game.guest.full_name if game.guest.full_name else game.guest.email

    return CardGameResultsResponse(
        game_id=str(game.id),
        status=game.status,
        winner=game.winner,
        end_reason=game.end_reason,
        host=CardGamePlayerState(
            id=str(game.host_id),
            name=host_name,
            health=game.host_health,
            shield=game.host_shield,
            hand_count=len(game.host_hand),
            is_current_turn=game.current_turn == "host",
        ),
        guest=CardGamePlayerState(
            id=str(game.guest_id) if game.guest_id else "",
            name=guest_name or "",
            health=game.guest_health,
            shield=game.guest_shield,
            hand_count=len(game.guest_hand),
            is_current_turn=game.current_turn == "guest",
        )
        if game.guest_id
        else None,
        total_turns=game.turn_number,
    )


# ==================== WebSocket Connection Manager ====================


class ConnectionManager:
    """Manages WebSocket connections for card games."""

    def __init__(self) -> None:
        # game_id -> list of (user_id, websocket) tuples
        self.active_connections: dict[str, list[tuple[str, WebSocket]]] = {}

    async def connect(self, game_id: str, user_id: str, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append((user_id, websocket))

    def disconnect(self, game_id: str, user_id: str) -> None:
        """Remove a WebSocket connection."""
        if game_id in self.active_connections:
            self.active_connections[game_id] = [
                (uid, ws)
                for uid, ws in self.active_connections[game_id]
                if uid != user_id
            ]
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]

    async def send_to_user(
        self, game_id: str, user_id: str, message: dict[str, Any]
    ) -> None:
        """Send a message to a specific user in a game."""
        if game_id in self.active_connections:
            for uid, websocket in self.active_connections[game_id]:
                if uid == user_id:
                    try:
                        await websocket.send_json(message)
                    except Exception as e:
                        logger.warning(f"Failed to send to user {uid}: {e}")

    async def broadcast(
        self, game_id: str, message: dict[str, Any], exclude_user: str | None = None
    ) -> None:
        """Broadcast a message to all users in a game."""
        if game_id in self.active_connections:
            connections = self.active_connections[game_id]
            logger.debug(
                f"Broadcasting to game {game_id}: {len(connections)} connections, "
                f"type={message.get('type')}, exclude={exclude_user}"
            )

            for uid, websocket in connections:
                if exclude_user and uid == exclude_user:
                    continue
                try:
                    await websocket.send_json(message)
                    logger.debug(f"Sent {message.get('type')} to user {uid}")
                except Exception as e:
                    logger.warning(f"Failed to send to user {uid}: {e}")


manager = ConnectionManager()


@router.websocket("/games/{game_id}/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: uuid.UUID,
) -> None:
    """
    WebSocket endpoint for real-time card game updates.
    Client must send user_id in first message after connecting.

    Events handled:
    - player_ready: Player marks themselves as ready
    - play_card: Player plays a card with answer
    - activate_ability: Player activates special ability
    - skip_turn: Player skips their turn
    """
    user_id: str | None = None
    game_id_str = str(game_id)

    try:
        await websocket.accept()

        # Wait for initial user_id message
        data = await websocket.receive_json()
        if "user_id" not in data:
            await websocket.close(code=1008, reason="user_id required")
            return

        user_id = str(data["user_id"])

        # Get game session to validate
        with Session(engine) as db_session:
            game = crud.get_card_game_session(session=db_session, game_id=game_id)
            if not game:
                await websocket.close(code=1008, reason="Game not found")
                return

            # Validate user is part of this game
            is_host = str(game.host_id) == user_id
            is_guest = game.guest_id and str(game.guest_id) == user_id

            if not is_host and not is_guest:
                await websocket.close(code=1008, reason="User not in this game")
                return

            # Add connection to manager
            if game_id_str not in manager.active_connections:
                manager.active_connections[game_id_str] = []
            manager.active_connections[game_id_str].append((user_id, websocket))

            # Get player names
            host_name = (
                game.host.full_name
                if game.host and game.host.full_name
                else game.host.email
                if game.host
                else "Host"
            )
            guest_name = None
            if game.guest:
                guest_name = (
                    game.guest.full_name if game.guest.full_name else game.guest.email
                )

            # Get game service for state
            game_service = CardGameService(db_session, game_id)
            current_state = game_service.get_game_state()

            # Get player's hand if game is in progress
            player_hand = None
            if game.status == "in_progress":
                player = "host" if is_host else "guest"
                player_hand = game_service.get_player_hand(player)

            # Send connection confirmation with current game state
            await websocket.send_json(
                {
                    "type": "connected",
                    "game_id": game_id_str,
                    "user_id": user_id,
                    "player": "host" if is_host else "guest",
                    "hand": player_hand,  # Include hand for reconnection
                    "game_state": {
                        "status": game.status,
                        "host_ready": game.host_ready,
                        "guest_ready": game.guest_ready,
                        "host_id": str(game.host_id),
                        "guest_id": str(game.guest_id) if game.guest_id else None,
                        "host_name": host_name,
                        "guest_name": guest_name,
                        **current_state,
                    },
                }
            )

            # Broadcast player joined/reconnected
            was_already_connected = (
                sum(
                    1
                    for uid, _ in manager.active_connections.get(game_id_str, [])
                    if uid == user_id
                )
                > 1
            )

            # Notify other players when someone joins or reconnects
            if not was_already_connected:
                player_name = host_name if is_host else guest_name
                await manager.broadcast(
                    game_id_str,
                    {
                        "type": "player_joined",
                        "user_id": user_id,
                        "player_name": player_name,
                        "player_role": "host" if is_host else "guest",
                        "player_state": current_state.get(
                            "host" if is_host else "guest"
                        ),
                    },
                    exclude_user=user_id,
                )

        # Keep connection alive and handle messages
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "player_ready":
                await handle_player_ready(game_id, game_id_str, user_id, websocket)

            elif event_type == "play_card":
                # Check if this is ability-enhanced play (requires 2 questions)
                if data.get("is_ability_card", False):
                    await handle_play_card_with_ability(
                        game_id,
                        game_id_str,
                        user_id,
                        data.get("card_index", 0),
                        data.get("selected_answers1", []),
                        data.get("selected_answers2"),
                        websocket,
                    )
                else:
                    # Normal single question flow
                    await handle_play_card(
                        game_id,
                        game_id_str,
                        user_id,
                        data.get("card_index", 0),
                        data.get("selected_answers", []),
                        websocket,
                    )

            elif event_type == "activate_ability":
                await handle_activate_ability(game_id, game_id_str, user_id, websocket)

            elif event_type == "skip_turn":
                await handle_skip_turn(game_id, game_id_str, user_id, websocket)

            elif event_type == "forfeit_game":
                await handle_forfeit_game(game_id, game_id_str, user_id, websocket)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnect: user={user_id}, game={game_id_str}")
        if user_id:
            # Notify other players
            await manager.broadcast(
                game_id_str,
                {
                    "type": "player_disconnected",
                    "user_id": user_id,
                },
                exclude_user=user_id,
            )

            # Remove from manager
            manager.disconnect(game_id_str, user_id)

            # Check how many players are still connected
            remaining_connections = len(manager.active_connections.get(game_id_str, []))
            logger.info(
                f"After disconnect: {remaining_connections} connections remaining "
                f"for game {game_id_str}"
            )

            # If no players left, log for potential cleanup
            if remaining_connections == 0:
                logger.warning(
                    f"All players disconnected from game {game_id_str}. "
                    f"Game may need cleanup if not rejoined."
                )

            # Cancel game task if exists
            if game_id_str in active_game_tasks:
                active_game_tasks[game_id_str].cancel()
                del active_game_tasks[game_id_str]
                logger.info(f"Cancelled active game task for game {game_id_str}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if user_id:
            manager.disconnect(game_id_str, user_id)
        await websocket.close(code=1011, reason=str(e))


async def handle_player_ready(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    websocket: WebSocket,
) -> None:
    """Handle player ready event."""
    with Session(engine) as db_session:
        try:
            game = crud.mark_card_game_player_ready(
                session=db_session,
                game_id=game_id,
                user_id=uuid.UUID(user_id),
                ready=True,
            )

            if not game:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Game not found",
                    }
                )
                return

            # Broadcast ready status
            await manager.broadcast(
                game_id_str,
                {
                    "type": "player_ready",
                    "user_id": user_id,
                    "host_ready": game.host_ready,
                    "guest_ready": game.guest_ready,
                },
            )

            # If both ready, start game
            if game.host_ready and game.guest_ready and game.guest_id:
                if game_id_str not in active_game_tasks:
                    # Draw initial hands for both players
                    game_service = CardGameService(db_session, game_id)

                    # Draw 3 cards for each player
                    game_service.draw_cards("host", 3)
                    game_service.draw_cards("guest", 3)

                    # Start game
                    crud.start_card_game(session=db_session, game_id=game_id)

                    # Refresh game to get updated state
                    game = crud.get_card_game_session(
                        session=db_session, game_id=game_id
                    )
                    if not game:
                        return

                    game_service = CardGameService(db_session, game_id)

                    # Broadcast game start to all
                    await manager.broadcast(
                        game_id_str,
                        {
                            "type": "game_start",
                            "state": game_service.get_game_state(),
                        },
                    )

                    # Send each player their own hand privately
                    host_hand = game_service.get_player_hand("host")
                    guest_hand = game_service.get_player_hand("guest")

                    logger.info(f"Host hand ({len(host_hand)} cards): {host_hand}")
                    logger.info(f"Guest hand ({len(guest_hand)} cards): {guest_hand}")

                    await manager.send_to_user(
                        game_id_str,
                        str(game.host_id),
                        {
                            "type": "your_hand",
                            "hand": host_hand,
                        },
                    )
                    await manager.send_to_user(
                        game_id_str,
                        str(game.guest_id),
                        {
                            "type": "your_hand",
                            "hand": guest_hand,
                        },
                    )

                    # Broadcast turn start
                    await manager.broadcast(
                        game_id_str,
                        {
                            "type": "turn_start",
                            "current_player": game.current_turn,
                            "turn_number": game.turn_number,
                            "timer_seconds": 30,
                            "state": game_service.get_game_state(),
                        },
                    )

        except ValueError as e:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": str(e),
                }
            )


async def handle_play_card(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    card_index: int,
    selected_answers: list[int],
    websocket: WebSocket,
) -> None:
    """Handle play card event via WebSocket."""
    with Session(engine) as db_session:
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if not game:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Game not found",
                }
            )
            return

        # Determine player
        if str(game.host_id) == user_id:
            player = "host"
        elif game.guest_id and str(game.guest_id) == user_id:
            player = "guest"
        else:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Not a player in this game",
                }
            )
            return

        # Check if it's this player's turn
        if game.current_turn != player:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Not your turn",
                }
            )
            return

        game_service = CardGameService(db_session, game_id)

        # Play the card
        card, question = game_service.play_card(player, card_index)

        if not card or not question:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Invalid card index",
                }
            )
            return

        # Resolve the answer
        is_correct, effect_value = game_service.resolve_answer(
            player=player,
            card=card,
            question=question,
            selected_answers=selected_answers,
        )

        # Get card type for response
        card_type = card.get("card_type", "")

        # Broadcast card resolved to all players
        await manager.broadcast(
            game_id_str,
            {
                "type": "card_resolved",
                "player": player,
                "card": {
                    "card_key": card["card_key"],
                    "name": card["name"],
                    "card_type": card_type,
                },
                "is_correct": is_correct,
                "effect_value": effect_value,
                "state": game_service.get_game_state(),
            },
        )

        # Check for game over
        winner = game_service.check_game_over()
        if winner:
            await manager.broadcast(
                game_id_str,
                {
                    "type": "game_over",
                    "winner": winner,
                    "state": game_service.get_game_state(),
                },
            )
        else:
            # End turn and start next
            result = game_service.end_turn()

            # Refresh game to get updated hands
            game = crud.get_card_game_session(session=db_session, game_id=game_id)
            if game:
                # Send updated hands to each player
                host_hand = game_service.get_player_hand("host")
                guest_hand = game_service.get_player_hand("guest")

                await manager.send_to_user(
                    game_id_str,
                    str(game.host_id),
                    {"type": "your_hand", "hand": host_hand},
                )
                if game.guest_id:
                    await manager.send_to_user(
                        game_id_str,
                        str(game.guest_id),
                        {"type": "your_hand", "hand": guest_hand},
                    )

            await manager.broadcast(
                game_id_str,
                {
                    "type": "turn_end",
                    "fatigue_damage": result.get("fatigue_damage", 0),
                    "next_player": result.get("next_player"),
                    "state": game_service.get_game_state(),
                },
            )

            # Check for game over after fatigue
            winner = game_service.check_game_over()
            if winner:
                await manager.broadcast(
                    game_id_str,
                    {
                        "type": "game_over",
                        "winner": winner,
                        "state": game_service.get_game_state(),
                    },
                )


async def handle_skip_turn(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    websocket: WebSocket,
) -> None:
    """Handle skip turn event via WebSocket."""
    with Session(engine) as db_session:
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if not game:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Game not found",
                }
            )
            return

        # Determine player
        if str(game.host_id) == user_id:
            player = "host"
        elif game.guest_id and str(game.guest_id) == user_id:
            player = "guest"
        else:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Not a player in this game",
                }
            )
            return

        # Check if it's this player's turn
        if game.current_turn != player:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Not your turn",
                }
            )
            return

        game_service = CardGameService(db_session, game_id)
        result = game_service.skip_turn()

        # Send updated hands to each player (next player may have drawn)
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if game:
            host_hand = game_service.get_player_hand("host")
            guest_hand = game_service.get_player_hand("guest")

            await manager.send_to_user(
                game_id_str,
                str(game.host_id),
                {"type": "your_hand", "hand": host_hand},
            )
            if game.guest_id:
                await manager.send_to_user(
                    game_id_str,
                    str(game.guest_id),
                    {"type": "your_hand", "hand": guest_hand},
                )

        # Broadcast turn skipped
        await manager.broadcast(
            game_id_str,
            {
                "type": "turn_skipped",
                "player": player,
                "fatigue_damage": result.get("fatigue_damage", 0),
                "next_player": result.get("next_player"),
                "state": game_service.get_game_state(),
            },
        )

        # Check for game over after fatigue
        winner = game_service.check_game_over()
        if winner:
            await manager.broadcast(
                game_id_str,
                {
                    "type": "game_over",
                    "winner": winner,
                    "state": game_service.get_game_state(),
                },
            )


async def handle_forfeit_game(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    websocket: WebSocket,
) -> None:
    """Handle game forfeit event via WebSocket."""
    with Session(engine) as db_session:
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if not game:
            await websocket.send_json({"type": "error", "message": "Game not found"})
            return

        # Determine player
        if str(game.host_id) == user_id:
            player = "host"
        elif game.guest_id and str(game.guest_id) == user_id:
            player = "guest"
        else:
            await websocket.send_json(
                {"type": "error", "message": "Not a player in this game"}
            )
            return

        # Can only forfeit in-progress games
        if game.status != "in_progress":
            await websocket.send_json(
                {"type": "error", "message": "Can only forfeit an in-progress game"}
            )
            return

        game_service = CardGameService(db_session, game_id)

        try:
            winner = game_service.forfeit_game(player)

            # Broadcast game over with forfeit information
            await manager.broadcast(
                game_id_str,
                {
                    "type": "game_over",
                    "winner": winner,
                    "end_reason": "forfeit",
                    "forfeiter": player,
                    "state": game_service.get_game_state(),
                },
            )
        except ValueError as e:
            await websocket.send_json({"type": "error", "message": str(e)})


async def handle_activate_ability(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    websocket: WebSocket,
) -> None:
    """Handle special ability activation."""
    with Session(engine) as db_session:
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if not game:
            await websocket.send_json({"type": "error", "message": "Game not found"})
            return

        # Determine player and validate turn
        if str(game.host_id) == user_id:
            player = "host"
        elif game.guest_id and str(game.guest_id) == user_id:
            player = "guest"
        else:
            await websocket.send_json({"type": "error", "message": "Not a player"})
            return

        if game.current_turn != player:
            await websocket.send_json({"type": "error", "message": "Not your turn"})
            return

        game_service = CardGameService(db_session, game_id)

        try:
            result = game_service.activate_ability(player)
            await manager.broadcast(
                game_id_str,
                {
                    "type": "ability_activated",
                    "player": player,
                    "cooldown": result["cooldown"],
                    "state": game_service.get_game_state(),
                },
            )
        except ValueError as e:
            await websocket.send_json({"type": "error", "message": str(e)})


async def handle_play_card_with_ability(
    game_id: uuid.UUID,
    game_id_str: str,
    user_id: str,
    card_index: int,
    selected_answers1: list[int],
    selected_answers2: list[int] | None,
    websocket: WebSocket,
) -> None:
    """Handle card play when special ability is active (requires 2 answers)."""
    with Session(engine) as db_session:
        game = crud.get_card_game_session(session=db_session, game_id=game_id)
        if not game:
            await websocket.send_json({"type": "error", "message": "Game not found"})
            return

        # Determine player
        if str(game.host_id) == user_id:
            player = "host"
        elif game.guest_id and str(game.guest_id) == user_id:
            player = "guest"
        else:
            await websocket.send_json({"type": "error", "message": "Not a player"})
            return

        if game.current_turn != player:
            await websocket.send_json({"type": "error", "message": "Not your turn"})
            return

        # Verify ability is active
        ability_active = (
            game.host_ability_active if player == "host" else game.guest_ability_active
        )
        if not ability_active:
            await websocket.send_json(
                {"type": "error", "message": "Ability not active"}
            )
            return

        game_service = CardGameService(db_session, game_id)

        # Play card (removes from hand)
        card, question1 = game_service.play_card(player, card_index)
        if not card or not question1:
            await websocket.send_json({"type": "error", "message": "Invalid card"})
            return

        # Get second question if answers provided
        question2 = None
        if selected_answers2 is not None:
            # Fetch second question from pool
            questions = game_service._get_random_questions(
                game.subjects, game.topics, limit=1
            )
            question2 = questions[0] if questions else question1  # Fallback

        # Resolve with ability logic
        (
            is_first_correct,
            is_second_correct,
            effect_value,
            is_reversed,
        ) = game_service.resolve_answer_with_ability(
            player=player,
            card=card,
            question1=question1,
            selected_answers1=selected_answers1,
            question2=question2,
            selected_answers2=selected_answers2,
        )

        # Broadcast result
        await manager.broadcast(
            game_id_str,
            {
                "type": "card_resolved_with_ability",
                "player": player,
                "card": {
                    "card_key": card["card_key"],
                    "name": card["name"],
                    "card_type": card.get("card_type", ""),
                },
                "is_first_correct": is_first_correct,
                "is_second_correct": is_second_correct,
                "effect_value": effect_value,
                "is_reversed": is_reversed,
                "state": game_service.get_game_state(),
            },
        )

        # Check game over
        winner = game_service.check_game_over()
        if winner:
            await manager.broadcast(
                game_id_str,
                {
                    "type": "game_over",
                    "winner": winner,
                    "end_reason": "health_zero",
                    "state": game_service.get_game_state(),
                },
            )
        else:
            # End turn
            result = game_service.end_turn()
            fatigue_damage = result.get("fatigue_damage", 0)
            next_player = result.get("next_player", "")

            # Broadcast turn end
            await manager.broadcast(
                game_id_str,
                {
                    "type": "turn_end",
                    "fatigue_damage": fatigue_damage,
                    "next_player": next_player,
                    "state": game_service.get_game_state(),
                },
            )

            # Start next turn
            next_hand = game_service.get_player_hand(next_player)
            next_user_id = str(game.host_id if next_player == "host" else game.guest_id)
            await manager.send_to_user(
                game_id_str,
                next_user_id,
                {
                    "type": "turn_start",
                    "current_player": next_player,
                    "turn_number": game.turn_number,
                    "timer_seconds": 60,
                    "hand": next_hand,
                    "state": game_service.get_game_state(),
                },
            )

            # Check game over after fatigue damage
            winner = game_service.check_game_over()
            if winner:
                await manager.broadcast(
                    game_id_str,
                    {
                        "type": "game_over",
                        "winner": winner,
                        "end_reason": "health_zero",
                        "state": game_service.get_game_state(),
                    },
                )
