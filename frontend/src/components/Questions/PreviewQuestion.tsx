import { useState } from "react"

import type { QuestionPublic } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { QuestionDisplay } from "./QuestionDisplay"

interface PreviewQuestionProps {
  question: QuestionPublic
  children?: React.ReactNode
}

export default function PreviewQuestion({
  question,
  children,
}: PreviewQuestionProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Question Preview</DialogTitle>
          <DialogDescription>
            Preview how the question will appear to students
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Question Text */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Question
            </h3>
            <div className="border rounded-lg p-4 bg-muted/30">
              <QuestionDisplay html={question.question_text} />
            </div>
          </div>

          {/* Answer Choices */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Answer Choices
            </h3>
            <div className="space-y-2">
              {question.choices.map((choice, index) => {
                const isCorrect = question.correct_answers.includes(index)
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isCorrect
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${
                        isCorrect
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <QuestionDisplay html={choice} className="text-sm" />
                    </div>
                    {isCorrect && (
                      <span className="shrink-0 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                        Correct
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex gap-6 text-sm text-muted-foreground pt-4 border-t">
            <div>
              <span className="font-medium">Subject:</span>{" "}
              <span className="text-foreground">{question.subject}</span>
            </div>
            {question.topic && (
              <div>
                <span className="font-medium">Topic:</span>{" "}
                <span className="text-foreground">{question.topic}</span>
              </div>
            )}
            <div>
              <span className="font-medium">Correct Answers:</span>{" "}
              <span className="text-foreground">
                {question.correct_answers.length}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
