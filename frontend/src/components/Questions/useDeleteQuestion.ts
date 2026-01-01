import { useMutation, useQueryClient } from "@tanstack/react-query"
import { QuestionsService } from "@/client"
import type { ApiError } from "@/client/core/ApiError"
import { useConfirm } from "@/hooks/useConfirm"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export function useDeleteQuestion() {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const { confirm } = useConfirm()

  const mutation = useMutation({
    mutationFn: (questionId: string) =>
      QuestionsService.deleteQuestion({ id: questionId }),
    onSuccess: () => {
      showSuccessToast("Question deleted successfully.")
      queryClient.invalidateQueries({ queryKey: ["questions"] })
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
  })

  const deleteQuestion = async (questionId: string, questionText: string) => {
    const truncatedText = questionText.substring(0, 100)
    const displayText =
      questionText.length > 100 ? `${truncatedText}...` : truncatedText

    const confirmed = await confirm({
      title: "Delete Question",
      description: `Are you sure you want to delete this question?\n\n"${displayText}"\n\nThis action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    })

    if (confirmed) {
      mutation.mutate(questionId)
    }
  }

  return { deleteQuestion, isDeleting: mutation.isPending }
}
