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

// Answer options are always A, B, C, D
type AnswerLetter = "A" | "B" | "C" | "D"
const ANSWER_LETTERS: AnswerLetter[] = ["A", "B", "C", "D"]

interface Question {
  id: string
  question_text: string
  choices: string[]
}

interface QuestionPopupProps {
  isOpen: boolean
  question: Question | null
  cardName: string
  onSubmit: (selectedAnswers: AnswerLetter[]) => void
  isSubmitting?: boolean
}

export function QuestionPopup({
  isOpen,
  question,
  cardName,
  onSubmit,
  isSubmitting = false,
}: QuestionPopupProps) {
  // Store selected letters directly
  const [selectedLetters, setSelectedLetters] = useState<Set<AnswerLetter>>(
    new Set(),
  )

  const handleToggleAnswer = (letter: AnswerLetter) => {
    setSelectedLetters((prev) => {
      const next = new Set(prev)
      if (next.has(letter)) {
        next.delete(letter)
      } else {
        next.add(letter)
      }
      return next
    })
  }

  const handleSubmit = () => {
    if (selectedLetters.size > 0) {
      onSubmit(Array.from(selectedLetters))
      setSelectedLetters(new Set())
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
            {question.choices.map((choice, index) => {
              const letter = ANSWER_LETTERS[index]
              if (!letter) return null

              const isSelected = selectedLetters.has(letter)

              return (
                <button
                  key={letter}
                  type="button"
                  className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                    isSelected
                      ? "border-question-popup-bold-text bg-amber-100/80"
                      : "border-slate-400 hover:border-slate-500 bg-white/40"
                  }`}
                  onClick={() => handleToggleAnswer(letter)}
                  disabled={isSubmitting}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={isSubmitting}
                      className="border-slate-700 data-[state=checked]:border-question-popup-bold-text data-[state=checked]:bg-question-popup-bold-text"
                    />
                    <div
                      className="flex-1 prose prose-sm max-w-none text-black"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted content
                      dangerouslySetInnerHTML={{ __html: choice }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={selectedLetters.size === 0 || isSubmitting}
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
