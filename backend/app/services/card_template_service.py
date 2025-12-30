"""Card Template Service for loading and managing card templates from YAML."""

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from sqlmodel import Session, select

from app.models import CardTemplate, DeckTemplate

logger = logging.getLogger(__name__)

# Default path to the YAML template file
DEFAULT_TEMPLATE_PATH = (
    Path(__file__).parent.parent / "card_templates" / "default_deck.yml"
)


class CardTemplateService:
    """Service for managing card templates and deck compositions."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def load_from_yaml(self, path: Path | None = None) -> dict[str, Any]:
        """
        Load card and deck definitions from a YAML file.

        Args:
            path: Path to the YAML file. Defaults to default_deck.yml.

        Returns:
            Dictionary containing 'cards' and 'deck' data.
        """
        yaml_path = path or DEFAULT_TEMPLATE_PATH

        if not yaml_path.exists():
            raise FileNotFoundError(f"Card template file not found: {yaml_path}")

        with open(yaml_path) as f:
            data: dict[str, Any] = yaml.safe_load(f)

        return data

    def seed_if_empty(self, path: Path | None = None) -> bool:
        """
        Load cards and deck from YAML into database only if CardTemplate table is empty.

        Args:
            path: Path to the YAML file. Defaults to default_deck.yml.

        Returns:
            True if seeding was performed, False if tables already had data.
        """
        # Check if CardTemplate table has any entries
        existing_cards = self.session.exec(select(CardTemplate).limit(1)).first()
        if existing_cards:
            logger.info("CardTemplate table already has data, skipping seed")
            return False

        return self._seed_from_yaml(path)

    def reload_from_yaml(self, path: Path | None = None) -> bool:
        """
        Clear existing cards/decks and reload from YAML.
        Use this during development to refresh card definitions.

        Args:
            path: Path to the YAML file. Defaults to default_deck.yml.

        Returns:
            True if reload was successful.
        """
        logger.info("Clearing existing card templates and deck templates...")

        # Delete all existing deck templates
        existing_decks = self.session.exec(select(DeckTemplate)).all()
        for deck in existing_decks:
            self.session.delete(deck)

        # Delete all existing card templates
        existing_cards = self.session.exec(select(CardTemplate)).all()
        for card in existing_cards:
            self.session.delete(card)

        self.session.commit()
        logger.info("Cleared existing templates")

        return self._seed_from_yaml(path)

    def _seed_from_yaml(self, path: Path | None = None) -> bool:
        """
        Internal method to seed cards and deck from YAML.

        Args:
            path: Path to the YAML file.

        Returns:
            True if seeding was successful.
        """
        data = self.load_from_yaml(path)

        # Create CardTemplate entries
        cards_data = data.get("cards", [])
        logger.info(f"Seeding {len(cards_data)} card templates...")

        for card_data in cards_data:
            card = CardTemplate(
                card_key=card_data["key"],
                name=card_data["name"],
                description=card_data.get("description"),
                card_type=card_data["type"],
                effect_data=card_data["effect"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.session.add(card)

        # Create DeckTemplate entry
        deck_data = data.get("deck", {})
        if deck_data:
            logger.info(f"Seeding deck template: {deck_data.get('name', 'default')}")

            deck = DeckTemplate(
                name=deck_data.get("name", "default"),
                is_default=deck_data.get("is_default", True),
                card_entries=deck_data.get("composition", []),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            self.session.add(deck)

        self.session.commit()
        logger.info("Card template seeding complete")
        return True

    def get_default_deck(self) -> DeckTemplate | None:
        """
        Get the default deck template.

        Returns:
            The default DeckTemplate or None if not found.
        """
        statement = select(DeckTemplate).where(DeckTemplate.is_default == True)  # noqa: E712
        return self.session.exec(statement).first()

    def get_deck_by_name(self, name: str) -> DeckTemplate | None:
        """
        Get a deck template by name.

        Args:
            name: Name of the deck template.

        Returns:
            The DeckTemplate or None if not found.
        """
        statement = select(DeckTemplate).where(DeckTemplate.name == name)
        return self.session.exec(statement).first()

    def get_card_by_key(self, card_key: str) -> CardTemplate | None:
        """
        Get a card template by its key.

        Args:
            card_key: The unique card key (e.g., "fireball").

        Returns:
            The CardTemplate or None if not found.
        """
        statement = select(CardTemplate).where(CardTemplate.card_key == card_key)
        return self.session.exec(statement).first()

    def get_all_cards(self) -> list[CardTemplate]:
        """
        Get all card templates.

        Returns:
            List of all CardTemplate entries.
        """
        statement = select(CardTemplate)
        return list(self.session.exec(statement).all())

    def build_deck_cards(
        self, deck_template: DeckTemplate | None = None
    ) -> list[dict[str, Any]]:
        """
        Build a list of card instances from a deck template.
        This creates the actual deck with expanded cards based on count.

        Args:
            deck_template: The deck template to use. If None, uses default deck.

        Returns:
            List of card dictionaries ready to be used in a game.
        """
        if deck_template is None:
            deck_template = self.get_default_deck()

        if deck_template is None:
            raise ValueError("No deck template found")

        cards: list[dict[str, Any]] = []
        card_entries = deck_template.card_entries

        for entry in card_entries:
            card_key = entry.get("card_key")
            count = entry.get("count", 1)

            if not card_key:
                logger.warning("Card entry missing card_key")
                continue

            card_template = self.get_card_by_key(card_key)
            if card_template is None:
                logger.warning(f"Card template not found for key: {card_key}")
                continue

            # Create 'count' copies of this card
            for _ in range(count):
                cards.append(
                    {
                        "card_key": card_template.card_key,
                        "name": card_template.name,
                        "description": card_template.description,
                        "card_type": card_template.card_type,
                        "effect_data": card_template.effect_data,
                    }
                )

        return cards
