"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Abstract base class for LLM providers.

    This interface allows the system to support multiple LLM providers
    (OpenAI, Anthropic, etc.) with a consistent API.
    """

    @abstractmethod
    async def generate_questions(
        self,
        prompt: str,
        num_questions: int,
        temperature: float = 0.7,
        subject: str | None = None,
        topic: str | None = None,
    ) -> list[dict[str, Any]]:
        """Generate questions using the LLM.

        Args:
            prompt: The formatted prompt with instructions and examples
            num_questions: Number of questions to generate
            temperature: Creativity level (0.0-1.0)
            subject: Subject to set in generated questions (if provided, overrides LLM)
            topic: Topic to set in generated questions (if provided, overrides LLM)

        Returns:
            List of question dictionaries with structure:
            {
                "question_text": str (HTML),
                "choices": list[str],
                "correct_answers": list[str],
                "subject": str,
                "topic": str | None
            }
        """
        pass

    @abstractmethod
    async def validate_content(
        self,
        question: dict[str, Any],
        criteria: dict[str, Any],
    ) -> dict[str, Any]:
        """Validate question content using LLM.

        Args:
            question: Question dictionary to validate
            criteria: Validation criteria including prompt

        Returns:
            Validation result dictionary:
            {
                "overall_score": int (0-100),
                "criteria_scores": dict,
                "feedback": str
            }
        """
        pass

    @abstractmethod
    async def generate_taxonomy(
        self,
        prompt: str,
    ) -> str:
        """Generate subtopic taxonomy using the LLM.

        Args:
            prompt: The formatted prompt for taxonomy generation

        Returns:
            JSON string containing the taxonomy structure
        """
        pass
