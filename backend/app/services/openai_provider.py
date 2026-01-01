"""OpenAI implementation of the LLM provider."""

import json
import logging
from typing import Any

from openai import OpenAI
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(LLMProvider):
    """OpenAI implementation of the LLM provider interface."""

    def __init__(self, api_key: str, model: str = "gpt-5-mini-2025-08-07"):
        """Initialize the OpenAI provider.

        Args:
            api_key: OpenAI API key
            model: Model to use (default: gpt-5-mini-2025-08-07)
        """
        self.client = OpenAI(api_key=api_key)
        self.model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
    )
    async def generate_questions(
        self,
        prompt: str,
        num_questions: int,
        temperature: float = 0.7,
        subject: str | None = None,
        topic: str | None = None,
    ) -> list[dict[str, Any]]:
        """Generate questions using OpenAI with structured output.

        Args:
            prompt: Formatted prompt with instructions
            num_questions: Number of questions to generate
            temperature: Creativity level (0.0-1.0)
            subject: Subject to set in generated questions
            topic: Topic to set in generated questions

        Returns:
            List of question dictionaries
        """
        try:
            # gpt-5-mini models only support temperature=1
            model_temperature = 1.0 if "gpt-5-mini" in self.model else temperature

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert educator creating high-quality multiple-choice questions. Always respond with valid JSON. DO NOT generate images in questions - text and code only.",
                    },
                    {
                        "role": "user",
                        "content": f'{prompt}\n\nGenerate {num_questions} question(s). Return as JSON with this structure:\n{{\n  "questions": [\n    {{\n      "question_text": "<p>Question with HTML formatting</p>",\n      "choices": ["Plain text choice 1", "Plain text choice 2", "Plain text choice 3", "Plain text choice 4"],\n      "correct_answers": [0],\n      "difficulty": "easy",\n      "question_type": "mcq"\n    }}\n  ]\n}}\n\nCRITICAL FORMAT REQUIREMENTS:\n- DO NOT include "A.", "B.", "C.", "D." labels in choices - use plain text only\n- correct_answers must be array of indices (0, 1, 2, or 3), not letters\n- For single correct answer: use [0], [1], [2], or [3]\n- For multiple correct answers: use [0, 2], [1, 3], etc.\n- Include "difficulty" field: "easy" or "hard"\n- Include "question_type" field: "mcq" (single answer) or "multiselect" (2+ answers)\n- DO NOT generate or reference images',
                    },
                ],
                temperature=model_temperature,
                response_format={"type": "json_object"},
            )

            # Parse response and inject subject/topic
            questions = self._parse_response(response)

            # Inject subject and topic if provided
            if subject is not None or topic is not None:
                for question in questions:
                    if subject is not None:
                        question["subject"] = subject
                    if topic is not None:
                        question["topic"] = topic

            return questions

        except Exception as e:
            logger.error(f"OpenAI question generation failed: {e}", exc_info=True)
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
    )
    async def validate_content(
        self,
        question: dict[str, Any],
        criteria: dict[str, Any],
    ) -> dict[str, Any]:
        """Validate question content using OpenAI.

        Args:
            question: Question dictionary to validate
            criteria: Dict containing validation prompt

        Returns:
            Validation result with score and feedback
        """
        try:
            validation_prompt = criteria.get("prompt", "")

            # gpt-5-mini models only support temperature=1
            model_temperature = 1.0 if "gpt-5-mini" in self.model else 0.3

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert educator evaluating question quality. Always respond with valid JSON.",
                    },
                    {
                        "role": "user",
                        "content": f'{validation_prompt}\n\nReturn as JSON: {{"overall_score": 85, "criteria_scores": {{"relevance": 90, "correctness": 85, "clarity": 80, "difficulty": 85, "distractors": 85}}, "feedback": "Detailed feedback here"}}',
                    },
                ],
                temperature=model_temperature,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from OpenAI")

            result: dict[str, Any] = json.loads(content)

            # Ensure required fields are present
            if "overall_score" not in result:
                result["overall_score"] = 70  # Default score
            if "criteria_scores" not in result:
                result["criteria_scores"] = {}
            if "feedback" not in result:
                result["feedback"] = "No feedback provided"

            return result

        except Exception as e:
            logger.error(f"OpenAI content validation failed: {e}", exc_info=True)
            # Return a default validation result on error
            return {
                "overall_score": 50,
                "criteria_scores": {},
                "feedback": f"Validation failed: {str(e)}",
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
    )
    async def generate_taxonomy(
        self,
        prompt: str,
    ) -> str:
        """Generate subtopic taxonomy using OpenAI.

        Args:
            prompt: The formatted prompt for taxonomy generation

        Returns:
            JSON string containing the taxonomy structure
        """
        try:
            # gpt-5-mini models only support temperature=1
            model_temperature = 1.0 if "gpt-5-mini" in self.model else 0.7

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert educator creating comprehensive educational taxonomies. Always respond with valid JSON.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=model_temperature,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response from OpenAI")

            return content

        except Exception as e:
            logger.error(f"OpenAI taxonomy generation failed: {e}", exc_info=True)
            raise

    def _parse_response(self, response: Any) -> list[dict[str, Any]]:
        """Parse OpenAI response to extract questions.

        Args:
            response: OpenAI API response object

        Returns:
            List of question dictionaries
        """
        try:
            content = response.choices[0].message.content
            if not content:
                logger.warning("Empty response content from OpenAI")
                return []

            data = json.loads(content)
            questions: list[dict[str, Any]] = data.get("questions", [])

            if not questions:
                logger.warning("No questions found in OpenAI response")

            return questions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to parse OpenAI response: {e}")
            return []
