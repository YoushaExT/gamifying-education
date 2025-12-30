import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type UserPublic,
  UsersService,
  type UserUpdateMe,
} from "@/client"
import useAuth from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { emailPattern, handleError } from "@/utils"
import { Button } from "../ui/button"
import { Container } from "../ui/container"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

const UserInformation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()
  const fullNameId = useId()
  const emailId = useId()
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<UserPublic>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name,
      email: currentUser?.email,
    },
  })

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("User updated successfully.")
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const onSubmit: SubmitHandler<UserUpdateMe> = async (data) => {
    mutation.mutate(data)
  }

  const onCancel = () => {
    reset()
    toggleEditMode()
  }

  return (
    <Container maxW="full">
      <h2 className="text-lg font-semibold py-4">User Information</h2>
      <form className="w-full sm:max-w-sm" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor={fullNameId}>Full name</Label>
          {editMode ? (
            <Input
              id={fullNameId}
              {...register("full_name", { maxLength: 30 })}
              type="text"
            />
          ) : (
            <p className="text-sm py-2 text-muted-foreground truncate max-w-sm">
              {currentUser?.full_name || "N/A"}
            </p>
          )}
        </div>

        <div className="space-y-2 mt-4">
          <Label htmlFor={emailId}>Email</Label>
          {editMode ? (
            <>
              <Input
                id={emailId}
                {...register("email", {
                  required: "Email is required",
                  pattern: emailPattern,
                })}
                type="email"
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm py-2 truncate max-w-sm">
              {currentUser?.email}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            type={editMode ? "submit" : "button"}
            onClick={editMode ? undefined : toggleEditMode}
            disabled={
              editMode ? !isDirty || !getValues("email") || isSubmitting : false
            }
          >
            {editMode ? (isSubmitting ? "Saving..." : "Save") : "Edit"}
          </Button>
          {editMode && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Container>
  )
}

export default UserInformation
