"""Game service for managing card combat game logic."""

import asyncio
import logging
import random
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.models import CardGameAnswer, CardGameSession, Question
from app.services.card_template_service import CardTemplateService

logger = logging.getLogger(__name__)


class CardGameService:
    """Handles card combat game state and logic."""

    def __init__(self, session: Session, game_id: uuid.UUID) -> None:
        self.session = session
        self.game_id = game_id
        self.current_timer = 30  # seconds per turn

    def get_game(self) -> CardGameSession | None:
        """Get the current game session."""
        return self.session.get(CardGameSession, self.game_id)

    def create_game_deck(
        self,
        subjects: list[str],
        topics: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Build a deck from the default template and assign random questions to each card.

        Args:
            subjects: List of subjects to pull questions from.
            topics: Optional list of topics to filter questions.

        Returns:
            Shuffled deck of card instances with assigned question IDs.
        """
        # Get card templates
        card_service = CardTemplateService(self.session)
        cards = card_service.build_deck_cards()

        # Get available questions
        questions = self._get_random_questions(subjects, topics, len(cards))

        # Assign questions to cards
        for i, card in enumerate(cards):
            if i < len(questions):
                card["question_id"] = str(questions[i].id)
            else:
                # If not enough questions, reuse questions
                card["question_id"] = str(questions[i % len(questions)].id)

        # Shuffle the deck
        random.shuffle(cards)

        logger.info(f"Created deck with {len(cards)} cards")
        if cards:
            logger.info(f"Sample card from deck: {cards[0]}")

        return cards

    def _get_random_questions(
        self,
        subjects: list[str],
        topics: list[str] | None,
        limit: int,
    ) -> list[Question]:
        """Get random questions matching the specified subjects and topics."""
        from app.models import Subject, Topic

        # Get subject IDs
        subject_statement = select(Subject).where(
            Subject.name.in_(subjects)  # type: ignore[attr-defined]
        )
        subject_records = list(self.session.exec(subject_statement).all())
        subject_ids = [s.id for s in subject_records]

        # Build query
        statement = select(Question).where(
            Question.subject_id.in_(subject_ids)  # type: ignore[attr-defined]
        )

        # Filter by topics if specified
        if topics:
            topic_statement = select(Topic).where(
                Topic.name.in_(topics)  # type: ignore[attr-defined]
            )
            topic_records = list(self.session.exec(topic_statement).all())
            topic_ids = [t.id for t in topic_records]
            statement = statement.where(
                Question.topic_id.in_(topic_ids)  # type: ignore[union-attr]
            )

        questions = list(self.session.exec(statement).all())

        # Shuffle and return requested amount
        random.shuffle(questions)
        return questions[:limit] if len(questions) >= limit else questions

    def draw_cards(self, player: str, count: int = 1) -> list[dict[str, Any]]:
        """
        Draw cards from the deck to a player's hand.

        Args:
            player: "host" or "guest"
            count: Number of cards to draw

        Returns:
            List of cards drawn
        """
        game = self.get_game()
        if not game:
            return []

        deck = list(game.deck)
        hand = list(game.host_hand if player == "host" else game.guest_hand)
        drawn: list[dict[str, Any]] = []

        for _ in range(count):
            if not deck:
                break
            card = deck.pop(0)
            hand.append(card)
            drawn.append(card)

        # Update game state
        game.deck = deck
        flag_modified(game, "deck")
        if player == "host":
            game.host_hand = hand
            flag_modified(game, "host_hand")
        else:
            game.guest_hand = hand
            flag_modified(game, "guest_hand")

        self.session.add(game)
        self.session.commit()
        self.session.refresh(game)

        logger.info(f"Drew {len(drawn)} cards for {player}: {drawn}")

        return drawn

    def play_card(
        self,
        player: str,
        card_index: int,
    ) -> tuple[dict[str, Any] | None, Question | None]:
        """
        Play a card from a player's hand.

        Args:
            player: "host" or "guest"
            card_index: Index of the card in player's hand

        Returns:
            Tuple of (card played, question for that card) or (None, None) if invalid
        """
        game = self.get_game()
        if not game:
            return None, None

        hand = list(game.host_hand if player == "host" else game.guest_hand)

        if card_index < 0 or card_index >= len(hand):
            return None, None

        card = hand.pop(card_index)

        # Update hand
        if player == "host":
            game.host_hand = hand
            flag_modified(game, "host_hand")
        else:
            game.guest_hand = hand
            flag_modified(game, "guest_hand")

        self.session.add(game)
        self.session.commit()

        # Get the question for this card
        question_id = uuid.UUID(card["question_id"])
        question = self.session.get(Question, question_id)

        return card, question

    def resolve_answer(
        self,
        player: str,
        card: dict[str, Any],
        question: Question,
        selected_answers: list[int],
    ) -> tuple[bool, int]:
        """
        Resolve a player's answer and apply card effects.

        Args:
            player: "host" or "guest"
            card: The card that was played
            question: The question that was answered
            selected_answers: Player's selected answers

        Returns:
            Tuple of (is_correct, effect_value)
        """
        game = self.get_game()
        if not game:
            return False, 0

        # Check if answer is correct
        # Both selected_answers and correct_answers are indices like [0, 1]
        selected_sorted = sorted(selected_answers)
        correct_sorted = sorted(question.correct_answers)

        logger.info(f"Selected: {selected_sorted}, Correct: {correct_sorted}")

        is_correct = selected_sorted == correct_sorted

        # Get effect value based on correctness
        effect_data = card.get("effect_data", {})
        min_value = effect_data.get("min_value", 1)
        max_value = effect_data.get("max_value", 3)
        effect_value = max_value if is_correct else min_value

        # Apply card effect
        card_type = card.get("card_type", "")
        opponent = "guest" if player == "host" else "host"

        if card_type == "basic_damage":
            self._apply_damage(opponent, effect_value)
        elif card_type == "basic_shield":
            self._apply_shield(player, effect_value)
        elif card_type == "basic_heal":
            self._apply_heal(player, effect_value)

        # Record the answer
        answer = CardGameAnswer(
            game_session_id=self.game_id,
            user_id=game.host_id if player == "host" else game.guest_id,
            question_id=question.id,
            turn_number=game.turn_number,
            card_played=card,
            selected_answers=selected_answers,
            is_correct=is_correct,
            effect_value=effect_value,
        )
        self.session.add(answer)

        # Add card to discard pile
        discard = list(game.discard_pile)
        discard.append(card)
        game.discard_pile = discard

        self.session.add(game)
        self.session.commit()
        self.session.refresh(game)

        return is_correct, effect_value

    def _apply_damage(self, target: str, amount: int) -> None:
        """Apply damage to a player (shield absorbs first)."""
        game = self.get_game()
        if not game:
            return

        if target == "host":
            # Shield absorbs damage first
            if game.host_shield >= amount:
                game.host_shield -= amount
            else:
                remaining = amount - game.host_shield
                game.host_shield = 0
                game.host_health = max(0, game.host_health - remaining)
        else:
            if game.guest_shield >= amount:
                game.guest_shield -= amount
            else:
                remaining = amount - game.guest_shield
                game.guest_shield = 0
                game.guest_health = max(0, game.guest_health - remaining)

        self.session.add(game)

    def _apply_shield(self, player: str, amount: int) -> None:
        """Apply shield to a player."""
        game = self.get_game()
        if not game:
            return

        if player == "host":
            game.host_shield += amount
        else:
            game.guest_shield += amount

        self.session.add(game)

    def _apply_heal(self, player: str, amount: int) -> None:
        """Heal a player (capped at max health)."""
        game = self.get_game()
        if not game:
            return

        if player == "host":
            game.host_health = min(game.max_health, game.host_health + amount)
        else:
            game.guest_health = min(game.max_health, game.guest_health + amount)

        self.session.add(game)

    def end_turn(self) -> dict[str, Any]:
        """
        End the current turn and switch to the next player.

        Returns:
            Dictionary with turn end info including fatigue damage if any.
        """
        game = self.get_game()
        if not game:
            return {"error": "Game not found"}

        result: dict[str, Any] = {
            "fatigue_damage": 0,
            "next_player": "",
            "cards_drawn": [],
        }

        # Switch turns
        next_player = "guest" if game.current_turn == "host" else "host"
        game.current_turn = next_player
        game.turn_number += 1

        # Check if deck is empty - apply fatigue damage
        if not game.deck:
            game.fatigue_damage += 1
            self._apply_damage(next_player, game.fatigue_damage)
            result["fatigue_damage"] = game.fatigue_damage

        self.session.add(game)
        self.session.commit()
        self.session.refresh(game)

        # Draw a card for next player (if deck not empty)
        if game.deck:
            drawn = self.draw_cards(next_player, 1)
            result["cards_drawn"] = drawn

        result["next_player"] = next_player

        return result

    def skip_turn(self) -> dict[str, Any]:
        """
        Skip the current player's turn.

        Returns:
            Turn end result.
        """
        return self.end_turn()

    def check_game_over(self) -> str | None:
        """
        Check if the game is over.

        Returns:
            "host" if host wins, "guest" if guest wins, None if game continues.
        """
        game = self.get_game()
        if not game:
            return None

        if game.host_health <= 0:
            logger.info(
                f"Game {self.game_id} ending: Host health reached 0, Guest wins. "
                f"Host HP: {game.host_health}, Guest HP: {game.guest_health}"
            )
            game.winner = "guest"
            game.status = "completed"
            game.end_reason = "health_zero"
            game.completed_at = datetime.utcnow()
            self.session.add(game)
            self.session.commit()
            self.session.refresh(game)
            logger.info(
                f"Game {self.game_id} marked as completed: "
                f"status={game.status}, winner={game.winner}, end_reason={game.end_reason}"
            )
            return "guest"

        if game.guest_health <= 0:
            logger.info(
                f"Game {self.game_id} ending: Guest health reached 0, Host wins. "
                f"Host HP: {game.host_health}, Guest HP: {game.guest_health}"
            )
            game.winner = "host"
            game.status = "completed"
            game.end_reason = "health_zero"
            game.completed_at = datetime.utcnow()
            self.session.add(game)
            self.session.commit()
            self.session.refresh(game)
            logger.info(
                f"Game {self.game_id} marked as completed: "
                f"status={game.status}, winner={game.winner}, end_reason={game.end_reason}"
            )
            return "host"

        return None

    def forfeit_game(self, player: str) -> str:
        """
        Mark the game as forfeited by a player.

        Args:
            player: "host" or "guest" - the player who is forfeiting

        Returns:
            Winner ("host" or "guest") - the opposite of the forfeiting player
        """
        game = self.get_game()
        if not game:
            raise ValueError("Game not found")

        if game.status != "in_progress":
            raise ValueError("Can only forfeit an in-progress game")

        # Determine winner (opposite of forfeiter)
        winner = "guest" if player == "host" else "host"

        logger.info(
            f"Game {self.game_id} being forfeited by {player}. "
            f"Current status: {game.status}, Winner will be: {winner}"
        )

        # Update game state
        game.winner = winner
        game.status = "completed"
        game.end_reason = "forfeit"
        game.completed_at = datetime.utcnow()

        self.session.add(game)
        self.session.commit()
        self.session.refresh(game)

        logger.info(
            f"Game {self.game_id} marked as completed after forfeit: "
            f"status={game.status}, winner={game.winner}, end_reason={game.end_reason}"
        )

        return winner

    def get_game_state(self) -> dict[str, Any]:
        """
        Get the current game state for broadcasting.

        Returns:
            Dictionary with all relevant game state information.
        """
        game = self.get_game()
        if not game:
            return {}

        host_name = "Host"
        guest_name = "Guest"
        if game.host:
            host_name = game.host.full_name or game.host.email
        if game.guest:
            guest_name = game.guest.full_name or game.guest.email

        return {
            "game_id": str(game.id),
            "status": game.status,
            "host": {
                "id": str(game.host_id),
                "name": host_name,
                "health": game.host_health,
                "shield": game.host_shield,
                "hand_count": len(game.host_hand),
                "is_current_turn": game.current_turn == "host",
            },
            "guest": {
                "id": str(game.guest_id) if game.guest_id else None,
                "name": guest_name if game.guest_id else None,
                "health": game.guest_health,
                "shield": game.guest_shield,
                "hand_count": len(game.guest_hand),
                "is_current_turn": game.current_turn == "guest",
            }
            if game.guest_id
            else None,
            "deck_count": len(game.deck),
            "turn_number": game.turn_number,
            "fatigue_damage": game.fatigue_damage,
            "current_turn": game.current_turn,
            "winner": game.winner,
        }

    def get_player_hand(self, player: str) -> list[dict[str, Any]]:
        """
        Get a player's hand with question IDs for fetching questions.

        Args:
            player: "host" or "guest"

        Returns:
            List of cards in the player's hand.
        """
        game = self.get_game()
        if not game:
            return []

        hand = game.host_hand if player == "host" else game.guest_hand
        return [
            {
                "card_key": card["card_key"],
                "name": card["name"],
                "description": card.get("description"),
                "card_type": card["card_type"],
                "effect_data": card["effect_data"],
                "question_id": card.get("question_id"),
            }
            for card in hand
        ]

    async def start_game_flow(self, broadcast_fn: Any) -> None:
        """
        Start the card game flow with turn management.

        Args:
            broadcast_fn: Async function to broadcast messages to all players.
        """
        game = self.get_game()
        if not game:
            return

        # Update status to in_progress
        game.status = "in_progress"
        self.session.add(game)
        self.session.commit()
        self.session.refresh(game)

        # Broadcast game start with initial state
        await broadcast_fn(
            {
                "type": "game_start",
                "game_id": str(self.game_id),
                "state": self.get_game_state(),
            }
        )

        # Game loop - turns are handled via WebSocket events
        # We just need to set up the initial turn
        await self._start_turn(broadcast_fn)

    async def _start_turn(self, broadcast_fn: Any) -> None:
        """Start a new turn with timer."""
        game = self.get_game()
        if not game or game.status != "in_progress":
            return

        # Check for game over
        winner = self.check_game_over()
        if winner:
            await self._end_game(broadcast_fn, winner)
            return

        # Get current player's hand
        current_player = game.current_turn
        hand = self.get_player_hand(current_player)

        # Broadcast turn start
        await broadcast_fn(
            {
                "type": "turn_start",
                "current_player": current_player,
                "turn_number": game.turn_number,
                "timer_seconds": 30,
                "hand": hand,
                "state": self.get_game_state(),
            }
        )

        # Start turn timer
        self.current_timer = 30
        await self._run_turn_timer(broadcast_fn)

    async def _run_turn_timer(self, broadcast_fn: Any) -> None:
        """Run the turn timer, auto-skip if time runs out."""
        game = self.get_game()
        initial_turn = game.turn_number if game else -1

        while self.current_timer > 0:
            await asyncio.sleep(1)
            self.current_timer -= 1

            # Refresh game to check if turn ended
            game = self.get_game()
            if not game or game.status != "in_progress":
                return
            if game.turn_number != initial_turn:
                # Turn was already ended (card was played)
                return

            # Broadcast timer updates
            if self.current_timer % 5 == 0 or self.current_timer <= 10:
                await broadcast_fn(
                    {
                        "type": "timer_update",
                        "seconds_remaining": self.current_timer,
                    }
                )

        # Timer expired - auto skip turn
        game = self.get_game()
        if game and game.status == "in_progress" and game.turn_number == initial_turn:
            await self._handle_turn_skip(broadcast_fn)

    async def _handle_turn_skip(self, broadcast_fn: Any) -> None:
        """Handle a skipped turn (timeout or manual skip)."""
        result = self.skip_turn()

        await broadcast_fn(
            {
                "type": "turn_skipped",
                "fatigue_damage": result.get("fatigue_damage", 0),
                "state": self.get_game_state(),
            }
        )

        # Check for game over after fatigue damage
        winner = self.check_game_over()
        if winner:
            await self._end_game(broadcast_fn, winner)
        else:
            # Start next turn
            await self._start_turn(broadcast_fn)

    async def _end_game(self, broadcast_fn: Any, winner: str) -> None:
        """End the game and broadcast results."""
        game = self.get_game()
        if not game:
            return

        await broadcast_fn(
            {
                "type": "game_over",
                "winner": winner,
                "state": self.get_game_state(),
            }
        )
