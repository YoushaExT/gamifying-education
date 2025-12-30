import { useMutation } from "@tanstack/react-query"
import { useId } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ApiError, type UpdatePassword, UsersService } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { confirmPasswordRules, handleError, passwordRules } from "@/utils"
import { Button } from "../ui/button"
import { Container } from "../ui/container"
import { Label } from "../ui/label"
import { PasswordInput } from "../ui/password-input"

interface UpdatePasswordForm extends UpdatePassword {
  confirm_password: string
}

const ChangePassword = () => {
  const { showSuccessToast } = useCustomToast()
  const currentPasswordId = useId()
  const newPasswordId = useId()
  const confirmPasswordId = useId()
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    mode: "onBlur",
    criteriaMode: "all",
  })

  const mutation = useMutation({
    mutationFn: (data: UpdatePassword) =>
      UsersService.updatePasswordMe({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Password updated successfully.")
      reset()
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<UpdatePasswordForm> = async (data) => {
    mutation.mutate(data)
  }

  return (
    <Container maxW="full">
      <h2 className="text-lg font-semibold py-4">Change Password</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-4 w-full md:w-96">
          <div className="space-y-2">
            <Label htmlFor={currentPasswordId}>Current Password</Label>
            <PasswordInput
              id={currentPasswordId}
              {...register("current_password", passwordRules())}
              placeholder="Current Password"
            />
            {errors.current_password && (
              <p className="text-sm text-destructive">
                {errors.current_password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={newPasswordId}>New Password</Label>
            <PasswordInput
              id={newPasswordId}
              {...register("new_password", passwordRules())}
              placeholder="New Password"
            />
            {errors.new_password && (
              <p className="text-sm text-destructive">
                {errors.new_password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={confirmPasswordId}>Confirm Password</Label>
            <PasswordInput
              id={confirmPasswordId}
              {...register("confirm_password", confirmPasswordRules(getValues))}
              placeholder="Confirm Password"
            />
            {errors.confirm_password && (
              <p className="text-sm text-destructive">
                {errors.confirm_password.message}
              </p>
            )}
          </div>
        </div>
        <Button type="submit" className="mt-4" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </form>
    </Container>
  )
}

export default ChangePassword
