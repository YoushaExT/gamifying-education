"""Template service for loading and managing question templates."""

import json
import logging
import uuid
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.models import QuestionTemplate, QuestionTemplateCreate
from app.services.openai_provider import OpenAIProvider

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

    async def get_or_create_dynamic_template(
        self,
        subject: str,
        topic: str | None,
        difficulty: str,
        user_id: uuid.UUID,
    ) -> QuestionTemplate:
        """Get existing template or create dynamic one with LLM-generated diverse examples.

        This method enables question generation for new subjects/topics without
        hardcoded template files. It uses the LLM to generate 4 diverse example
        questions if no template exists.

        Args:
            subject: Subject name (e.g., "JavaScript")
            topic: Topic name (e.g., "Scope") or None
            difficulty: Difficulty level ("easy" or "hard")
            user_id: UUID of the user creating the template

        Returns:
            QuestionTemplate (existing or newly created)
        """
        # Try to find existing template
        templates = await self.list_templates(
            subject=subject, difficulty=difficulty, is_active=True
        )
        if topic:
            matching = [t for t in templates if t.topic == topic]
            if matching:
                logger.info(
                    f"Found existing template for {subject}/{topic}/{difficulty}"
                )
                return matching[0]
        elif templates:
            logger.info(f"Found existing template for {subject}/{difficulty}")
            return templates[0]

        # No template found - generate dynamic one with LLM
        logger.info(
            f"Creating dynamic template for {subject}/{topic}/{difficulty} "
            f"with LLM-generated diverse examples"
        )

        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY not configured for dynamic template generation"
            )

        provider = OpenAIProvider(
            api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_MODEL
        )

        # Build diversity prompt for generating 4 diverse example questions
        topic_display = topic or "General"
        diversity_prompt = f"""
Generate 4 diverse example questions for {subject} - {topic_display} at {difficulty} level.

CRITICAL REQUIREMENTS:
1. DO NOT include "A.", "B.", "C.", "D." labels in choices - use plain text only
2. Indicate correct answers by INDEX (0, 1, 2, or 3) not letters
3. Format question_text as HTML with <p> tags and <pre><code class="language-xxx"> for code
4. Create DIVERSE question types:
   - 1 output-based (show code, ask for output)
   - 1 conceptual (definitions, explanations, principles)
   - 1 error identification (what error occurs, why doesn't it work)
   - 1 practical application (how to solve a problem, best practice)

Return as JSON array with structure:
{{
  "questions": [
    {{
      "question_text": "HTML with <pre><code> for code",
      "choices": ["plain text 1", "plain text 2", "plain text 3", "plain text 4"],
      "correct_answers": [0],
      "difficulty": "{difficulty}",
      "question_type": "mcq",
      "subject": "{subject}",
      "topic": "{topic_display}",
      "explanation": "Brief explanation why the answer is correct"
    }}
  ]
}}

Notes:
- Use "mcq" for single correct answer, "multiselect" for 2+ correct answers
- For multiselect questions, correct_answers should be array of indices like [0, 2]
- DO NOT generate images
- Each question should test different aspects of {topic_display}
"""

        try:
            # Generate diverse examples using LLM
            examples = await provider.generate_questions(
                prompt=diversity_prompt,
                num_questions=4,
                temperature=0.8,  # Higher temperature for more diversity
                subject=subject,
                topic=topic,
            )

            # Validate examples have required fields
            validated_examples = []
            for example in examples:
                # Ensure all required fields are present
                if not all(
                    key in example
                    for key in [
                        "question_text",
                        "choices",
                        "correct_answers",
                        "difficulty",
                        "question_type",
                    ]
                ):
                    logger.warning(f"Skipping invalid example: {example}")
                    continue

                validated_examples.append(example)

            if len(validated_examples) < 2:
                raise ValueError(
                    f"Failed to generate sufficient valid examples. "
                    f"Got {len(validated_examples)}, need at least 2"
                )

            # Create template with generated examples
            template_prompt = (
                f"Generate a {difficulty} question about {{topic}} in {{subject}}. "
                f"DO NOT include A/B/C/D labels in choices. Use plain text for choices. "
                f"Return correct_answers as indices (0-3). Format question_text as HTML "
                f"with <pre><code> for code snippets. Set difficulty to '{difficulty}' and "
                f"question_type to 'mcq' for single answer or 'multiselect' for 2+ answers."
            )

            template_in = QuestionTemplateCreate(
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                template_prompt=template_prompt,
                example_questions=validated_examples,
                constraints={
                    "require_diverse_types": True,
                    "no_labels_in_choices": True,
                    "use_index_for_answers": True,
                    "dynamically_generated": True,
                },
                is_active=True,
            )

            # Save template to database
            db_template = crud.create_question_template(
                session=self.session, template_in=template_in, creator_id=user_id
            )

            logger.info(
                f"Created dynamic template {db_template.id} for "
                f"{subject}/{topic}/{difficulty} with {len(validated_examples)} examples"
            )

            return db_template

        except Exception as e:
            logger.error(
                f"Failed to create dynamic template for {subject}/{topic}/{difficulty}: {e}",
                exc_info=True,
            )

            # Create minimal fallback template if LLM generation fails
            logger.warning("Creating minimal fallback template without LLM examples")

            fallback_template_in = QuestionTemplateCreate(
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                template_prompt=(
                    f"Generate a {difficulty} multiple-choice question about "
                    f"{{topic}} in {{subject}}. Use plain text choices without A/B/C/D labels. "
                    f"Return correct_answers as indices (0-3)."
                ),
                example_questions=[],  # No examples
                constraints={
                    "no_labels_in_choices": True,
                    "use_index_for_answers": True,
                },
                is_active=True,
            )

            return crud.create_question_template(
                session=self.session,
                template_in=fallback_template_in,
                creator_id=user_id,
            )

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
            valid_difficulties = ["easy", "hard"]
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
