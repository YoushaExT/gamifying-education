import { useMutation, useQueryClient } from "@tanstack/react-query"

import { QuestionsService } from "@/client"
import type { ApiError } from "@/client/core/ApiError"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/hooks/useConfirm"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

interface DeleteQuestionProps {
  questionId: string
  questionText: string
  children: React.ReactNode
}

const DeleteQuestion = ({
  questionId,
  questionText,
  children,
}: DeleteQuestionProps) => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const { confirm } = useConfirm()

  const mutation = useMutation({
    mutationFn: () => QuestionsService.deleteQuestion({ id: questionId }),
    onSuccess: () => {
      showSuccessToast("Question deleted successfully.")
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] })
    },
  })

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmed = await confirm({
      title: "Delete Question",
      description: (
        <>
          Are you sure you want to delete this question?
          <br />
          <span className="font-semibold mt-2 block">
            "{questionText.substring(0, 100)}
            {questionText.length > 100 ? "..." : ""}"
          </span>
          <br />
          This action cannot be undone.
        </>
      ),
      confirmText: mutation.isPending ? "Deleting..." : "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    })

    if (confirmed) {
      mutation.mutate()
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={handleDelete}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleDelete(e as any)
        }
      }}
      className="h-auto w-auto p-0 hover:bg-transparent"
      asChild
    >
      {children}
    </Button>
  )
}

export default DeleteQuestion
