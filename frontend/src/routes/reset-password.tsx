import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useId } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type ApiError, LoginService, type NewPassword } from "@/client"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { confirmPasswordRules, handleError, passwordRules } from "@/utils"

interface NewPasswordForm extends NewPassword {
  confirm_password: string
}

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

function ResetPassword() {
  const newPasswordId = useId()
  const confirmPasswordId = useId()
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<NewPasswordForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      new_password: "",
    },
  })
  const { showSuccessToast } = useCustomToast()
  const navigate = useNavigate()

  const resetPassword = async (data: NewPassword) => {
    const token = new URLSearchParams(window.location.search).get("token")
    if (!token) return
    await LoginService.resetPassword({
      requestBody: { new_password: data.new_password, token: token },
    })
  }

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      showSuccessToast("Password updated successfully.")
      reset()
      navigate({ to: "/login" })
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<NewPasswordForm> = async (data) => {
    mutation.mutate(data)
  }

  return (
    <Container maxW="sm" centerContent className="h-screen">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 w-full items-stretch justify-center"
      >
        <h1 className="text-3xl font-bold text-primary text-center mb-2">
          Reset Password
        </h1>
        <p className="text-center text-muted-foreground">
          Please enter your new password and confirm it to reset your password.
        </p>

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

        <Button type="submit" className="w-full">
          Reset Password
        </Button>
      </form>
    </Container>
  )
}
