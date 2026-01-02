#!/usr/bin/env python3
"""One-time script to reset card templates for balance update.

This script deletes all existing card and deck templates from the database,
allowing them to be reseeded from the updated YAML file on next backend startup.

Usage:
    python backend/scripts/reset_card_templates.py
"""

from sqlmodel import Session, delete

from app.core.db import engine
from app.models import CardTemplate, DeckTemplate


def reset_templates() -> None:
    """Delete all card and deck templates from the database."""
    with Session(engine) as session:
        # Delete all deck templates first (foreign key dependency)
        result_decks = session.exec(delete(DeckTemplate))
        deleted_decks = result_decks.rowcount  # type: ignore[attr-defined]

        # Then delete card templates
        result_cards = session.exec(delete(CardTemplate))
        deleted_cards = result_cards.rowcount  # type: ignore[attr-defined]

        session.commit()

        print("✓ Card templates reset successfully")  # noqa: T201
        print(f"  - Deleted {deleted_decks} deck template(s)")  # noqa: T201
        print(f"  - Deleted {deleted_cards} card template(s)")  # noqa: T201
        print(  # noqa: T201
            "\n  Next backend startup will reseed from YAML with updated balance values"
        )


if __name__ == "__main__":
    print("Resetting card templates for balance update...")  # noqa: T201
    print("This will delete all existing card and deck templates.")  # noqa: T201
    print()  # noqa: T201

    reset_templates()
