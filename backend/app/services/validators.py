"""Validation services for question generation."""

import logging
from dataclasses import dataclass
from typing import Any

import bleach  # type: ignore[import-untyped]
from bs4 import BeautifulSoup
from pydantic import ValidationError

from app.models import QuestionCreate, QuestionTemplate
from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of a validation operation."""

    passed: bool
    errors: list[str]
    warnings: list[str] | None = None
    score: int | None = None
    feedback: str | None = None
    details: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        if self.warnings is None:
            self.warnings = []
        if self.details is None:
            self.details = {}


class FormatValidator:
    """Validates question format and structure."""

    ALLOWED_TAGS = [
        "p",
        "strong",
        "em",
        "code",
        "pre",
        "br",
        "ul",
        "ol",
        "li",
        "span",
        "div",
    ]

    ALLOWED_ATTRIBUTES = {
        "code": ["class"],  # For language-* classes
        "span": ["class", "data-math"],  # For math equations
        "div": ["class"],
        "pre": [],
        "p": [],
        "strong": [],
        "em": [],
        "ul": [],
        "ol": [],
        "li": [],
        "br": [],
    }

    def validate(self, question: dict[str, Any]) -> ValidationResult:
        """Run all format validations.

        Args:
            question: Question dictionary to validate

        Returns:
            ValidationResult with passed status and any errors
        """
        errors = []

        # 1. Validate against Pydantic schema
        try:
            QuestionCreate(**question)
        except ValidationError as e:
            errors.append(f"Schema validation failed: {str(e)}")

        # 2. Validate HTML if present
        if self._contains_html(question.get("question_text", "")):
            html_errors = self._validate_html(question["question_text"])
            errors.extend(html_errors)

        # 3. Validate choices
        choice_errors = self._validate_choices(question.get("choices", []))
        errors.extend(choice_errors)

        # 4. Validate correct_answers
        answer_errors = self._validate_answers(
            question.get("correct_answers", []), question.get("choices", [])
        )
        errors.extend(answer_errors)

        # 5. Check for empty/malformed fields
        field_errors = self._validate_fields(question)
        errors.extend(field_errors)

        # 6. Validate question_type consistency
        type_errors = self._validate_question_type_consistency(question)
        errors.extend(type_errors)

        return ValidationResult(passed=len(errors) == 0, errors=errors, warnings=[])

    def _contains_html(self, text: str) -> bool:
        """Check if text contains HTML tags."""
        return bool(text and ("<" in text and ">" in text))

    def _validate_html(self, html: str) -> list[str]:
        """Validate HTML structure and safety.

        Args:
            html: HTML string to validate

        Returns:
            List of error messages
        """
        errors = []

        try:
            # Parse HTML
            soup = BeautifulSoup(html, "html5lib")

            # Check for disallowed tags
            for tag in soup.find_all():
                if tag.name not in self.ALLOWED_TAGS:
                    errors.append(f"Disallowed HTML tag: {tag.name}")

            # Validate code blocks
            code_blocks = soup.find_all("pre")
            for block in code_blocks:
                code = block.find("code")
                if not code:
                    errors.append("Code block missing <code> tag")
                elif not code.get("class"):
                    errors.append("Code block missing language class")

            # Sanitize HTML
            clean_html = bleach.clean(
                html,
                tags=self.ALLOWED_TAGS,
                attributes=self.ALLOWED_ATTRIBUTES,
                strip=True,
            )

            if clean_html != html:
                # Check if the difference is significant (not just whitespace)
                if clean_html.replace(" ", "") != html.replace(" ", ""):
                    errors.append("HTML contains potentially unsafe content")

        except Exception as e:
            errors.append(f"HTML parsing error: {str(e)}")

        return errors

    def _validate_choices(self, choices: list[str]) -> list[str]:
        """Validate choices array.

        Args:
            choices: List of answer choices (plain text, no labels)

        Returns:
            List of error messages
        """
        errors = []

        if len(choices) != 4:
            errors.append(f"Expected 4 choices, got {len(choices)}")

        # Check for empty choices
        for i, choice in enumerate(choices):
            if not choice or not choice.strip():
                errors.append(f"Choice {i} is empty")
            # Check if choice starts with letter label (should not)
            if choice.strip() and choice.strip()[0:2] in ["A.", "B.", "C.", "D."]:
                errors.append(
                    f"Choice {i} should not start with letter label (A., B., C., D.). Use plain text only."
                )

        # Check for duplicates
        if len(choices) != len(set(choices)):
            errors.append("Duplicate choices found")

        return errors

    def _validate_answers(
        self, correct_answers: list[int], choices: list[str]
    ) -> list[str]:
        """Validate correct answers.

        Args:
            correct_answers: List of correct answer indices (0-3)
            choices: List of all choices

        Returns:
            List of error messages
        """
        errors = []

        if not correct_answers:
            errors.append("No correct answers provided")
            return errors

        # Validate indices are integers in valid range
        valid_indices = [0, 1, 2, 3]
        for answer in correct_answers:
            if not isinstance(answer, int):
                errors.append(
                    f"Invalid answer type: {answer}. Must be integer index (0-3)."
                )
            elif answer not in valid_indices:
                errors.append(f"Invalid answer index: {answer}. Must be 0, 1, 2, or 3.")

        # Check for duplicates
        if len(correct_answers) != len(set(correct_answers)):
            errors.append("Duplicate correct answers")

        return errors

    def _validate_fields(self, question: dict[str, Any]) -> list[str]:
        """Validate required fields are present and non-empty.

        Args:
            question: Question dictionary

        Returns:
            List of error messages
        """
        errors = []

        required_fields = [
            "question_text",
            "choices",
            "correct_answers",
            "subject",
            "difficulty",
            "question_type",
        ]

        for field in required_fields:
            if field not in question:
                errors.append(f"Missing required field: {field}")
            elif not question[field]:
                errors.append(f"Empty required field: {field}")

        return errors

    def _validate_question_type_consistency(
        self, question: dict[str, Any]
    ) -> list[str]:
        """Validate question_type is consistent with correct_answers.

        Args:
            question: Question dictionary

        Returns:
            List of error messages
        """
        errors = []

        question_type = question.get("question_type", "mcq")
        correct_answers = question.get("correct_answers", [])

        # Validate question_type is valid
        if question_type not in ["mcq", "multiselect"]:
            errors.append(
                f"Invalid question_type: {question_type}. Must be 'mcq' or 'multiselect'."
            )
            return errors

        # Validate consistency
        if question_type == "mcq" and len(correct_answers) != 1:
            errors.append("MCQ questions must have exactly 1 correct answer")
        elif question_type == "multiselect" and len(correct_answers) < 2:
            errors.append("Multiselect questions must have at least 2 correct answers")

        # Validate difficulty
        difficulty = question.get("difficulty", "easy")
        if difficulty not in ["easy", "hard"]:
            errors.append(
                f"Invalid difficulty: {difficulty}. Must be 'easy' or 'hard'."
            )

        return errors


class ContentValidator:
    """Validates question content quality using LLM."""

    def __init__(self, provider: LLMProvider, threshold: int = 70):
        """Initialize content validator.

        Args:
            provider: LLM provider for validation
            threshold: Minimum score to pass (0-100)
        """
        self.provider = provider
        self.threshold = threshold

    async def validate(
        self, question: dict[str, Any], template: QuestionTemplate
    ) -> ValidationResult:
        """Validate content quality using LLM.

        Args:
            question: Question dictionary to validate
            template: Template used for generation

        Returns:
            ValidationResult with score and feedback
        """
        validation_prompt = f"""
Evaluate the following multiple-choice question based on these criteria:

1. Relevance: Does it accurately test {template.subject} - {template.topic}?
2. Correctness: Are the correct answers actually correct?
3. Clarity: Is the question clear and unambiguous?
4. Difficulty: Is it appropriate for {template.difficulty} level?
5. Distractors: Are wrong answers plausible but clearly incorrect?

Question:
{question['question_text']}

Choices:
{chr(10).join(question['choices'])}

Correct Answer(s): {', '.join(question['correct_answers'])}

Provide a score (0-100) for each criterion and overall, plus feedback.
Return as JSON: {{"overall_score": 85, "criteria_scores": {{"relevance": 90, "correctness": 85, "clarity": 80, "difficulty": 85, "distractors": 85}}, "feedback": "Detailed feedback here"}}
"""

        try:
            result = await self.provider.validate_content(
                question=question, criteria={"prompt": validation_prompt}
            )

            passed = result["overall_score"] >= self.threshold
            errors = (
                []
                if passed
                else [
                    f"Quality score {result['overall_score']} below threshold {self.threshold}"
                ]
            )

            return ValidationResult(
                passed=passed,
                errors=errors,
                warnings=[],
                score=result["overall_score"],
                feedback=result.get("feedback", ""),
                details=result.get("criteria_scores", {}),
            )

        except Exception as e:
            logger.error(f"Content validation failed: {e}", exc_info=True)
            return ValidationResult(
                passed=False,
                errors=[f"Content validation error: {str(e)}"],
                warnings=[],
                score=0,
            )


class QuestionValidator:
    """Orchestrates format and content validation."""

    def __init__(
        self, format_validator: FormatValidator, content_validator: ContentValidator
    ):
        """Initialize question validator.

        Args:
            format_validator: Format validator instance
            content_validator: Content validator instance
        """
        self.format_validator = format_validator
        self.content_validator = content_validator

    async def validate(
        self,
        question: dict[str, Any],
        template: QuestionTemplate | None = None,
        skip_content_validation: bool = False,
    ) -> dict[str, Any]:
        """Run full validation pipeline.

        Args:
            question: Question dictionary to validate
            template: Template used for generation (required for content validation)
            skip_content_validation: Skip LLM-based content validation

        Returns:
            Dictionary with validation results
        """
        # Stage 1: Format validation (always runs)
        format_result = self.format_validator.validate(question)

        if not format_result.passed:
            return {
                "passed": False,
                "stage": "format",
                "errors": format_result.errors,
                "score": 0,
            }

        # Stage 2: Content validation (optional)
        if skip_content_validation or not template:
            return {
                "passed": True,
                "stage": "format_only",
                "errors": [],
                "score": None,
                "skipped_content_validation": True,
            }

        content_result = await self.content_validator.validate(question, template)

        return {
            "passed": content_result.passed,
            "stage": "content",
            "errors": content_result.errors,
            "score": content_result.score,
            "feedback": content_result.feedback,
            "details": content_result.details,
        }
