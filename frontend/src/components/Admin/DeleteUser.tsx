import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"

import { UsersService } from "@/client"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/hooks/useConfirm"
import useCustomToast from "@/hooks/useCustomToast"

const DeleteUser = ({ id }: { id: string }) => {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const { confirm } = useConfirm()

  const deleteUser = async (id: string) => {
    await UsersService.deleteUser({ userId: id })
  }

  const mutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      showSuccessToast("The user was deleted successfully")
    },
    onError: () => {
      showErrorToast("An error occurred while deleting the user")
    },
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete User",
      description: (
        <>
          All items associated with this user will also be{" "}
          <strong>permanently deleted.</strong> Are you sure? You will not be
          able to undo this action.
        </>
      ),
      confirmText: mutation.isPending ? "Deleting..." : "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    })

    if (confirmed) {
      mutation.mutate(id)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={handleDelete}
      disabled={mutation.isPending}
    >
      <Trash2 className="size-4" />
      Delete User
    </Button>
  )
}

export default DeleteUser
