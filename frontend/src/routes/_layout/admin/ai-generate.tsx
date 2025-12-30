import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import { QuestionGenerationService, QuestionTemplatesService } from "@/client"
import {
  type GeneratedQuestionData,
  GeneratedQuestionPreview,
} from "@/components/QuestionGeneration/GeneratedQuestionPreview"
import {
  GenerateForm,
  type GenerateFormData,
} from "@/components/QuestionGeneration/GenerateForm"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export const Route = createFileRoute("/_layout/admin/ai-generate")({
  component: AIGeneratePage,
})

function AIGeneratePage() {
  const [generatedQuestions, setGeneratedQuestions] = useState<
    GeneratedQuestionData[]
  >([])
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Template lookup/creation helper
  const findOrCreateTemplate = async (
    subject: string,
    topic?: string,
  ): Promise<string> => {
    try {
      // First, try to find existing template matching both subject and topic
      const templates = await QuestionTemplatesService.listTemplates({
        subject,
        isActive: true,
      })

      if (templates.data && templates.data.length > 0) {
        // If topic is provided, only accept exact matches
        if (topic) {
          const matchingTemplate = templates.data.find((t) => t.topic === topic)
          if (matchingTemplate) {
            return matchingTemplate.id
          }
          // Topic provided but no match found -> create new template
        } else {
          // No topic provided, return first matching subject template
          return templates.data[0].id
        }
      }

      // If no matching template found, create a new one
      const newTemplate = await QuestionTemplatesService.createTemplate({
        requestBody: {
          subject,
          topic: topic || null,
          difficulty: "medium",
          template_prompt: `Generate a multiple-choice question about ${topic || subject} in ${subject}. The question should test understanding of key concepts. Provide 4 choices (A, B, C, D) with exactly one correct answer. Format the question text as HTML with proper tags for code or equations if needed.`,
          example_questions: [],
          constraints: {},
          is_active: true,
        },
      })

      return newTemplate.id
    } catch (error) {
      console.error("Failed to find or create template:", error)
      throw new Error("Unable to find or create template for generation")
    }
  }

  // Generate questions mutation
  const generateMutation = useMutation({
    mutationFn: async (formData: GenerateFormData) => {
      setIsGenerating(true)
      try {
        // Get or create template
        const templateId = await findOrCreateTemplate(
          formData.subject,
          formData.topic,
        )

        // Generate questions
        const response = await QuestionGenerationService.generateQuestions({
          requestBody: {
            template_id: templateId,
            num_questions: formData.num_questions,
            skip_content_validation: formData.skip_content_validation,
            temperature: formData.temperature,
          },
        })

        return response
      } finally {
        setIsGenerating(false)
      }
    },
    onSuccess: async (data) => {
      setCurrentBatchId(data.batch_id)

      toast({
        title: "Questions generated!",
        description: `Generated ${data.successful} of ${data.total_requested} questions successfully.`,
      })

      // Fetch the generated questions
      const generatedQuestionsResponse =
        await QuestionGenerationService.listGeneratedQuestions({
          batchId: data.batch_id,
          status: "pending",
        })

      setGeneratedQuestions(
        generatedQuestionsResponse.data.map((q) => ({
          id: q.id,
          question_data:
            q.question_data as GeneratedQuestionData["question_data"],
          validation_score: q.validation_score ?? undefined,
          validation_feedback: q.validation_feedback ?? undefined,
          status: q.status ?? "pending",
        })),
      )
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate questions",
        variant: "destructive",
      })
    },
  })

  // Accept question mutation
  const acceptMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return await QuestionGenerationService.approveGeneratedQuestion({
        questionId,
      })
    },
    onSuccess: (_, questionId) => {
      toast({
        title: "Question accepted",
        description: "Question has been added to the question bank.",
      })

      // Remove from list
      setGeneratedQuestions((prev) => prev.filter((q) => q.id !== questionId))

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["questions"] })
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept question",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
    },
  })

  // Reject question mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      questionId,
      reason,
    }: {
      questionId: string
      reason: string
    }) => {
      return await QuestionGenerationService.rejectGeneratedQuestion({
        questionId,
        requestBody: { reason },
      })
    },
    onSuccess: (_, { questionId }) => {
      toast({
        title: "Question rejected",
        description: "Your feedback has been recorded.",
      })

      // Remove from list
      setGeneratedQuestions((prev) => prev.filter((q) => q.id !== questionId))
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject question",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
    },
  })

  const handleGenerate = (formData: GenerateFormData) => {
    generateMutation.mutate(formData)
  }

  const handleAccept = async (questionId: string) => {
    await acceptMutation.mutateAsync(questionId)
  }

  const handleReject = async (questionId: string, reason: string) => {
    await rejectMutation.mutateAsync({ questionId, reason })
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-8 w-8 text-purple-500" />
        <div>
          <h1 className="text-3xl font-bold">AI Question Generation</h1>
          <p className="text-gray-500">
            Generate high-quality questions using AI
          </p>
        </div>
      </div>

      {/* Generation Form */}
      <GenerateForm onSubmit={handleGenerate} isLoading={isGenerating} />

      {/* Loading State */}
      {isGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto" />
              <p className="text-lg font-medium">Generating questions...</p>
              <p className="text-sm text-gray-500">
                This may take a few moments
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Questions */}
      {!isGenerating && generatedQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Review Generated Questions</CardTitle>
            <CardDescription>
              Review each question and accept or reject them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedQuestions.map((question, index) => (
              <GeneratedQuestionPreview
                key={question.id}
                question={question}
                index={index}
                onAccept={handleAccept}
                onReject={handleReject}
                isProcessing={
                  acceptMutation.isPending || rejectMutation.isPending
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State - All processed */}
      {!isGenerating && currentBatchId && generatedQuestions.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">All done!</AlertTitle>
          <AlertDescription className="text-green-800">
            You've reviewed all generated questions. Generate more to continue.
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State - Initial */}
      {!isGenerating && !currentBatchId && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-lg font-medium">No questions generated yet</p>
              <p className="text-sm text-gray-500">
                Fill in the form above to generate AI-powered questions
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
