"""add difficulty and question_type fields with data migration

Revision ID: 0a3b9785f837
Revises: 48fdc374cfb5
Create Date: 2026-01-01 20:09:41.631465

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.sql import text
import json
import re


# revision identifiers, used by Alembic.
revision = '0a3b9785f837'
down_revision = '48fdc374cfb5'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns with defaults
    op.add_column('question', sa.Column('difficulty', sa.String(length=20), nullable=False, server_default='easy'))
    op.add_column('question', sa.Column('question_type', sa.String(length=20), nullable=False, server_default='mcq'))

    # Migrate existing data
    connection = op.get_bind()

    # Get all questions
    questions = connection.execute(text("SELECT id, choices, correct_answers FROM question")).fetchall()

    letter_map = {"A": 0, "B": 1, "C": 2, "D": 3}

    for question_id, choices_json, correct_answers_json in questions:
        # Parse JSON
        choices = json.loads(choices_json) if isinstance(choices_json, str) else choices_json
        correct_answers = json.loads(correct_answers_json) if isinstance(correct_answers_json, str) else correct_answers_json

        # Strip "A. ", "B. ", "C. ", "D. " labels from choices
        new_choices = []
        for choice in choices:
            # Remove letter labels at the start (e.g., "A. Text" -> "Text")
            cleaned = re.sub(r'^[A-D]\.\s*', '', choice)
            new_choices.append(cleaned)

        # Convert correct_answers from letters to indices
        new_correct_answers = []
        for letter in correct_answers:
            if letter in letter_map:
                new_correct_answers.append(letter_map[letter])
            else:
                # If letter not found, try to parse as index (shouldn't happen but defensive)
                try:
                    new_correct_answers.append(int(letter))
                except:
                    new_correct_answers.append(0)  # Fallback to first choice

        # Determine question_type based on correct_answers count
        question_type = "mcq" if len(new_correct_answers) == 1 else "multiselect"

        # Update the question
        connection.execute(
            text("""
                UPDATE question
                SET choices = :choices,
                    correct_answers = :correct_answers,
                    question_type = :question_type
                WHERE id = :id
            """),
            {
                "choices": json.dumps(new_choices),
                "correct_answers": json.dumps(new_correct_answers),
                "question_type": question_type,
                "id": str(question_id)
            }
        )

    connection.commit()

    # Remove server defaults after data migration
    op.alter_column('question', 'difficulty', server_default=None)
    op.alter_column('question', 'question_type', server_default=None)


def downgrade():
    # Reverse the data migration
    connection = op.get_bind()

    # Get all questions
    questions = connection.execute(text("SELECT id, choices, correct_answers FROM question")).fetchall()

    index_to_letter = {0: "A", 1: "B", 2: "C", 3: "D"}

    for question_id, choices_json, correct_answers_json in questions:
        # Parse JSON
        choices = json.loads(choices_json) if isinstance(choices_json, str) else choices_json
        correct_answers = json.loads(correct_answers_json) if isinstance(correct_answers_json, str) else correct_answers_json

        # Add "A. ", "B. " labels back to choices
        labeled_choices = []
        for i, choice in enumerate(choices):
            letter = index_to_letter.get(i, chr(65 + i))  # A, B, C, D
            labeled_choices.append(f"{letter}. {choice}")

        # Convert correct_answers from indices to letters
        letter_answers = []
        for index in correct_answers:
            if isinstance(index, int) and index in index_to_letter:
                letter_answers.append(index_to_letter[index])
            else:
                # Fallback
                try:
                    idx = int(index)
                    letter_answers.append(index_to_letter.get(idx, "A"))
                except:
                    letter_answers.append("A")

        # Update the question
        connection.execute(
            text("""
                UPDATE question
                SET choices = :choices,
                    correct_answers = :correct_answers
                WHERE id = :id
            """),
            {
                "choices": json.dumps(labeled_choices),
                "correct_answers": json.dumps(letter_answers),
                "id": str(question_id)
            }
        )

    connection.commit()

    # Drop the new columns
    op.drop_column('question', 'question_type')
    op.drop_column('question', 'difficulty')
