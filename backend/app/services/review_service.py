"""Review service for approving/rejecting generated questions."""

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app import crud
from app.models import GeneratedQuestion, Question

logger = logging.getLogger(__name__)


class ReviewService:
    """Service for reviewing and approving generated questions."""

    def __init__(self, session: Session):
        """Initialize review service.

        Args:
            session: Database session
        """
        self.session = session

    async def approve_question(
        self, generated_question_id: uuid.UUID, reviewer_id: uuid.UUID
    ) -> Question:
        """Approve a generated question and move it to the Question table.

        Args:
            generated_question_id: ID of generated question to approve
            reviewer_id: ID of user approving the question

        Returns:
            The created Question object

        Raises:
            ValueError: If generated question not found or already reviewed
        """
        # 1. Get generated question
        gen_q = self.session.get(GeneratedQuestion, generated_question_id)
        if not gen_q:
            raise ValueError("Generated question not found")

        if gen_q.status != "pending":
            raise ValueError(f"Question already reviewed with status: {gen_q.status}")

        # 2. Create Question from question_data
        question_data = gen_q.question_data

        # Get or create subject
        subject = crud.get_or_create_subject(
            session=self.session, name=question_data["subject"]
        )

        # Get or create topic if provided
        topic = None
        if question_data.get("topic"):
            topic = crud.get_or_create_topic(
                session=self.session, name=question_data["topic"]
            )

        question = Question(
            question_text=question_data["question_text"],
            choices=question_data["choices"],
            correct_answers=question_data["correct_answers"],
            subject_id=subject.id,
            topic_id=topic.id if topic else None,
            created_by=gen_q.created_by,
        )

        self.session.add(question)

        # 3. Update GeneratedQuestion status
        gen_q.status = "approved"
        gen_q.reviewed_at = datetime.utcnow()
        gen_q.reviewed_by = reviewer_id

        # 4. Commit changes
        try:
            self.session.commit()
            self.session.refresh(question)
            logger.info(
                f"Question {generated_question_id} approved by {reviewer_id}, "
                f"created question {question.id}"
            )
            return question
        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to approve question: {e}", exc_info=True)
            raise Exception("Failed to approve question")

    async def reject_question(
        self,
        generated_question_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        reason: str,
    ) -> None:
        """Reject a generated question.

        Args:
            generated_question_id: ID of generated question to reject
            reviewer_id: ID of user rejecting the question
            reason: Reason for rejection

        Raises:
            ValueError: If generated question not found or already reviewed
        """
        gen_q = self.session.get(GeneratedQuestion, generated_question_id)
        if not gen_q:
            raise ValueError("Generated question not found")

        if gen_q.status != "pending":
            raise ValueError(f"Question already reviewed with status: {gen_q.status}")

        gen_q.status = "rejected"
        gen_q.rejection_reason = reason
        gen_q.reviewed_at = datetime.utcnow()
        gen_q.reviewed_by = reviewer_id

        try:
            self.session.commit()
            logger.info(
                f"Question {generated_question_id} rejected by {reviewer_id}: {reason}"
            )
        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to reject question: {e}", exc_info=True)
            raise Exception("Failed to reject question")

    async def approve_batch(
        self, batch_id: uuid.UUID, reviewer_id: uuid.UUID
    ) -> dict[str, Any]:
        """Approve all pending questions in a batch.

        Args:
            batch_id: Batch ID to approve
            reviewer_id: ID of user approving the batch

        Returns:
            Dictionary with approval results
        """
        statement = (
            select(GeneratedQuestion)
            .where(GeneratedQuestion.batch_id == batch_id)
            .where(GeneratedQuestion.status == "pending")
        )

        result = self.session.exec(statement)
        questions = result.all()

        if not questions:
            return {
                "batch_id": str(batch_id),
                "approved_count": 0,
                "question_ids": [],
                "message": "No pending questions found in batch",
            }

        approved = []
        failed = []

        for gen_q in questions:
            try:
                question = await self.approve_question(gen_q.id, reviewer_id)
                approved.append(str(question.id))
            except Exception as e:
                logger.error(
                    f"Failed to approve question {gen_q.id} in batch: {e}",
                    exc_info=True,
                )
                failed.append(str(gen_q.id))

        logger.info(
            f"Batch {batch_id} approval complete: "
            f"approved={len(approved)}, failed={len(failed)}"
        )

        return {
            "batch_id": str(batch_id),
            "approved_count": len(approved),
            "failed_count": len(failed),
            "question_ids": approved,
            "failed_ids": failed,
        }

    async def get_pending_questions(
        self,
        skip: int = 0,
        limit: int = 100,
        batch_id: uuid.UUID | None = None,
        min_score: int | None = None,
    ) -> list[GeneratedQuestion]:
        """Get pending questions for review.

        Args:
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            batch_id: Filter by batch ID
            min_score: Minimum validation score

        Returns:
            List of pending GeneratedQuestion objects
        """
        statement = select(GeneratedQuestion).where(
            GeneratedQuestion.status == "pending"
        )

        if batch_id:
            statement = statement.where(GeneratedQuestion.batch_id == batch_id)

        if min_score is not None:
            statement = statement.where(
                GeneratedQuestion.validation_score >= min_score  # type: ignore[operator]
            )

        statement = statement.offset(skip).limit(limit)

        result = self.session.exec(statement)
        return list(result.all())
