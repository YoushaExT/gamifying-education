import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

interface Question {
  id: string
  question_text: string
  choices: string[]
  question_type?: string
}

interface QuestionPopupProps {
  isOpen: boolean
  question: Question | null
  cardName: string
  onSubmit: (selectedAnswers: number[]) => void
  isSubmitting?: boolean
}

export function QuestionPopup({
  isOpen,
  question,
  cardName,
  onSubmit,
  isSubmitting = false,
}: QuestionPopupProps) {
  // Store selected indices
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  const handleToggleAnswer = (index: number) => {
    if (!question) return

    if (question.question_type === "mcq") {
      // MCQ: single selection
      setSelectedIndices(new Set([index]))
    } else {
      // Multiselect: toggle selection
      setSelectedIndices((prev) => {
        const next = new Set(prev)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
    }
  }

  const handleSubmit = () => {
    if (selectedIndices.size > 0) {
      onSubmit(Array.from(selectedIndices))
      setSelectedIndices(new Set())
    }
  }

  if (!question) return null

  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-question-popup-gradient-top to-question-popup-gradient-bottom border-2 border-question-popup-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-question-popup-title">
            Playing: {cardName}
          </DialogTitle>
          <DialogDescription className="text-slate-700">
            Answer correctly for maximum effect!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Question text */}
          <div
            className="prose prose-sm max-w-none text-black [&_strong]:text-question-popup-bold-text [&_strong]:font-bold [&_b]:text-question-popup-bold-text [&_b]:font-bold"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted content from backend
            dangerouslySetInnerHTML={{ __html: question.question_text }}
          />

          {/* Choices */}
          <div className="space-y-3">
            {question.question_type === "mcq" ? (
              <RadioGroup
                value={
                  selectedIndices.size > 0
                    ? String(Array.from(selectedIndices)[0])
                    : undefined
                }
                onValueChange={(value) =>
                  handleToggleAnswer(Number.parseInt(value, 10))
                }
                className="space-y-3"
              >
                {question.choices.map((choice, index) => {
                  const label = String.fromCharCode(65 + index) // A, B, C, D
                  const isSelected = selectedIndices.has(index)

                  return (
                    <div
                      key={index}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-colors",
                        {
                          "border-question-popup-bold-text bg-amber-100/80":
                            isSelected,
                          "border-slate-400 hover:border-slate-500 bg-white/40":
                            !isSelected,
                          "opacity-50 cursor-not-allowed": isSubmitting,
                        },
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem
                          value={String(index)}
                          disabled={isSubmitting}
                          className="border-slate-700 data-[state=checked]:border-question-popup-bold-text data-[state=checked]:bg-question-popup-bold-text"
                        />
                        <span className="flex-1 text-left">
                          <span className="font-semibold text-black">
                            {label}.
                          </span>{" "}
                          <span
                            className="prose prose-sm max-w-none text-black inline"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted content
                            dangerouslySetInnerHTML={{ __html: choice }}
                          />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </RadioGroup>
            ) : (
              question.choices.map((choice, index) => {
                const label = String.fromCharCode(65 + index) // A, B, C, D
                const isSelected = selectedIndices.has(index)

                return (
                  <div
                    key={index}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 transition-colors",
                      {
                        "border-question-popup-bold-text bg-amber-100/80":
                          isSelected,
                        "border-slate-400 hover:border-slate-500 bg-white/40":
                          !isSelected,
                        "opacity-50 cursor-not-allowed": isSubmitting,
                      },
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isSubmitting}
                        onCheckedChange={() => handleToggleAnswer(index)}
                        className="border-slate-700 data-[state=checked]:border-question-popup-bold-text data-[state=checked]:bg-question-popup-bold-text"
                      />
                      <span className="flex-1 text-left">
                        <span className="font-semibold text-black">
                          {label}.
                        </span>{" "}
                        <span
                          className="prose prose-sm max-w-none text-black inline"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted content
                          dangerouslySetInnerHTML={{ __html: choice }}
                        />
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={selectedIndices.size === 0 || isSubmitting}
            className="w-full bg-question-popup-title text-white font-semibold"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Answer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default QuestionPopup
