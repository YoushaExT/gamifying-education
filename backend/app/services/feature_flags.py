"""Feature flags service for managing feature availability."""

import os
import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from app.models import FeatureFlag, FeatureFlagCreate


class FeatureFlagService:
    """Service for managing feature flags with environment variable overrides."""

    def __init__(self, session: Session):
        self.session = session

    def is_enabled(
        self,
        flag_key: str,
        user_id: uuid.UUID | None = None,
        user_roles: list[str] | None = None,
    ) -> bool:
        """
        Check if a feature is enabled for a user.

        Priority order:
        1. Environment variable (if set, overrides everything)
        2. User-specific enablement
        3. Role-based enablement
        4. Global enablement
        """
        # Get the flag from database
        flag = self.get_flag(flag_key)
        if not flag:
            return False

        # 1. Check environment variable (highest priority)
        if flag.env_var_name:
            env_value = os.getenv(flag.env_var_name)
            if env_value is not None:
                return env_value.lower() in ("true", "1", "yes", "on")

        # 2. Check user-specific enablement
        if user_id and str(user_id) in flag.enabled_for_users:
            return True

        # 3. Check role-based enablement
        if user_roles:
            for role in user_roles:
                if role in flag.enabled_for_roles:
                    return True

        # 4. Check global enablement
        return flag.enabled

    def get_flag(self, flag_key: str) -> FeatureFlag | None:
        """Get a feature flag by key."""
        statement = select(FeatureFlag).where(FeatureFlag.key == flag_key)
        return self.session.exec(statement).first()

    def get_all_flags(self) -> list[FeatureFlag]:
        """Get all feature flags."""
        statement = select(FeatureFlag)
        return list(self.session.exec(statement).all())

    def update_flag(self, flag_key: str, updates: dict[str, Any]) -> FeatureFlag | None:
        """Update a feature flag."""
        flag = self.get_flag(flag_key)
        if not flag:
            return None

        # Update fields
        for key, value in updates.items():
            if hasattr(flag, key) and key not in ("id", "key", "created_at"):
                setattr(flag, key, value)

        flag.updated_at = datetime.utcnow()
        self.session.add(flag)
        self.session.commit()
        self.session.refresh(flag)
        return flag

    def create_flag(self, flag_data: FeatureFlagCreate) -> FeatureFlag:
        """Create a new feature flag."""
        db_flag = FeatureFlag.model_validate(flag_data)
        self.session.add(db_flag)
        self.session.commit()
        self.session.refresh(db_flag)
        return db_flag

    def create_default_flags(self) -> None:
        """Create default feature flags if they don't exist."""
        default_flags = [
            {
                "key": "ai_question_generation",
                "name": "AI Question Generation",
                "description": "Enable AI-powered question generation using OpenAI",
                "enabled": True,
                "enabled_for_roles": ["teacher", "superuser"],
                "enabled_for_users": [],
                "env_var_name": "FEATURE_AI_QUESTION_GENERATION",
            },
            {
                "key": "quiz_system",
                "name": "Quiz System",
                "description": "Enable MCQ quiz/test functionality for all users",
                "enabled": True,
                "enabled_for_roles": [],
                "enabled_for_users": [],
                "env_var_name": "FEATURE_QUIZ_SYSTEM",
            },
            {
                "key": "quiz_timer",
                "name": "Quiz Timer",
                "description": "Enable timer/time limit functionality in quizzes",
                "enabled": False,
                "enabled_for_roles": [],
                "enabled_for_users": [],
                "env_var_name": "FEATURE_QUIZ_TIMER",
            },
        ]

        for flag_data in default_flags:
            # Check if flag already exists
            existing_flag = self.get_flag(str(flag_data["key"]))
            if not existing_flag:
                flag_create = FeatureFlagCreate(**flag_data)
                self.create_flag(flag_create)
