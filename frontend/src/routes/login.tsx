import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { Mail } from "lucide-react"
import { useId } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { emailPattern, passwordRules } from "../utils"

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

function Login() {
  const { loginMutation, error, resetError } = useAuth()
  const emailId = useId()
  const passwordId = useId()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessToken>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    if (isSubmitting) return

    resetError()

    try {
      await loginMutation.mutateAsync(data)
    } catch {
      // error is handled by useAuth hook
    }
  }

  return (
    <Container maxW="sm" centerContent className="h-screen">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 w-full items-stretch justify-center"
      >
        <h1 className="text-3xl font-bold text-center mb-4">
          Gamifying Education
        </h1>

        <div className="space-y-2">
          <Label htmlFor={emailId}>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id={emailId}
              {...register("username", {
                required: "Username is required",
                pattern: emailPattern,
              })}
              placeholder="Email"
              type="email"
              className="pl-10"
            />
          </div>
          {(errors.username || error) && (
            <p className="text-sm text-destructive">
              {errors.username?.message || "Invalid credentials"}
            </p>
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

        <RouterLink
          to="/recover-password"
          className="text-primary font-semibold hover:underline"
        >
          Forgot Password?
        </RouterLink>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Logging in..." : "Log In"}
        </Button>

        <p className="text-center text-sm">
          Don't have an account?{" "}
          <RouterLink
            to="/signup"
            className="text-primary font-semibold hover:underline"
          >
            Sign Up
          </RouterLink>
        </p>
      </form>
    </Container>
  )
}
