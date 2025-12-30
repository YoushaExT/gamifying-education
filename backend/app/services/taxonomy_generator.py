"""Taxonomy Generator Service for generating subject/topic hierarchies.

This service uses LLMs to generate comprehensive taxonomies of subtopics
with importance weights for a given subject and topic.
"""

import json
import logging
import uuid
from typing import Any

from sqlmodel import Session, select

from app.models import SubtopicTaxonomy, SubtopicTaxonomyCreate
from app.services.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class TaxonomyGenerator:
    """Generates and manages subtopic taxonomies using LLM."""

    def __init__(self, provider: LLMProvider, session: Session):
        """Initialize the taxonomy generator.

        Args:
            provider: LLM provider for taxonomy generation
            session: Database session for storing/retrieving taxonomies
        """
        self.provider = provider
        self.session = session

    async def generate_subtopics_for_topic(
        self, subject: str, topic: str
    ) -> list[dict[str, Any]]:
        """Generate subtopics for a given subject and topic using LLM.

        Args:
            subject: The subject (e.g., "JavaScript")
            topic: The topic (e.g., "Scope")

        Returns:
            List of subtopic dictionaries with structure:
            [
                {
                    "subtopic": "Closures",
                    "importance_weight": 4.5,
                    "description": "Functions retaining access to outer scope..."
                },
                ...
            ]
        """
        prompt = self._build_taxonomy_prompt(subject, topic)

        logger.info(f"Generating subtopics for {subject}/{topic}")

        try:
            # Use LLM to generate taxonomy
            response = await self.provider.generate_taxonomy(prompt)

            # Parse and validate response
            subtopics = self._parse_taxonomy_response(response)

            # Validate we have 2-12 subtopics as required
            if len(subtopics) < 2 or len(subtopics) > 12:
                logger.warning(
                    f"Generated {len(subtopics)} subtopics, expected 2-12. "
                    "Truncating or padding as needed."
                )
                if len(subtopics) > 12:
                    subtopics = subtopics[:12]
                elif len(subtopics) < 2 and subtopics:
                    # Pad with generic subtopic
                    while len(subtopics) < 2:
                        subtopics.append(
                            {
                                "subtopic": f"Advanced Concepts {len(subtopics) + 1}",
                                "importance_weight": 2.5,
                                "description": "Advanced concepts and edge cases",
                            }
                        )

            logger.info(
                f"Successfully generated {len(subtopics)} subtopics for {subject}/{topic}"
            )
            return subtopics

        except Exception as e:
            logger.error(f"Failed to generate subtopics: {e}", exc_info=True)
            # Return minimal fallback taxonomy
            return [
                {
                    "subtopic": "Fundamentals",
                    "importance_weight": 5.0,
                    "description": "Core concepts and principles",
                },
                {
                    "subtopic": "Advanced Topics",
                    "importance_weight": 3.0,
                    "description": "Advanced concepts and applications",
                },
            ]

    def _build_taxonomy_prompt(self, subject: str, topic: str) -> str:
        """Build prompt for LLM taxonomy generation.

        Args:
            subject: The subject
            topic: The topic

        Returns:
            Formatted prompt string
        """
        return f"""You are an expert educator creating a comprehensive taxonomy for a subject and topic.

Subject: {subject}
Topic: {topic}

Generate a taxonomy of 2-12 specific subtopics for this subject/topic combination.
For each subtopic, provide:
1. subtopic: A clear, specific name (max 200 characters)
2. importance_weight: Educational importance on a scale of 1-5 (5 = most important)
3. description: Brief explanation of what this subtopic covers (max 500 characters)

The subtopics should:
- Cover the main conceptual areas within this topic
- Progress from fundamental to advanced concepts where appropriate
- Be distinct from each other with minimal overlap
- Be specific enough to guide question generation

Return ONLY a valid JSON array in this exact format:
[
  {{
    "subtopic": "Global Scope",
    "importance_weight": 4.0,
    "description": "Variables accessible from anywhere in the program"
  }},
  {{
    "subtopic": "Closures",
    "importance_weight": 5.0,
    "description": "Functions retaining access to their outer scope even after that scope executes"
  }}
]

Generate the taxonomy now:"""

    def _parse_taxonomy_response(self, response: str) -> list[dict[str, Any]]:
        """Parse LLM response into structured subtopic list.

        Args:
            response: Raw LLM response (should be JSON)

        Returns:
            List of parsed subtopic dictionaries

        Raises:
            ValueError: If response cannot be parsed
        """
        try:
            # Try to parse as JSON directly
            data = json.loads(response.strip())

            if isinstance(data, dict) and "subtopics" in data:
                # Handle wrapped response
                subtopics = data["subtopics"]
            elif isinstance(data, list):
                # Direct list response
                subtopics = data
            else:
                raise ValueError("Response must be a list or dict with 'subtopics' key")

            # Validate and normalize each subtopic
            validated_subtopics = []
            for item in subtopics:
                if not isinstance(item, dict):
                    continue

                subtopic = item.get("subtopic", "").strip()
                if not subtopic:
                    continue

                # Clamp importance weight to 1-5 range
                importance_weight = float(item.get("importance_weight", 3.0))
                importance_weight = max(1.0, min(5.0, importance_weight))

                description = item.get("description", "")[:500]

                validated_subtopics.append(
                    {
                        "subtopic": subtopic[:200],
                        "importance_weight": importance_weight,
                        "description": description,
                    }
                )

            return validated_subtopics

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse taxonomy JSON: {e}")
            raise ValueError(f"Invalid JSON response: {e}")
        except Exception as e:
            logger.error(f"Failed to validate taxonomy response: {e}")
            raise ValueError(f"Invalid taxonomy structure: {e}")

    async def get_or_generate_taxonomy(
        self, subject: str, topic: str, user_id: str | None = None
    ) -> dict[str, float]:
        """Get existing taxonomy or generate new one.

        Checks database first for existing taxonomy, generates if not found.

        Args:
            subject: The subject
            topic: The topic
            user_id: Optional user ID for attribution

        Returns:
            Dictionary mapping subtopic names to importance weights
        """
        # Check if taxonomy exists in database
        statement = select(SubtopicTaxonomy).where(
            SubtopicTaxonomy.subject == subject, SubtopicTaxonomy.topic == topic
        )
        existing_taxonomy = self.session.exec(statement).all()

        if existing_taxonomy:
            logger.info(
                f"Found existing taxonomy for {subject}/{topic} "
                f"with {len(existing_taxonomy)} subtopics"
            )
            return {item.subtopic: item.importance_weight for item in existing_taxonomy}

        # Generate new taxonomy
        logger.info(
            f"No existing taxonomy found, generating new one for {subject}/{topic}"
        )
        subtopics = await self.generate_subtopics_for_topic(subject, topic)

        # Store in database
        for subtopic_data in subtopics:
            taxonomy_create = SubtopicTaxonomyCreate(
                subject=subject,
                topic=topic,
                subtopic=subtopic_data["subtopic"],
                importance_weight=subtopic_data["importance_weight"],
                description=subtopic_data.get("description"),
            )

            db_taxonomy = SubtopicTaxonomy.model_validate(taxonomy_create)
            if user_id:
                db_taxonomy.created_by = uuid.UUID(user_id)

            self.session.add(db_taxonomy)

        self.session.commit()
        logger.info(f"Stored {len(subtopics)} subtopics in database")

        return {item["subtopic"]: item["importance_weight"] for item in subtopics}

    async def refresh_taxonomy(
        self, subject: str, topic: str, user_id: str | None = None
    ) -> dict[str, float]:
        """Regenerate taxonomy for a subject/topic, replacing existing one.

        Args:
            subject: The subject
            topic: The topic
            user_id: Optional user ID for attribution

        Returns:
            Dictionary mapping subtopic names to importance weights
        """
        # Delete existing taxonomy
        statement = select(SubtopicTaxonomy).where(
            SubtopicTaxonomy.subject == subject, SubtopicTaxonomy.topic == topic
        )
        existing = self.session.exec(statement).all()

        for item in existing:
            self.session.delete(item)

        self.session.commit()
        logger.info(f"Deleted {len(existing)} existing subtopics for {subject}/{topic}")

        # Generate and store new taxonomy
        return await self.get_or_generate_taxonomy(subject, topic, user_id)
