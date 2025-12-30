"""Diversity Analyzer Service for question generation.

This service analyzes existing questions to calculate diversity scores and
select diverse question subtopics and types for generation.
"""

import logging
import random
from collections import defaultdict
from typing import Any

from sqlmodel import Session, select

from app.models import GeneratedQuestion

logger = logging.getLogger(__name__)

# Predefined question types
QUESTION_TYPES = [
    "Output-Based",
    "Explanation-Based",
    "Concept Definition",
    "Behavior Comparison",
    "Identify Scope Type",
    "Error Identification",
    "Closure-Based",
    "True/False Concept",
]


class DiversityAnalyzer:
    """Analyzes question diversity and calculates generation probabilities."""

    def __init__(self, session: Session):
        """Initialize the diversity analyzer.

        Args:
            session: Database session for querying questions
        """
        self.session = session

    async def get_frequency_distribution(
        self, subject: str, topic: str
    ) -> dict[str, dict[str, int]]:
        """Get frequency distribution of subtopics and types for a subject+topic.

        Args:
            subject: The subject to analyze (e.g., "JavaScript")
            topic: The topic to analyze (e.g., "Scope")

        Returns:
            Dictionary with counts: {
                "subtopics": {"Closures": 5, "TDZ": 2, ...},
                "types": {"Output-Based": 8, "Explanation-Based": 3, ...}
            }
        """
        # Query approved questions from GeneratedQuestion table
        statement = select(GeneratedQuestion).where(
            GeneratedQuestion.status == "approved"
        )

        results = self.session.exec(statement).all()

        # Filter by subject and topic from question_data
        subtopic_counts: dict[str, int] = defaultdict(int)
        type_counts: dict[str, int] = defaultdict(int)

        for question in results:
            q_data = question.question_data
            if q_data.get("subject") == subject and q_data.get("topic") == topic:
                # Count subtopic if present
                if question.subtopic:
                    subtopic_counts[question.subtopic] += 1

                # Count question type if present
                if question.question_type:
                    type_counts[question.question_type] += 1

        # Note: Regular questions may not have subtopic/type metadata
        # which is why we primarily rely on GeneratedQuestion data above

        logger.info(
            f"Frequency distribution for {subject}/{topic}: "
            f"{len(subtopic_counts)} subtopics, {len(type_counts)} types"
        )

        return {"subtopics": dict(subtopic_counts), "types": dict(type_counts)}

    async def calculate_diversity_scores(
        self, subject: str, topic: str, subtopics_with_weights: dict[str, float]
    ) -> dict[str, float]:
        """Calculate diversity scores for each subtopic.

        Formula: score = importance_weight * (1 / (frequency + 1))
        Higher score means higher priority for generation.

        Args:
            subject: The subject (e.g., "JavaScript")
            topic: The topic (e.g., "Scope")
            subtopics_with_weights: Dictionary mapping subtopic names to importance weights (1-5)

        Returns:
            Dictionary mapping subtopics to normalized probability scores
        """
        # Get current frequency distribution
        freq_dist = await self.get_frequency_distribution(subject, topic)
        subtopic_frequencies = freq_dist["subtopics"]

        # Calculate raw scores
        raw_scores: dict[str, float] = {}
        for subtopic, importance_weight in subtopics_with_weights.items():
            frequency = subtopic_frequencies.get(subtopic, 0)
            # Higher weight and lower frequency = higher score
            raw_scores[subtopic] = importance_weight * (1.0 / (frequency + 1))

        # Normalize scores to sum to 1.0 (probability distribution)
        total_score = sum(raw_scores.values())
        if total_score == 0:
            # Edge case: all zeros, return uniform distribution
            num_subtopics = len(subtopics_with_weights)
            return {
                subtopic: 1.0 / num_subtopics
                for subtopic in subtopics_with_weights.keys()
            }

        normalized_scores = {
            subtopic: score / total_score for subtopic, score in raw_scores.items()
        }

        logger.info(
            f"Calculated diversity scores for {subject}/{topic}: "
            f"{len(normalized_scores)} subtopics"
        )

        return normalized_scores

    async def select_diverse_target(
        self,
        subject: str,
        topic: str,
        subtopics_with_weights: dict[str, float],
        question_types: list[str] | None = None,
    ) -> tuple[str, str]:
        """Select a subtopic and question type using weighted random selection.

        Args:
            subject: The subject (e.g., "JavaScript")
            topic: The topic (e.g., "Scope")
            subtopics_with_weights: Dictionary mapping subtopic names to importance weights
            question_types: Optional list of question types to choose from (uses default if not provided)

        Returns:
            Tuple of (selected_subtopic, selected_question_type)
        """
        if not subtopics_with_weights:
            raise ValueError(
                "subtopics_with_weights cannot be empty for diverse target selection"
            )

        # Calculate diversity scores for subtopics
        diversity_scores = await self.calculate_diversity_scores(
            subject, topic, subtopics_with_weights
        )

        # Weighted random selection for subtopic
        subtopics = list(diversity_scores.keys())
        probabilities = [diversity_scores[st] for st in subtopics]

        selected_subtopic = random.choices(subtopics, weights=probabilities, k=1)[0]

        # Select question type with similar diversity logic
        if question_types is None:
            question_types = QUESTION_TYPES

        # Get type frequency
        freq_dist = await self.get_frequency_distribution(subject, topic)
        type_frequencies = freq_dist["types"]

        # Calculate type scores (all types have equal importance for now)
        type_scores = {
            qtype: 1.0 / (type_frequencies.get(qtype, 0) + 1)
            for qtype in question_types
        }

        # Normalize type scores
        total_type_score = sum(type_scores.values())
        if total_type_score > 0:
            type_probabilities = [
                type_scores[qtype] / total_type_score for qtype in question_types
            ]
        else:
            type_probabilities = [1.0 / len(question_types)] * len(question_types)

        selected_type = random.choices(question_types, weights=type_probabilities, k=1)[
            0
        ]

        logger.info(
            f"Selected diverse target for {subject}/{topic}: "
            f"subtopic='{selected_subtopic}', type='{selected_type}'"
        )

        return selected_subtopic, selected_type

    async def get_diversity_metadata(self, subject: str, topic: str) -> dict[str, Any]:
        """Get comprehensive diversity metadata for a subject/topic combination.

        Args:
            subject: The subject to analyze
            topic: The topic to analyze

        Returns:
            Dictionary with frequency distributions and statistics
        """
        freq_dist = await self.get_frequency_distribution(subject, topic)

        total_questions = sum(freq_dist["subtopics"].values())
        num_subtopics = len(freq_dist["subtopics"])
        num_types = len(freq_dist["types"])

        return {
            "subject": subject,
            "topic": topic,
            "total_questions": total_questions,
            "frequency_distribution": freq_dist,
            "num_unique_subtopics": num_subtopics,
            "num_unique_types": num_types,
        }
