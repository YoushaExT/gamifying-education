import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type ApiError, UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { useConfirm } from "@/hooks/useConfirm"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const DeleteConfirmation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const { logout } = useAuth()
  const { confirm } = useConfirm()

  const mutation = useMutation({
    mutationFn: () => UsersService.deleteUserMe(),
    onSuccess: () => {
      showSuccessToast("Your account has been successfully deleted")
      logout()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Confirmation Required",
      description: (
        <>
          All your account data will be <strong>permanently deleted.</strong> If
          you are sure, please click <strong>"Confirm"</strong> to proceed. This
          action cannot be undone.
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
      variant="destructive"
      className="mt-4"
      onClick={handleDelete}
      disabled={mutation.isPending}
    >
      Delete
    </Button>
  )
}

export default DeleteConfirmation
