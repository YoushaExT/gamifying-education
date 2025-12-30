import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useState } from "react"
import { QuestionDisplay } from "@/components/Questions/QuestionDisplay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RejectDialog } from "./RejectDialog"

export interface GeneratedQuestionData {
  id: string
  question_data: {
    question_text: string
    choices: string[]
    correct_answers: string[]
    subject: string
    topic?: string
  }
  status: string
  validation_score?: number
  validation_feedback?: string
  subtopic?: string | null
  question_type?: string | null
  diversity_score?: number | null
}

interface GeneratedQuestionPreviewProps {
  question: GeneratedQuestionData
  index: number
  onAccept: (id: string) => Promise<void>
  onReject: (id: string, reason: string) => Promise<void>
  isProcessing: boolean
}

export function GeneratedQuestionPreview({
  question,
  index,
  onAccept,
  onReject,
  isProcessing,
}: GeneratedQuestionPreviewProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const { question_data, validation_score, validation_feedback } = question

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      await onAccept(question.id)
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async (reason: string) => {
    setIsRejecting(true)
    try {
      await onReject(question.id, reason)
      setIsRejectDialogOpen(false)
    } finally {
      setIsRejecting(false)
    }
  }

  const getScoreColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-700"
    if (score >= 80) return "bg-green-100 text-green-700"
    if (score >= 60) return "bg-yellow-100 text-yellow-700"
    return "bg-red-100 text-red-700"
  }

  const choiceLetters = ["A", "B", "C", "D"]

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Generated Question #{index + 1}
            </CardTitle>
            {validation_score !== undefined && (
              <Badge className={getScoreColor(validation_score)}>
                Score: {validation_score}/100
              </Badge>
            )}
          </div>
          <CardDescription>
            {question_data.subject}
            {question_data.topic && ` • ${question_data.topic}`}
          </CardDescription>

          {/* Diversity Metadata */}
          {(question.subtopic ||
            question.question_type ||
            question.diversity_score !== undefined) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {question.subtopic && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200"
                >
                  📚 {question.subtopic}
                </Badge>
              )}
              {question.question_type && (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  🎯 {question.question_type}
                </Badge>
              )}
              {question.diversity_score !== null &&
                question.diversity_score !== undefined && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    ⚖️ Diversity: {question.diversity_score.toFixed(3)}
                  </Badge>
                )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Question Text */}
          <div>
            <QuestionDisplay html={question_data.question_text} />
          </div>

          {/* Choices */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Choices:</p>
            {question_data.choices.map((choice, idx) => {
              const choiceLetter = choiceLetters[idx]
              const isCorrect =
                question_data.correct_answers.includes(choiceLetter)

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded-md border ${
                    isCorrect
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      isCorrect
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {choiceLetter}
                  </span>
                  <span className="flex-1 text-sm">{choice}</span>
                  {isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Validation Feedback */}
          {validation_feedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs font-medium text-blue-900 mb-1">
                AI Validation Feedback:
              </p>
              <p className="text-xs text-blue-800">{validation_feedback}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            onClick={handleAccept}
            disabled={isProcessing || isAccepting || isRejecting}
            className="flex-1"
            variant="default"
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsRejectDialogOpen(true)}
            disabled={isProcessing || isAccepting || isRejecting}
            className="flex-1"
            variant="destructive"
          >
            {isRejecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <RejectDialog
        open={isRejectDialogOpen}
        onOpenChange={setIsRejectDialogOpen}
        onReject={handleReject}
        isSubmitting={isRejecting}
      />
    </>
  )
}
