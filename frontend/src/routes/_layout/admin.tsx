import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/admin")({
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = useAuth()

  // Redirect if user is not a teacher or superuser
  if (!user?.is_teacher && !user?.is_superuser) {
    redirect({ to: "/" })
    return null
  }

  return <Outlet />
}
