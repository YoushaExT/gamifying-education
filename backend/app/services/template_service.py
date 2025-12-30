"""Template service for loading and managing question templates."""

import json
import logging
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.models import QuestionTemplate

logger = logging.getLogger(__name__)


class TemplateService:
    """Service for managing question templates."""

    def __init__(self, session: Session):
        """Initialize template service.

        Args:
            session: Database session
        """
        self.session = session
        self.template_dir = Path(__file__).parent.parent / "question_templates"

    async def get_template(self, template_id: str) -> QuestionTemplate | None:
        """Get a specific template by ID.

        Args:
            template_id: UUID of the template

        Returns:
            QuestionTemplate or None if not found
        """
        statement = select(QuestionTemplate).where(QuestionTemplate.id == template_id)
        result = self.session.exec(statement)
        return result.first()

    async def list_templates(
        self,
        subject: str | None = None,
        difficulty: str | None = None,
        is_active: bool = True,
    ) -> list[QuestionTemplate]:
        """List templates with optional filters.

        Args:
            subject: Filter by subject
            difficulty: Filter by difficulty
            is_active: Filter by active status

        Returns:
            List of templates
        """
        statement = select(QuestionTemplate).where(
            QuestionTemplate.is_active == is_active
        )

        if subject:
            statement = statement.where(QuestionTemplate.subject == subject)
        if difficulty:
            statement = statement.where(QuestionTemplate.difficulty == difficulty)

        result = self.session.exec(statement)
        db_templates = result.all()

        # Also load file-based templates
        _file_templates = await self.load_default_templates()

        # Merge templates (DB templates override file templates with same subject/topic/difficulty)
        all_templates = list(db_templates)

        # TODO: Implement merging logic for file-based templates
        # For now, just return DB templates

        return all_templates

    async def load_default_templates(self) -> list[dict[str, Any]]:
        """Load default templates from JSON files.

        Returns:
            List of template dictionaries
        """
        templates: list[dict[str, Any]] = []

        if not self.template_dir.exists():
            logger.warning(f"Template directory not found: {self.template_dir}")
            return templates

        try:
            for template_file in self.template_dir.glob("*.json"):
                try:
                    with open(template_file) as f:
                        template_data = json.load(f)
                        templates.append(template_data)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse template file {template_file}: {e}")
                except Exception as e:
                    logger.error(f"Failed to load template file {template_file}: {e}")

        except Exception as e:
            logger.error(f"Failed to load default templates: {e}")

        return templates

    async def render_prompt(self, template: QuestionTemplate, **kwargs: Any) -> str:
        """Render template prompt with variable substitution.

        Args:
            template: Template to render
            **kwargs: Variables to substitute (e.g., num_questions=5)

        Returns:
            Rendered prompt string
        """
        prompt = template.template_prompt

        # Add default values
        substitutions = {
            "subject": template.subject,
            "topic": template.topic or template.subject,
            "difficulty": template.difficulty,
            **kwargs,
        }

        # Substitute variables
        for key, value in substitutions.items():
            placeholder = f"{{{key}}}"
            prompt = prompt.replace(placeholder, str(value))

        # Add example questions if present
        if template.example_questions:
            examples_text = "\n\nExample questions:\n"
            for i, example in enumerate(template.example_questions, 1):
                examples_text += f"\nExample {i}:\n"
                examples_text += f"Question: {example.get('question_text', '')}\n"
                examples_text += f"Choices: {', '.join(example.get('choices', []))}\n"
                examples_text += (
                    f"Correct: {', '.join(example.get('correct_answers', []))}\n"
                )
                if "explanation" in example:
                    examples_text += f"Explanation: {example['explanation']}\n"

            prompt += examples_text

        return prompt

    async def validate_template(
        self, template_data: dict[str, Any]
    ) -> tuple[bool, list[str]]:
        """Validate template structure.

        Args:
            template_data: Template dictionary to validate

        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []

        # Check required fields
        required_fields = [
            "subject",
            "difficulty",
            "template_prompt",
            "example_questions",
        ]
        for field in required_fields:
            if field not in template_data:
                errors.append(f"Missing required field: {field}")

        # Validate difficulty
        if "difficulty" in template_data:
            valid_difficulties = ["easy", "medium", "hard"]
            if template_data["difficulty"] not in valid_difficulties:
                errors.append(
                    f"Invalid difficulty: {template_data['difficulty']}. "
                    f"Must be one of: {', '.join(valid_difficulties)}"
                )

        # Validate example questions
        if "example_questions" in template_data:
            if not isinstance(template_data["example_questions"], list):
                errors.append("example_questions must be a list")
            else:
                for i, example in enumerate(template_data["example_questions"]):
                    if not isinstance(example, dict):
                        errors.append(f"Example question {i} must be a dictionary")
                        continue

                    example_required = ["question_text", "choices", "correct_answers"]
                    for field in example_required:
                        if field not in example:
                            errors.append(
                                f"Example question {i} missing field: {field}"
                            )

        return len(errors) == 0, errors
