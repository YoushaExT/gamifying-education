# Question Generation Module Architecture

## Table of Contents
1. [Overview](#overview)
2. [System Objectives](#system-objectives)
3. [Architecture Layers](#architecture-layers)
4. [Component Specifications](#component-specifications)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Technology Stack](#technology-stack)
9. [Configuration](#configuration)
10. [Error Handling](#error-handling)
11. [Security Considerations](#security-considerations)
12. [Future Enhancements](#future-enhancements)

---

## Overview

The Question Generation Module is an AI-powered system that automatically generates educational Multiple Choice Questions (MCQs) using Large Language Models (LLMs). The system follows a template-based approach to ensure consistency, quality, and relevance of generated questions across various subjects and topics.

### Key Features

- **Template-Based Generation**: Uses predefined templates with examples to guide AI generation
- **Multi-Layer Validation**: Two-stage validation (format + optional content) ensures quality
- **Batch Generation**: Generate multiple questions efficiently in a single request
- **Admin Review Workflow**: Generated questions require teacher approval before publication
- **Extensible Design**: Abstract provider interface allows future support for multiple LLM providers
- **Flexible Configuration**: Feature flags and parameters for customization

---

## System Objectives

1. **Automate Question Creation**: Reduce manual effort for teachers by generating high-quality questions
2. **Maintain Quality**: Multi-layer validation ensures generated questions meet standards
3. **Preserve Control**: Admin review workflow keeps humans in the loop
4. **Enable Customization**: Template system allows subject-specific question patterns
5. **Scale Efficiently**: Batch generation and caching optimize API usage and costs
6. **Ensure Security**: HTML sanitization and validation prevent XSS and malformed content

---

## Architecture Layers

The system is organized into four primary layers:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (Admin UI for Template Management & Question Review)       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                      API Layer                               │
│  (FastAPI Endpoints for Generation, Review, Templates)      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Template   │  │  Generation  │  │  Validation  │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Template   │  │  Generated   │  │   Question   │      │
│  │     Model    │  │   Question   │  │     Model    │      │
│  │              │  │    Model     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Presentation Layer**: React-based admin interface for managing templates and reviewing generated questions
2. **API Layer**: FastAPI endpoints exposing generation, review, and template management operations
3. **Service Layer**: Core business logic for template loading, question generation, and validation
4. **Data Layer**: SQLModel models for persistent storage of templates, generated questions, and approved questions

---

## Component Specifications

### 1. Template Layer

#### QuestionTemplate Model

**Database Model** (`backend/app/models.py`)

```python
class QuestionTemplateBase(SQLModel):
    subject: str = Field(max_length=100, index=True)
    topic: str | None = Field(default=None, max_length=100)
    difficulty: str = Field(max_length=20)  # "easy", "medium", "hard"
    template_prompt: str = Field(max_length=2000)
    example_questions: list[dict] = Field(sa_column=Column(JSON))
    constraints: dict = Field(default={}, sa_column=Column(JSON))
    is_active: bool = True
    created_by: uuid.UUID | None = Field(foreign_key="user.id")

class QuestionTemplate(QuestionTemplateBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

#### Template Fields

- **subject**: Category (e.g., "JavaScript", "Python", "Mathematics")
- **topic**: Subcategory (e.g., "Scope", "Closures", "Async/Await")
- **difficulty**: Question difficulty level
- **template_prompt**: Base prompt with placeholders for LLM
- **example_questions**: Array of example questions in the desired format
- **constraints**: Additional rules (e.g., `{"require_code": true, "max_choices": 4}`)

#### Default Template Files

**Location**: `backend/app/question_templates/`

**Structure**:
```
question_templates/
├── javascript-scope-medium.json
├── python-loops-easy.json
├── system-design-hard.json
└── README.md
```

**Example Template** (`javascript-scope-medium.json`):

```json
{
  "subject": "JavaScript",
  "topic": "Scope",
  "difficulty": "medium",
  "template_prompt": "Generate a multiple-choice question about {topic} in {subject}. The question should test understanding of variable scope, hoisting, and closure concepts. Include a code snippet that demonstrates the concept. Provide 4 choices (A, B, C, D) with exactly one correct answer. Format the question text as HTML with proper <pre><code> tags for code.",
  "example_questions": [
    {
      "question_text": "<p>What is the <strong>output</strong> of the following code?</p><pre><code class=\"language-javascript\">let x = 5;\n\nfunction demo() {\n  console.log(x);\n  let x = 10;\n}\n\ndemo();</code></pre>",
      "choices": ["A. 5", "B. 10", "C. undefined", "D. ReferenceError"],
      "correct_answers": ["D"],
      "explanation": "This demonstrates the Temporal Dead Zone. The variable x is hoisted but not initialized before the console.log statement."
    }
  ],
  "constraints": {
    "require_code": true,
    "code_language": "javascript",
    "max_question_length": 500
  }
}
```

#### Template Service

**Location**: `backend/app/services/template_service.py`

**Responsibilities**:
- Load default templates from JSON files
- Query custom templates from database
- Merge and prioritize templates (DB templates override file templates)
- Render template prompts with variables
- Validate template structure

**Key Methods**:
```python
class TemplateService:
    async def get_template(self, template_id: uuid.UUID) -> QuestionTemplate
    async def list_templates(self, subject: str | None = None) -> list[QuestionTemplate]
    async def load_default_templates(self) -> list[dict]
    async def render_prompt(self, template: QuestionTemplate, **kwargs) -> str
    async def validate_template(self, template: dict) -> bool
```

---

### 2. Generation Layer

#### LLM Provider Abstraction

**Location**: `backend/app/services/llm_provider.py`

**Abstract Base Class**:

```python
from abc import ABC, abstractmethod
from typing import Any

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def generate_questions(
        self,
        prompt: str,
        num_questions: int,
        temperature: float = 0.7
    ) -> list[dict]:
        """Generate questions using the LLM"""
        pass
    
    @abstractmethod
    async def validate_content(
        self,
        question: dict,
        criteria: dict
    ) -> dict:
        """Validate question content using LLM"""
        pass
```

#### OpenAI Implementation

**Location**: `backend/app/services/openai_provider.py`

```python
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-5-mini-2025-08-07"):
        self.client = OpenAI(api_key=api_key)
        self.model = model
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def generate_questions(
        self,
        prompt: str,
        num_questions: int,
        temperature: float = 0.7
    ) -> list[dict]:
        """Generate questions using OpenAI with structured output"""
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert educator creating high-quality multiple-choice questions."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=temperature,
            response_format={"type": "json_object"}
        )
        
        # Parse and return structured questions
        return self._parse_response(response)
```

#### Question Generator Service

**Location**: `backend/app/services/question_generator.py`

**Responsibilities**:
- Coordinate generation workflow
- Apply rate limiting
- Handle batch generation
- Manage retries and error recovery
- Track generation metrics

**Key Methods**:

```python
class QuestionGeneratorService:
    def __init__(
        self,
        provider: LLMProvider,
        template_service: TemplateService,
        validator: QuestionValidator
    ):
        self.provider = provider
        self.template_service = template_service
        self.validator = validator
        self.rate_limiter = RateLimiter(max_requests=50, window=60)
    
    async def generate_batch(
        self,
        template_id: uuid.UUID,
        num_questions: int,
        skip_content_validation: bool = False
    ) -> GenerationResult:
        """Generate a batch of questions"""
        
        # 1. Load template
        template = await self.template_service.get_template(template_id)
        
        # 2. Render prompt
        prompt = await self.template_service.render_prompt(
            template,
            num_questions=num_questions
        )
        
        # 3. Check rate limit
        await self.rate_limiter.acquire()
        
        # 4. Generate questions
        questions = await self.provider.generate_questions(
            prompt=prompt,
            num_questions=num_questions
        )
        
        # 5. Validate each question
        validated_questions = []
        for q in questions:
            validation_result = await self.validator.validate(
                question=q,
                skip_content_validation=skip_content_validation
            )
            validated_questions.append({
                "question": q,
                "validation": validation_result
            })
        
        # 6. Store in GeneratedQuestion table
        batch_id = uuid.uuid4()
        await self._store_batch(batch_id, validated_questions, template_id)
        
        return GenerationResult(
            batch_id=batch_id,
            total=num_questions,
            successful=len([q for q in validated_questions if q["validation"]["passed"]]),
            failed=len([q for q in validated_questions if not q["validation"]["passed"]])
        )
```

---

### 3. Validation Layer

#### Stage 1: Format Validation (Required)

**Location**: `backend/app/services/validators.py`

**FormatValidator Class**:

```python
from html5lib import HTMLParser
from bs4 import BeautifulSoup
from pydantic import ValidationError
import bleach

class FormatValidator:
    """Validates question format and structure"""
    
    def __init__(self):
        self.html_parser = HTMLParser(strict=True)
        self.allowed_tags = [
            'p', 'strong', 'em', 'code', 'pre', 'br',
            'ul', 'ol', 'li', 'span', 'div'
        ]
    
    def validate(self, question: dict) -> ValidationResult:
        """Run all format validations"""
        errors = []
        
        # 1. Validate against Pydantic schema
        try:
            QuestionCreate(**question)
        except ValidationError as e:
            errors.append(f"Schema validation failed: {e}")
        
        # 2. Validate HTML if present
        if self._contains_html(question["question_text"]):
            html_errors = self._validate_html(question["question_text"])
            errors.extend(html_errors)
        
        # 3. Validate choices
        choice_errors = self._validate_choices(question["choices"])
        errors.extend(choice_errors)
        
        # 4. Validate correct_answers
        answer_errors = self._validate_answers(
            question["correct_answers"],
            question["choices"]
        )
        errors.extend(answer_errors)
        
        # 5. Check for empty/malformed fields
        field_errors = self._validate_fields(question)
        errors.extend(field_errors)
        
        return ValidationResult(
            passed=len(errors) == 0,
            errors=errors,
            warnings=[]
        )
    
    def _validate_html(self, html: str) -> list[str]:
        """Validate HTML structure and safety"""
        errors = []
        
        try:
            # Parse HTML
            soup = BeautifulSoup(html, 'html5lib')
            
            # Check for disallowed tags
            for tag in soup.find_all():
                if tag.name not in self.allowed_tags:
                    errors.append(f"Disallowed HTML tag: {tag.name}")
            
            # Validate code blocks
            code_blocks = soup.find_all('pre')
            for block in code_blocks:
                code = block.find('code')
                if not code:
                    errors.append("Code block missing <code> tag")
                elif not code.get('class'):
                    errors.append("Code block missing language class")
            
            # Sanitize HTML
            clean_html = bleach.clean(
                html,
                tags=self.allowed_tags,
                strip=True
            )
            
            if clean_html != html:
                errors.append("HTML contains potentially unsafe content")
        
        except Exception as e:
            errors.append(f"HTML parsing error: {str(e)}")
        
        return errors
    
    def _validate_choices(self, choices: list[str]) -> list[str]:
        """Validate choices array"""
        errors = []
        
        if len(choices) != 4:
            errors.append(f"Expected 4 choices, got {len(choices)}")
        
        # Check for empty choices
        for i, choice in enumerate(choices):
            if not choice or not choice.strip():
                errors.append(f"Choice {i} is empty")
        
        # Check for duplicates
        if len(choices) != len(set(choices)):
            errors.append("Duplicate choices found")
        
        return errors
    
    def _validate_answers(
        self,
        correct_answers: list[str],
        choices: list[str]
    ) -> list[str]:
        """Validate correct answers"""
        errors = []
        
        if not correct_answers:
            errors.append("No correct answers provided")
        
        valid_letters = ['A', 'B', 'C', 'D']
        for answer in correct_answers:
            if answer not in valid_letters:
                errors.append(f"Invalid answer letter: {answer}")
        
        # Check for duplicates
        if len(correct_answers) != len(set(correct_answers)):
            errors.append("Duplicate correct answers")
        
        return errors
    
    def _validate_fields(self, question: dict) -> list[str]:
        """Validate required fields are present and non-empty"""
        errors = []
        
        required_fields = [
            'question_text', 'choices', 'correct_answers',
            'subject'
        ]
        
        for field in required_fields:
            if field not in question:
                errors.append(f"Missing required field: {field}")
            elif not question[field]:
                errors.append(f"Empty required field: {field}")
        
        return errors
```

#### Stage 2: Content Validation (Optional)

**ContentValidator Class**:

```python
class ContentValidator:
    """Validates question content quality using LLM"""
    
    def __init__(self, provider: LLMProvider, threshold: int = 70):
        self.provider = provider
        self.threshold = threshold
    
    async def validate(
        self,
        question: dict,
        template: QuestionTemplate
    ) -> ValidationResult:
        """Validate content quality using LLM"""
        
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
Return as JSON: {{"overall_score": 85, "criteria_scores": {{}}, "feedback": ""}}
"""
        
        result = await self.provider.validate_content(
            question=question,
            criteria={"prompt": validation_prompt}
        )
        
        passed = result["overall_score"] >= self.threshold
        
        return ValidationResult(
            passed=passed,
            score=result["overall_score"],
            details=result["criteria_scores"],
            feedback=result["feedback"],
            errors=[] if passed else [f"Quality score {result['overall_score']} below threshold {self.threshold}"]
        )
```

#### Combined QuestionValidator

```python
class QuestionValidator:
    """Orchestrates format and content validation"""
    
    def __init__(
        self,
        format_validator: FormatValidator,
        content_validator: ContentValidator
    ):
        self.format_validator = format_validator
        self.content_validator = content_validator
    
    async def validate(
        self,
        question: dict,
        template: QuestionTemplate | None = None,
        skip_content_validation: bool = False
    ) -> dict:
        """Run full validation pipeline"""
        
        # Stage 1: Format validation (always runs)
        format_result = self.format_validator.validate(question)
        
        if not format_result.passed:
            return {
                "passed": False,
                "stage": "format",
                "errors": format_result.errors,
                "score": 0
            }
        
        # Stage 2: Content validation (optional)
        if skip_content_validation or not template:
            return {
                "passed": True,
                "stage": "format_only",
                "errors": [],
                "score": None,
                "skipped_content_validation": True
            }
        
        content_result = await self.content_validator.validate(
            question, template
        )
        
        return {
            "passed": content_result.passed,
            "stage": "content",
            "errors": content_result.errors,
            "score": content_result.score,
            "feedback": content_result.feedback,
            "details": content_result.details
        }
```

---

### 4. Storage and Review Layer

#### GeneratedQuestion Model

**Database Model** (`backend/app/models.py`)

```python
class GeneratedQuestionBase(SQLModel):
    question_data: dict = Field(sa_column=Column(JSON))
    template_id: uuid.UUID | None = Field(foreign_key="questiontemplate.id")
    batch_id: uuid.UUID = Field(index=True)
    status: str = Field(max_length=20, default="pending")  # pending, approved, rejected
    validation_score: int | None = None
    validation_feedback: str | None = Field(default=None, max_length=1000)
    rejection_reason: str | None = Field(default=None, max_length=500)
    created_by: uuid.UUID = Field(foreign_key="user.id")

class GeneratedQuestion(GeneratedQuestionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: datetime | None = None
    reviewed_by: uuid.UUID | None = Field(foreign_key="user.id")
```

#### Review Service

**Location**: `backend/app/services/review_service.py`

```python
class ReviewService:
    """Handles review workflow for generated questions"""
    
    async def approve_question(
        self,
        generated_question_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        session: Session
    ) -> Question:
        """Approve and move to Question table"""
        
        # 1. Get generated question
        gen_q = session.get(GeneratedQuestion, generated_question_id)
        if not gen_q:
            raise ValueError("Generated question not found")
        
        # 2. Create Question from question_data
        question = Question(
            **gen_q.question_data,
            created_by=gen_q.created_by
        )
        session.add(question)
        
        # 3. Update GeneratedQuestion status
        gen_q.status = "approved"
        gen_q.reviewed_at = datetime.utcnow()
        gen_q.reviewed_by = reviewer_id
        
        session.commit()
        session.refresh(question)
        
        return question
    
    async def reject_question(
        self,
        generated_question_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        reason: str,
        session: Session
    ) -> None:
        """Reject a generated question"""
        
        gen_q = session.get(GeneratedQuestion, generated_question_id)
        if not gen_q:
            raise ValueError("Generated question not found")
        
        gen_q.status = "rejected"
        gen_q.rejection_reason = reason
        gen_q.reviewed_at = datetime.utcnow()
        gen_q.reviewed_by = reviewer_id
        
        session.commit()
    
    async def approve_batch(
        self,
        batch_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        session: Session
    ) -> dict:
        """Approve all questions in a batch"""
        
        questions = session.exec(
            select(GeneratedQuestion)
            .where(GeneratedQuestion.batch_id == batch_id)
            .where(GeneratedQuestion.status == "pending")
        ).all()
        
        approved = []
        for gen_q in questions:
            question = await self.approve_question(
                gen_q.id, reviewer_id, session
            )
            approved.append(question)
        
        return {
            "batch_id": batch_id,
            "approved_count": len(approved),
            "question_ids": [q.id for q in approved]
        }
```

---

## Data Flow

### Question Generation Flow

```
1. Teacher Initiates Generation
   │
   ├─→ [API] POST /api/v1/questions/generate
   │     Input: template_id, num_questions, skip_content_validation
   │
2. Load Template
   │
   ├─→ [TemplateService] Fetch template from DB or file
   │     Output: QuestionTemplate
   │
3. Render Prompt
   │
   ├─→ [TemplateService] Insert variables into template_prompt
   │     Output: Formatted prompt with examples
   │
4. Generate Questions
   │
   ├─→ [OpenAIProvider] Call OpenAI API
   │     Output: Raw question JSON array
   │
5. Validate (Stage 1: Format)
   │
   ├─→ [FormatValidator] Check HTML, schema, choices
   │     Pass → Continue | Fail → Mark as failed
   │
6. Validate (Stage 2: Content) [Optional]
   │
   ├─→ [ContentValidator] LLM-based quality check
   │     Pass → Continue | Fail → Flag for review
   │
7. Store Generated Questions
   │
   ├─→ [Database] Insert into GeneratedQuestion table
   │     Status: "pending"
   │
8. Return Result
   │
   └─→ [API Response] batch_id, success count, validation details
```

### Review and Approval Flow

```
1. Teacher Views Generated Questions
   │
   ├─→ [API] GET /api/v1/questions/generated
   │     Filters: status=pending, batch_id, subject
   │
2. Preview Question
   │
   ├─→ [Frontend] Render with QuestionDisplay component
   │     Shows: Formatted HTML, code, math, validation score
   │
3. Teacher Decision
   │
   ├─→ Approve
   │   │
   │   ├─→ [API] POST /api/v1/questions/generated/{id}/approve
   │   │
   │   ├─→ [ReviewService] Move to Question table
   │   │     Update status to "approved"
   │   │
   │   └─→ [Response] Created Question object
   │
   └─→ Reject
       │
       ├─→ [API] POST /api/v1/questions/generated/{id}/reject
       │     Input: rejection_reason
       │
       ├─→ [ReviewService] Update status to "rejected"
       │
       └─→ [Response] Success confirmation
```

---

## Database Schema

### New Models

#### QuestionTemplate Table

```sql
CREATE TABLE questiontemplate (
    id UUID PRIMARY KEY,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(100),
    difficulty VARCHAR(20) NOT NULL,
    template_prompt VARCHAR(2000) NOT NULL,
    example_questions JSON NOT NULL,
    constraints JSON DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES user(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_template_subject ON questiontemplate(subject);
CREATE INDEX idx_template_active ON questiontemplate(is_active);
```

#### GeneratedQuestion Table

```sql
CREATE TABLE generatedquestion (
    id UUID PRIMARY KEY,
    question_data JSON NOT NULL,
    template_id UUID REFERENCES questiontemplate(id),
    batch_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    validation_score INTEGER,
    validation_feedback VARCHAR(1000),
    rejection_reason VARCHAR(500),
    created_by UUID NOT NULL REFERENCES user(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewed_by UUID REFERENCES user(id)
);

CREATE INDEX idx_generated_batch ON generatedquestion(batch_id);
CREATE INDEX idx_generated_status ON generatedquestion(status);
CREATE INDEX idx_generated_created_by ON generatedquestion(created_by);
```

### Relationships

```
User ──┬─── creates ───→ QuestionTemplate
       │
       ├─── generates ──→ GeneratedQuestion
       │
       ├─── reviews ────→ GeneratedQuestion
       │
       └─── creates ────→ Question (existing)

QuestionTemplate ──── used in ──→ GeneratedQuestion

GeneratedQuestion ── approved → Question
```

---

## API Endpoints

All question generation endpoints are prefixed with `/api/v1/question-generation/` to avoid conflicts with the regular questions API.

### Generation Endpoints

#### POST /api/v1/question-generation/generate

Generate a batch of questions using a template.

**Authorization**: Teachers and superusers only

**Request Body**:
```json
{
  "template_id": "uuid",
  "num_questions": 5,
  "skip_content_validation": false,
  "temperature": 0.7
}
```

**Response** (200 OK):
```json
{
  "batch_id": "uuid",
  "total_requested": 5,
  "successful": 4,
  "failed": 1,
  "questions": [
    {
      "id": "uuid",
      "status": "pending",
      "validation_score": 85,
      "question_preview": "What is the output..."
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Invalid template_id or parameters
- `403 Forbidden`: User lacks teacher permissions
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Generation failure
- `503 Service Unavailable`: Question generation is disabled

---

#### GET /api/v1/question-generation/generated

List generated questions pending review.

**Authorization**: Teachers and superusers only

**Query Parameters**:
- `skip` (int): Pagination offset
- `limit` (int): Results per page (max 100)
- `status` (string): Filter by status (pending, approved, rejected)
- `batch_id` (uuid): Filter by batch
- `subject` (string): Filter by subject
- `min_score` (int): Minimum validation score

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "question_data": {...},
      "template_id": "uuid",
      "batch_id": "uuid",
      "status": "pending",
      "validation_score": 82,
      "validation_feedback": "Good question but...",
      "generated_at": "2025-11-24T10:30:00Z"
    }
  ],
  "count": 15,
  "total": 45,
  "skip": 0,
  "limit": 20
}
```

---

#### POST /api/v1/question-generation/generated/{question_id}/approve

Approve a generated question and move to main Question table.

**Authorization**: Teachers and superusers only

**Response** (200 OK):
```json
{
  "id": "uuid",
  "question_text": "...",
  "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answers": ["A"],
  "subject": "JavaScript",
  "topic": "Scope"
}
```

**Error Responses**:
- `404 Not Found`: Generated question not found
- `409 Conflict`: Question already reviewed

---

#### POST /api/v1/question-generation/generated/{question_id}/reject

Reject a generated question.

**Authorization**: Teachers and superusers only

**Request Body**:
```json
{
  "reason": "Incorrect answer explanation"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "message": "Question rejected",
  "reason": "Incorrect answer explanation"
}
```

---

#### POST /api/v1/question-generation/generated/batch/{batch_id}/approve-all

Approve all pending questions in a batch.

**Authorization**: Teachers and superusers only

**Response** (200 OK):
```json
{
  "batch_id": "uuid",
  "approved_count": 8,
  "question_ids": ["uuid1", "uuid2", ...]
}
```

---

### Template Endpoints

#### GET /api/v1/question-templates/

List available templates (both file-based and database).

**Authorization**: Teachers and superusers only

**Query Parameters**:
- `subject` (string): Filter by subject
- `difficulty` (string): Filter by difficulty
- `is_active` (boolean): Filter by active status

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "subject": "JavaScript",
      "topic": "Scope",
      "difficulty": "medium",
      "template_prompt": "Generate a question about...",
      "example_count": 3,
      "source": "database"
    }
  ],
  "count": 12
}
```

---

#### POST /api/v1/question-templates/

Create a custom question template.

**Authorization**: Teachers and superusers only

**Request Body**:
```json
{
  "subject": "Python",
  "topic": "List Comprehensions",
  "difficulty": "hard",
  "template_prompt": "Create a challenging question about...",
  "example_questions": [
    {
      "question_text": "<p>Example question</p>",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answers": ["A"]
    }
  ],
  "constraints": {
    "require_code": true,
    "code_language": "python"
  }
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "subject": "Python",
  "message": "Template created successfully"
}
```

---

#### GET /api/v1/question-templates/{id}

Get a specific template with full details.

**Authorization**: Teachers and superusers only

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subject": "JavaScript",
  "topic": "Scope",
  "difficulty": "medium",
  "template_prompt": "Full prompt text...",
  "example_questions": [...],
  "constraints": {...},
  "created_by": "uuid",
  "created_at": "2025-11-24T10:00:00Z"
}
```

---

## Technology Stack

### Core Dependencies

#### Already Installed

- **openai** (v2.8.1): OpenAI API client for question generation and validation
- **pydantic** (v2.x): Data validation and settings management (already in project)
- **python-dotenv**: Environment variable management (already in project)

#### To Install

**Required**:
```bash
uv pip install html5lib beautifulsoup4 bleach tenacity
```

- **html5lib**: HTML5 parsing and validation
- **beautifulsoup4**: HTML parsing and manipulation
- **bleach**: HTML sanitization for security
- **tenacity**: Retry logic with exponential backoff

**Optional (Future)**:
```bash
uv pip install jinja2 anthropic litellm
```

- **jinja2**: Advanced template rendering (if needed)
- **anthropic**: Claude API support
- **litellm**: Unified interface for multiple LLM providers

### Frontend Dependencies

No new frontend dependencies required. Use existing:
- **@tanstack/react-query**: API calls and caching
- **React components**: Reuse QuestionDisplay for preview

---

## Configuration

### Environment Variables

Add to `.env` file:

```bash
# Question Generation Configuration
OPENAI_API_KEY=sk-...                          # Already present
QUESTION_GENERATION_ENABLED=true               # Feature flag
CONTENT_VALIDATION_THRESHOLD=70                # Min score for auto-approval
MAX_GENERATION_BATCH_SIZE=20                   # Max questions per request
OPENAI_MODEL=gpt-5-mini-2025-08-07                       # Model for generation
VALIDATION_MODEL=gpt-5-mini-2025-08-07                   # Model for validation
GENERATION_TEMPERATURE=0.7                     # Creativity level (0.0-1.0)
GENERATION_RATE_LIMIT=50                       # Max requests per minute
```

### Application Settings

Update `backend/app/core/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    # Question Generation Settings
    openai_api_key: str
    question_generation_enabled: bool = True
    content_validation_threshold: int = 70
    max_generation_batch_size: int = 20
    openai_model: str = "gpt-5-mini-2025-08-07"
    validation_model: str = "gpt-5-mini-2025-08-07"
    generation_temperature: float = 0.7
    generation_rate_limit: int = 50
```

---

## Error Handling

### Error Categories

1. **Validation Errors** (400)
   - Invalid template
   - Malformed request
   - Schema validation failure

2. **Authentication Errors** (401, 403)
   - Missing API key
   - Insufficient permissions
   - Invalid user token

3. **Rate Limit Errors** (429)
   - Too many requests
   - API quota exceeded

4. **Generation Errors** (500)
   - LLM API failure
   - Timeout
   - Parsing errors

5. **Database Errors** (500)
   - Connection failure
   - Constraint violation

### Retry Strategy

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((TimeoutError, ConnectionError))
)
async def generate_with_retry(...):
    """Generation with automatic retry"""
    pass
```

### Error Logging

```python
import logging

logger = logging.getLogger(__name__)

try:
    result = await generate_questions(...)
except OpenAIError as e:
    logger.error(f"OpenAI API error: {e}", exc_info=True)
    raise HTTPException(
        status_code=500,
        detail="Question generation failed. Please try again."
    )
except ValidationError as e:
    logger.warning(f"Validation error: {e}")
    raise HTTPException(
        status_code=400,
        detail=f"Invalid request: {str(e)}"
    )
```

---

## Security Considerations

### 1. HTML Sanitization

**Problem**: Generated questions contain HTML that could include malicious content.

**Solution**: Use `bleach` to sanitize all HTML before storage.

```python
import bleach

ALLOWED_TAGS = [
    'p', 'strong', 'em', 'code', 'pre', 'br',
    'ul', 'ol', 'li', 'span', 'div'
]

ALLOWED_ATTRIBUTES = {
    'code': ['class'],  # For language-* classes
    'span': ['class'],
    'div': ['class']
}

def sanitize_html(html: str) -> str:
    """Remove potentially dangerous HTML"""
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )
```

### 2. API Key Security

- Store OpenAI API key in `.env` (not in code)
- Use environment variables
- Rotate keys periodically
- Monitor usage and costs

### 3. Rate Limiting

**Protect against**:
- API abuse
- Cost overruns
- DoS attacks

**Implementation**:

```python
from datetime import datetime, timedelta
from collections import defaultdict

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    async def check_limit(self, user_id: str) -> bool:
        """Check if user exceeded rate limit"""
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=self.window_seconds)
        
        # Remove old requests
        self.requests[user_id] = [
            req_time for req_time in self.requests[user_id]
            if req_time > cutoff
        ]
        
        # Check limit
        if len(self.requests[user_id]) >= self.max_requests:
            return False
        
        self.requests[user_id].append(now)
        return True
```

### 4. Input Validation

- Validate all user inputs with Pydantic
- Limit template prompt length
- Restrict batch sizes
- Validate template structure

### 5. Access Control

- Only teachers and superusers can generate questions
- Users can only view their own generated questions (unless superuser)
- Separate permissions for template creation

---

## Frontend Implementation

### AI Question Generation UI

The frontend provides a complete user interface for the question generation workflow at `/admin/ai-generate`.

#### Components

**Location**: `frontend/src/components/QuestionGeneration/`

1. **GenerateForm.tsx** - Configuration form with:
   - Subject input (required, searchable dropdown with "add new")
   - Topic input (optional, searchable dropdown with "add new")
   - Number of questions slider (1-5)
   - AI Content Validation checkbox
   - Temperature/creativity slider (0.3-1.0)

2. **GeneratedQuestionPreview.tsx** - Preview card displaying:
   - Rich text question with code syntax highlighting and math equations
   - All 4 choices with correct answer indicators
   - Validation score badge (color-coded by score)
   - Validation feedback
   - Accept/Reject action buttons

3. **RejectDialog.tsx** - Modal for rejection feedback:
   - Required rejection reason textarea
   - Form validation
   - Submit and cancel actions

#### Main Page

**Location**: `frontend/src/routes/_layout/admin/ai-generate.tsx`

**Features**:
- Template auto-lookup/creation (finds existing or creates default)
- Batch question generation with loading states
- Real-time preview of generated questions
- Individual accept/reject actions
- Toast notifications for all operations
- Empty states (initial and completion)
- Responsive design with Tailwind CSS

#### User Flow

1. User navigates to Admin → AI Generate in sidebar
2. Fills in subject (required) and optional topic
3. Configures number of questions and validation options
4. Clicks "Generate Questions"
5. System finds/creates template and generates via OpenAI
6. Questions appear in preview cards
7. User reviews each question and accepts or rejects
8. Accepted questions are added to question bank
9. Toast notifications confirm each action

#### Integration

- **API Client**: Auto-generated TypeScript client (`frontend/src/client/`)
- **State Management**: React Query for server state, local state for UI
- **Toasts**: Sonner toast library with custom hook (`frontend/src/hooks/use-toast.ts`)
- **Rich Text**: Reuses existing `QuestionDisplay` component for consistent rendering
- **Styling**: Tailwind CSS with shadcn/ui components

---

## Future Enhancements

### Phase 2 Features

1. **Multiple LLM Providers**
   - Add Claude (Anthropic) support
   - Add Google Gemini support
   - Provider selection in UI

2. **Advanced Templates**
   - Template versioning
   - Template sharing between teachers
   - Template marketplace

3. **Enhanced Validation**
   - Plagiarism detection
   - Similarity checking with existing questions
   - Automated difficulty calibration

4. **Analytics Dashboard**
   - Generation success rates
   - Validation score distributions
   - Cost tracking per subject
   - Teacher productivity metrics

5. **Bulk Operations**
   - Import templates from CSV
   - Export questions to various formats
   - Bulk regeneration with feedback

6. **AI Improvements**
   - Fine-tuned models for specific subjects
   - Custom embeddings for question similarity
   - Automated difficulty adjustment based on student performance

7. **Integration Features**
   - LMS integration (Canvas, Moodle)
   - Question bank import/export
   - API for external tools

---

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)

- [ ] Create database models (QuestionTemplate, GeneratedQuestion)
- [ ] Generate and apply Alembic migrations
- [ ] Implement LLM provider abstraction
- [ ] Implement OpenAI provider
- [ ] Create default template JSON files

### Phase 2: Services (Week 2-3)

- [ ] Implement TemplateService
- [ ] Implement FormatValidator
- [ ] Implement ContentValidator
- [ ] Implement QuestionGeneratorService
- [ ] Implement ReviewService
- [ ] Add rate limiting

### Phase 3: API Layer (Week 3-4)

- [ ] Create generation endpoints
- [ ] Create template management endpoints
- [ ] Create review endpoints
- [ ] Add authentication and authorization
- [ ] Add error handling and logging

### Phase 4: Frontend (Week 4-5)

- [ ] Create template management UI
- [ ] Create generation interface
- [ ] Create review dashboard
- [ ] Add batch operations UI
- [ ] Add validation score displays

### Phase 5: Testing & Documentation (Week 5-6)

- [ ] Write unit tests for validators
- [ ] Write integration tests for generation flow
- [ ] Test with real OpenAI API
- [ ] Create user documentation
- [ ] Performance testing and optimization

---

## Conclusion

This architecture provides a robust, scalable foundation for AI-powered question generation. The modular design allows for incremental implementation and future enhancements while maintaining code quality and security standards.

**Key Benefits**:
- **Quality Control**: Multi-layer validation ensures high-quality output
- **Flexibility**: Template system adapts to different subjects and styles
- **Scalability**: Batch generation and caching optimize costs
- **Extensibility**: Abstract interfaces support future LLM providers
- **Security**: HTML sanitization and input validation prevent vulnerabilities
- **User Control**: Teacher review workflow maintains human oversight

**Next Steps**:
1. Review and approve this architecture
2. Begin Phase 1 implementation (database models)
3. Set up development environment with required dependencies
4. Create first default template (JavaScript scope)
5. Implement and test OpenAI integration

