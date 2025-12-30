import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { User } from "lucide-react"
import { useId } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import type { UserRegister } from "@/client"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { confirmPasswordRules, emailPattern, passwordRules } from "@/utils"

export const Route = createFileRoute("/signup")({
  component: SignUp,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

interface UserRegisterForm extends UserRegister {
  confirm_password: string
}

function SignUp() {
  const { signUpMutation } = useAuth()
  const fullNameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UserRegisterForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
    },
  })

  const onSubmit: SubmitHandler<UserRegisterForm> = (data) => {
    signUpMutation.mutate(data)
  }

  return (
    <div className="flex flex-col md:flex-row justify-center h-screen">
      <Container maxW="sm" centerContent className="h-screen">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 w-full items-stretch justify-center"
        >
          <h1 className="text-3xl font-bold text-center mb-4">
            Gamifying Education
          </h1>

          <div className="space-y-2">
            <Label htmlFor={fullNameId}>Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id={fullNameId}
                minLength={3}
                {...register("full_name", {
                  required: "Full Name is required",
                })}
                placeholder="Full Name"
                type="text"
                className="pl-10"
              />
            </div>
            {errors.full_name && (
              <p className="text-sm text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={emailId}>Email</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id={emailId}
                {...register("email", {
                  required: "Email is required",
                  pattern: emailPattern,
                })}
                placeholder="Email"
                type="email"
                className="pl-10"
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={passwordId}>Password</Label>
            <PasswordInput
              id={passwordId}
              {...register("password", passwordRules())}
              placeholder="Password"
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Signing up..." : "Sign Up"}
          </Button>

          <p className="text-center text-sm">
            Already have an account?{" "}
            <RouterLink
              to="/login"
              className="text-primary font-semibold hover:underline"
            >
              Log In
            </RouterLink>
          </p>
        </form>
      </Container>
    </div>
  )
}

export default SignUp
