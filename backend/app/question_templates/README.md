# Question Templates

This directory contains default question templates for the AI question generation system.

## Template Format

Each template is a JSON file with the following structure:

```json
{
  "subject": "Subject Name",
  "topic": "Topic Name",
  "difficulty": "easy|medium|hard",
  "template_prompt": "Prompt with {variables} for the LLM",
  "example_questions": [
    {
      "question_text": "HTML formatted question",
      "choices": ["A. Choice 1", "B. Choice 2", "C. Choice 3", "D. Choice 4"],
      "correct_answers": ["A"],
      "subject": "Subject Name",
      "topic": "Topic Name",
      "explanation": "Optional explanation"
    }
  ],
  "constraints": {
    "require_code": true,
    "code_language": "javascript",
    "max_question_length": 500
  }
}
```

## Template Variables

The following variables can be used in `template_prompt`:

- `{subject}` - The subject name
- `{topic}` - The topic name
- `{difficulty}` - The difficulty level
- `{num_questions}` - Number of questions to generate

## Example Templates

### JavaScript Scope (Medium)
- **File**: `javascript-scope-medium.json`
- **Focus**: Variable scope, hoisting, closures
- **Includes**: Code snippets with syntax highlighting

## Adding New Templates

1. Create a new JSON file following the format above
2. Include 1-3 high-quality example questions
3. Use descriptive file naming: `{subject}-{topic}-{difficulty}.json`
4. Test the template by generating questions via the API

## Best Practices

- **Clear Instructions**: Make prompts specific and unambiguous
- **Quality Examples**: Provide 2-3 exemplary questions
- **Appropriate Difficulty**: Ensure examples match the difficulty level
- **HTML Formatting**: Use proper HTML tags for formatting
- **Code Blocks**: Use `<pre><code class="language-{lang}">` for code
- **Math Equations**: Use `$equation$` for inline or `$$equation$$` for block
- **Constraints**: Set appropriate constraints for the question type

## Template Validation

Templates are validated when loaded. Required fields:
- `subject` (string)
- `difficulty` (string: "easy", "medium", or "hard")
- `template_prompt` (string with placeholders)
- `example_questions` (array of at least 1 example)

Each example question must have:
- `question_text` (HTML string)
- `choices` (array of 4 strings)
- `correct_answers` (array of 1+ answer letters)





