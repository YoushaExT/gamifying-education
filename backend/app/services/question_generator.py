"""Question generator service."""

import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session

from app.models import GeneratedQuestion, QuestionTemplate
from app.services.diversity_analyzer import DiversityAnalyzer
from app.services.llm_provider import LLMProvider
from app.services.taxonomy_generator import TaxonomyGenerator
from app.services.template_service import TemplateService
from app.services.validators import QuestionValidator

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Result of a question generation batch."""

    batch_id: uuid.UUID
    total: int
    successful: int
    failed: int
    questions: list[dict[str, Any]]


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int = 60):
        """Initialize rate limiter.

        Args:
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[datetime]] = defaultdict(list)

    async def check_limit(self, user_id: str) -> bool:
        """Check if user has exceeded rate limit.

        Args:
            user_id: User identifier

        Returns:
            True if within limit, False if exceeded
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=self.window_seconds)

        # Remove old requests
        self.requests[user_id] = [
            req_time for req_time in self.requests[user_id] if req_time > cutoff
        ]

        # Check limit
        if len(self.requests[user_id]) >= self.max_requests:
            return False

        self.requests[user_id].append(now)
        return True

    async def acquire(self, user_id: str) -> None:
        """Acquire rate limit slot or raise exception.

        Args:
            user_id: User identifier

        Raises:
            Exception: If rate limit exceeded
        """
        if not await self.check_limit(user_id):
            raise Exception("Rate limit exceeded. Please try again later.")


class QuestionGeneratorService:
    """Service for generating questions using LLM with diversity optimization."""

    def __init__(
        self,
        provider: LLMProvider,
        template_service: TemplateService,
        validator: QuestionValidator,
        session: Session,
        rate_limit: int = 50,
    ):
        """Initialize question generator service.

        Args:
            provider: LLM provider for generation
            template_service: Template service for loading templates
            validator: Validator for checking question quality
            session: Database session
            rate_limit: Maximum requests per minute
        """
        self.provider = provider
        self.template_service = template_service
        self.validator = validator
        self.session = session
        self.rate_limiter = RateLimiter(max_requests=rate_limit, window_seconds=60)
        self.diversity_analyzer = DiversityAnalyzer(session)
        self.taxonomy_generator = TaxonomyGenerator(provider, session)

    async def generate_batch(
        self,
        template_id: uuid.UUID,
        num_questions: int,
        user_id: uuid.UUID,
        skip_content_validation: bool = False,
        temperature: float = 0.7,
        custom_prompt: str | None = None,
    ) -> GenerationResult:
        """Generate a batch of questions with diversity optimization.

        Args:
            template_id: ID of template to use
            num_questions: Number of questions to generate
            user_id: ID of user generating questions
            skip_content_validation: Skip LLM content validation
            temperature: Generation creativity (0.0-1.0)
            custom_prompt: Optional custom prompt for additional guidance

        Returns:
            GenerationResult with batch details
        """
        # 1. Check rate limit
        await self.rate_limiter.acquire(str(user_id))

        # 2. Load template
        template = await self.template_service.get_template(str(template_id))
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        # Extract subject and topic from template
        subject = template.subject if hasattr(template, "subject") else ""
        topic = template.topic if hasattr(template, "topic") else None

        if not subject:
            raise ValueError("Template must specify subject")

        logger.info(
            f"Generating {num_questions} questions for user {user_id} "
            f"using template {template_id} (subject={subject}, topic={topic or 'general'})"
        )

        # 3. Pre-generation: Get or generate taxonomy (only if topic is specified)
        if topic:
            try:
                taxonomy_dict = await self.taxonomy_generator.get_or_generate_taxonomy(
                    subject, topic, str(user_id)
                )
                subtopics_with_weights = taxonomy_dict
                logger.info(
                    f"Loaded taxonomy with {len(subtopics_with_weights)} subtopics"
                )
            except Exception as e:
                logger.warning(
                    f"Failed to load/generate taxonomy: {e}. Proceeding without diversity optimization."
                )
                subtopics_with_weights = {}
        else:
            logger.info("No topic specified, skipping taxonomy generation")
            subtopics_with_weights = {}

        # 4. Analyze existing question diversity (only if topic is specified)
        if topic:
            try:
                frequency_dist = (
                    await self.diversity_analyzer.get_frequency_distribution(
                        subject, topic
                    )
                )
                logger.info(f"Current distribution: {frequency_dist}")
            except Exception as e:
                logger.warning(f"Failed to analyze diversity: {e}")
                frequency_dist = {"subtopics": {}, "types": {}}
        else:
            logger.info("No topic specified, skipping diversity analysis")
            frequency_dist = {"subtopics": {}, "types": {}}

        # 5. Select diverse target subtopic and question type
        if subtopics_with_weights and topic:
            try:
                (
                    selected_subtopic,
                    selected_question_type,
                ) = await self.diversity_analyzer.select_diverse_target(
                    subject, topic, subtopics_with_weights
                )
                logger.info(
                    f"Selected diverse target: subtopic={selected_subtopic}, "
                    f"type={selected_question_type}"
                )
            except Exception as e:
                logger.warning(f"Failed to select diverse target: {e}")
                selected_subtopic = None
                selected_question_type = None
        else:
            selected_subtopic = None
            selected_question_type = None

        # 6. Enhanced prompt construction
        prompt = (
            await self._build_diversity_prompt(
                template=template,
                num_questions=num_questions,
                subject=subject,
                topic=topic,
                subtopic=selected_subtopic,
                question_type=selected_question_type,
            )
            if selected_subtopic and selected_question_type and topic
            else await self.template_service.render_prompt(
                template, num_questions=num_questions
            )
        )

        # Append custom prompt if provided
        if custom_prompt:
            prompt += f"\n\nADDITIONAL CUSTOM GUIDANCE:\n{custom_prompt}\n"
            logger.info(f"Appended custom prompt: {custom_prompt[:100]}...")

        # 7. Generate questions
        try:
            questions = await self.provider.generate_questions(
                prompt=prompt,
                num_questions=num_questions,
                temperature=temperature,
                subject=subject,
                topic=topic if topic else None,
            )
        except Exception as e:
            logger.error(f"Question generation failed: {e}", exc_info=True)
            raise Exception(f"Failed to generate questions: {str(e)}")

        # 8. Calculate diversity score for this generation
        diversity_score = None
        if selected_subtopic and subtopics_with_weights:
            try:
                importance = subtopics_with_weights.get(selected_subtopic, 1.0)
                frequency = frequency_dist["subtopics"].get(selected_subtopic, 0)
                diversity_score = importance * (1.0 / (frequency + 1))
            except Exception as e:
                logger.warning(f"Failed to calculate diversity score: {e}")

        # 9. Validate each question
        batch_id = uuid.uuid4()
        validated_questions = []
        successful = 0
        failed = 0

        for question in questions:
            try:
                validation_result = await self.validator.validate(
                    question=question,
                    template=template,
                    skip_content_validation=skip_content_validation,
                )

                # Store in GeneratedQuestion table with diversity metadata
                generated_question = GeneratedQuestion(
                    question_data=question,
                    template_id=template_id,
                    batch_id=batch_id,
                    status="pending",
                    validation_score=validation_result.get("score"),
                    validation_feedback=validation_result.get("feedback"),
                    subtopic=selected_subtopic,
                    question_type=selected_question_type,
                    diversity_score=diversity_score,
                    created_by=user_id,
                )

                self.session.add(generated_question)
                validated_questions.append(
                    {
                        "id": str(generated_question.id),
                        "question": question,
                        "validation": validation_result,
                        "subtopic": selected_subtopic,
                        "question_type": selected_question_type,
                        "diversity_score": diversity_score,
                    }
                )

                if validation_result["passed"]:
                    successful += 1
                else:
                    failed += 1

            except Exception as e:
                logger.error(f"Failed to validate/store question: {e}", exc_info=True)
                failed += 1

        # 10. Commit to database
        try:
            self.session.commit()
        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to commit generated questions: {e}", exc_info=True)
            raise Exception("Failed to save generated questions")

        logger.info(
            f"Generation complete: batch_id={batch_id}, "
            f"successful={successful}, failed={failed}"
        )

        return GenerationResult(
            batch_id=batch_id,
            total=num_questions,
            successful=successful,
            failed=failed,
            questions=validated_questions,
        )

    async def _build_diversity_prompt(
        self,
        template: QuestionTemplate,
        num_questions: int,
        subject: str,
        topic: str,
        subtopic: str | None,
        question_type: str | None,
    ) -> str:
        """Build an enhanced prompt with diversity constraints.

        Args:
            template: Base template dictionary
            num_questions: Number of questions to generate
            subject: Subject name
            topic: Topic name
            subtopic: Specific subtopic to focus on
            question_type: Type of question to generate

        Returns:
            Enhanced prompt string
        """
        # Start with base template prompt
        base_prompt = await self.template_service.render_prompt(
            template, num_questions=num_questions
        )

        # Add diversity constraints if available
        if subtopic and question_type:
            # Get difficulty from template
            difficulty = (
                template.difficulty if hasattr(template, "difficulty") else "easy"
            )

            diversity_guidance = f"""

CRITICAL DIVERSITY REQUIREMENTS:

1. SUBTOPIC FOCUS: The question MUST specifically target "{subtopic}" within {topic}.
   DO NOT generate questions about other subtopics. The question should test
   understanding of "{subtopic}" specifically, not general {topic} knowledge.

2. QUESTION TYPE: Follow the "{question_type}" format precisely:
"""

            # Add detailed examples based on question type
            if question_type == "Output-Based" or "output" in question_type.lower():
                diversity_guidance += """   - Show a code snippet and ask what it outputs or logs
   - Focus on the actual result when the code executes
   - Example: "What will the following code log to the console?"
"""
            elif (
                question_type == "Concept Definition"
                or "conceptual" in question_type.lower()
            ):
                diversity_guidance += """   - Test understanding of definitions, principles, or behaviors
   - Ask about what a concept IS or HOW it works
   - Example: "What is a closure in JavaScript?" or "Which statement is true about..."
"""
            elif (
                question_type == "Error Identification"
                or "error" in question_type.lower()
            ):
                diversity_guidance += """   - Present code with a bug or edge case
   - Ask what error occurs or why it doesn't work as expected
   - Example: "What error will occur when running this code?"
"""
            elif (
                question_type == "Practical Application"
                or "practical" in question_type.lower()
            ):
                diversity_guidance += """   - Describe a scenario and ask how to implement a solution
   - Test ability to apply concepts to real problems
   - Example: "How would you implement..." or "Which pattern should be used for..."
"""
            elif question_type == "Explanation-Based":
                diversity_guidance += """   - Provide code with output and ask for explanation of behavior
   - Example: "Why does this code behave this way?"
"""
            elif question_type == "Behavior Comparison":
                diversity_guidance += """   - Compare behaviors of similar constructs or patterns
   - Example: "What is the difference between let and var?"
"""
            elif question_type == "Code Completion":
                diversity_guidance += """   - Provide incomplete code and ask for the correct completion
   - Example: "What should replace the blank to achieve..."
"""
            else:
                diversity_guidance += f"""   - Follow the "{question_type}" pattern
   - Ensure the question clearly tests this specific type of knowledge
"""

            diversity_guidance += f"""
3. FORMAT CONSTRAINTS:
   - DO NOT include "A.", "B.", "C.", "D." labels in choice text - use plain text only
   - Provide exactly 4 choices as plain text strings
   - Indicate correct answers by INDEX (0, 1, 2, or 3), not letters
   - For single-answer questions (mcq): correct_answers should be [0], [1], [2], or [3]
   - For multiple-answer questions (multiselect): correct_answers should be array like [0, 2] or [1, 3]
   - Set question_type to "mcq" for single answer, "multiselect" for 2+ correct answers
   - Set difficulty to "{difficulty}"

4. DIFFICULTY LEVEL: {difficulty.upper()}"""

            if difficulty == "easy":
                diversity_guidance += """
   - Keep concepts straightforward and common
   - Use simple, clear code examples with few lines
   - Test basic understanding, not edge cases
   - Avoid complex interactions or tricky behaviors
"""
            elif difficulty == "hard":
                diversity_guidance += """
   - Test edge cases, complex interactions, or tricky behaviors
   - Use non-trivial code patterns
   - Require deeper understanding beyond surface-level knowledge
   - May involve subtle gotchas or advanced concepts
"""
            else:  # medium or other
                diversity_guidance += """
   - Balance between straightforward and complex concepts
   - Test solid understanding with moderate complexity
"""

            diversity_guidance += f"""
5. AVOID REPETITION:
   - Generate unique examples that are different from typical patterns
   - Use diverse code scenarios, not just variations of the same concept
   - Vary the approach: if subtopic has been tested with output-based questions
     before, approach it from a different angle
   - Make the question distinct and novel

IMPORTANT: The question MUST be specifically about "{subtopic}", following the
"{question_type}" format, at "{difficulty}" difficulty level.
"""

            enhanced_prompt = base_prompt + diversity_guidance
        else:
            enhanced_prompt = base_prompt

        return enhanced_prompt
