import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
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
import { DraggableChoice } from "../Questions/DraggableChoice"
import { RejectDialog } from "./RejectDialog"

interface ChoiceItem {
  id: string
  text: string
}

export interface GeneratedQuestionData {
  id: string
  question_data: {
    question_text: string
    choices: string[]
    correct_answers: number[] // Changed from string[] to number[]
    subject: string
    topic?: string
    difficulty?: string
    question_type?: string
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
  onAccept: (
    id: string,
    modifiedData?: { choices: string[]; correct_answers: number[] },
  ) => Promise<void>
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

  // Local state for drag-drop reordering
  const [choices, setChoices] = useState<ChoiceItem[]>([])
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([])

  const { question_data, validation_score, validation_feedback } = question

  // Initialize choices and correct answers from question data
  useEffect(() => {
    const initialChoices = question_data.choices.map((choice, idx) => ({
      id: `choice-${idx + 1}`,
      text: choice,
    }))
    setChoices(initialChoices)
    setCorrectAnswers(question_data.correct_answers)
  }, [question_data.choices, question_data.correct_answers])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = choices.findIndex((c) => c.id === active.id)
    const newIndex = choices.findIndex((c) => c.id === over.id)

    // Reorder choices
    const newChoices = arrayMove(choices, oldIndex, newIndex)
    setChoices(newChoices)

    // Update correct_answers indices
    const newCorrectAnswers = correctAnswers.map((idx) => {
      if (idx === oldIndex) return newIndex
      if (idx > oldIndex && idx <= newIndex) return idx - 1
      if (idx < oldIndex && idx >= newIndex) return idx + 1
      return idx
    })
    setCorrectAnswers(newCorrectAnswers)
  }

  const handleChoiceTextChange = (index: number, text: string) => {
    const newChoices = [...choices]
    newChoices[index].text = text
    setChoices(newChoices)
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      // Pass modified choices and correct_answers to onAccept
      const modifiedData = {
        choices: choices.map((c) => c.text),
        correct_answers: correctAnswers,
      }
      await onAccept(question.id, modifiedData)
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

          {/* Choices with Drag-Drop */}
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Choices{" "}
              <span className="text-sm text-muted-foreground ml-2">
                (Drag to reorder)
              </span>
            </p>

            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={choices.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {choices.map((choice, index) => (
                    <DraggableChoice
                      key={choice.id}
                      id={choice.id}
                      index={index}
                      text={choice.text}
                      isCorrect={correctAnswers.includes(index)}
                      onTextChange={(text) =>
                        handleChoiceTextChange(index, text)
                      }
                      onCorrectChange={() => {}} // Read-only correct answers in preview
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
