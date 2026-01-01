import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { SubjectsService, TopicsService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

export interface GenerateFormData {
  subject: string
  topic?: string
  num_questions: number
  skip_content_validation: boolean
  custom_prompt?: string
}

interface GenerateFormProps {
  onSubmit: (data: GenerateFormData) => void
  isLoading: boolean
}

export function GenerateForm({ onSubmit, isLoading }: GenerateFormProps) {
  const skipValidationId = useId()
  const customPromptId = useId()
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GenerateFormData>({
    defaultValues: {
      subject: "",
      topic: "",
      num_questions: 1,
      skip_content_validation: true,
      custom_prompt: "",
    },
  })

  const [numQuestions, setNumQuestions] = useState(1)
  const [skipValidation, setSkipValidation] = useState(true)

  // Fetch subjects and topics
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => SubjectsService.readSubjects({}),
  })

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: () => TopicsService.readTopics({}),
  })

  const subjects = subjectsData?.data || []
  const topics = topicsData?.data || []

  const handleFormSubmit = (data: GenerateFormData) => {
    onSubmit({
      ...data,
      num_questions: numQuestions,
      skip_content_validation: skipValidation,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Configure Generation</CardTitle>
        <CardDescription>
          Specify the subject and topic for AI question generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Combobox
              options={subjects.map((s) => s.name)}
              value={watch("subject")}
              onValueChange={(value: string) => setValue("subject", value)}
              placeholder="Select or add subject..."
              emptyText="No subjects found"
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          {/* Topic Field */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic (Optional)</Label>
            <Combobox
              options={topics.map((t) => t.name)}
              value={watch("topic") || ""}
              onValueChange={(value: string) => setValue("topic", value)}
              placeholder="Select or add topic..."
              emptyText="No topics found"
            />
          </div>

          {/* Custom Prompt Field */}
          <div className="space-y-2">
            <Label htmlFor={customPromptId}>
              Custom Instructions (Optional)
            </Label>
            <Textarea
              id={customPromptId}
              value={watch("custom_prompt") || ""}
              onChange={(e) => setValue("custom_prompt", e.target.value)}
              placeholder="E.g., 'Focus on async/await edge cases' or 'Include error handling questions' or 'Test understanding of closures in practical scenarios'"
              rows={3}
              className="resize-none"
            />
            <p className="text-sm text-gray-500">
              Provide additional context or specific guidance for question
              generation
            </p>
          </div>

          {/* Number of Questions */}
          <div className="space-y-2">
            <Label htmlFor="num_questions">
              Number of Questions: {numQuestions}
            </Label>
            <Slider
              value={[numQuestions]}
              onValueChange={(values: number[]) => setNumQuestions(values[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Generate between 1 and 5 questions at once
            </p>
          </div>

          {/* AI Content Validation */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id={skipValidationId}
              checked={!skipValidation}
              onCheckedChange={(checked) => setSkipValidation(!checked)}
            />
            <Label
              htmlFor={skipValidationId}
              className="text-sm font-normal cursor-pointer"
            >
              Enable AI Content Validation (checks quality, relevance, and
              difficulty)
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !watch("subject")}
            className="w-full"
          >
            {isLoading ? "Generating..." : "Generate Questions"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
