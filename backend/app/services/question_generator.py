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
    ) -> GenerationResult:
        """Generate a batch of questions with diversity optimization.

        Args:
            template_id: ID of template to use
            num_questions: Number of questions to generate
            user_id: ID of user generating questions
            skip_content_validation: Skip LLM content validation
            temperature: Generation creativity (0.0-1.0)

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
        topic = template.topic if hasattr(template, "topic") else ""

        if not subject or not topic:
            raise ValueError(
                "Template must specify both subject and topic for diversity-based generation"
            )

        logger.info(
            f"Generating {num_questions} questions for user {user_id} "
            f"using template {template_id} (subject={subject}, topic={topic})"
        )

        # 3. Pre-generation: Get or generate taxonomy
        try:
            taxonomy_dict = await self.taxonomy_generator.get_or_generate_taxonomy(
                subject, topic, str(user_id)
            )
            subtopics_with_weights = taxonomy_dict
            logger.info(f"Loaded taxonomy with {len(subtopics_with_weights)} subtopics")
        except Exception as e:
            logger.warning(
                f"Failed to load/generate taxonomy: {e}. Proceeding without diversity optimization."
            )
            subtopics_with_weights = {}

        # 4. Analyze existing question diversity
        try:
            frequency_dist = await self.diversity_analyzer.get_frequency_distribution(
                subject, topic
            )
            logger.info(f"Current distribution: {frequency_dist}")
        except Exception as e:
            logger.warning(f"Failed to analyze diversity: {e}")
            frequency_dist = {"subtopics": {}, "types": {}}

        # 5. Select diverse target subtopic and question type
        if subtopics_with_weights:
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
            if selected_subtopic and selected_question_type
            else await self.template_service.render_prompt(
                template, num_questions=num_questions
            )
        )

        # 7. Generate questions
        try:
            questions = await self.provider.generate_questions(
                prompt=prompt,
                num_questions=num_questions,
                temperature=temperature,
                subject=subject,
                topic=topic,
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
            diversity_guidance = f"""

IMPORTANT DIVERSITY CONSTRAINTS:
- Subject: {subject}
- Topic: {topic}
- **Focus Subtopic**: {subtopic} (This should be the PRIMARY focus of the question)
- **Question Type**: {question_type}

The question MUST strictly adhere to the specified subtopic "{subtopic}" within the topic "{topic}".
The question MUST follow the "{question_type}" format.

Examples of {question_type} questions:
"""
            # Add examples based on question type
            if question_type == "Output-Based":
                diversity_guidance += "- Provide code and ask what will be the output\n"
            elif question_type == "Explanation-Based":
                diversity_guidance += (
                    "- Provide code with output and ask for explanation of behavior\n"
                )
            elif question_type == "Concept Definition":
                diversity_guidance += (
                    "- Ask for the correct definition or explanation of a concept\n"
                )
            elif question_type == "Behavior Comparison":
                diversity_guidance += (
                    "- Compare behaviors of similar constructs or patterns\n"
                )
            elif question_type == "Error Identification":
                diversity_guidance += "- Identify what error will occur in given code\n"
            elif question_type == "Practical Application":
                diversity_guidance += (
                    "- Ask how to apply a concept in a real scenario\n"
                )
            elif question_type == "Code Completion":
                diversity_guidance += (
                    "- Provide incomplete code and ask for completion\n"
                )
            elif question_type == "True/False Concept":
                diversity_guidance += (
                    "- Present statements where one is true about the concept\n"
                )

            enhanced_prompt = base_prompt + diversity_guidance
        else:
            enhanced_prompt = base_prompt

        return enhanced_prompt
