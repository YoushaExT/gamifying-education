import { useQuery } from "@tanstack/react-query"
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"
import { FeatureFlagsService } from "@/client"
import useAuth from "@/hooks/useAuth"

interface FeatureFlags {
  ai_question_generation: boolean
  quiz_system: boolean
  quiz_timer: boolean
}

interface FeatureFlagsContextType {
  flags: FeatureFlags
  isLoading: boolean
  isEnabled: (flagKey: string) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(
  undefined,
)

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FeatureFlags>({
    ai_question_generation: false,
    quiz_system: false,
    quiz_timer: false,
  })

  // Fetch feature flags when user changes
  const { data: flagsData, isLoading } = useQuery({
    queryKey: ["featureFlags", user?.id],
    queryFn: () => FeatureFlagsService.listFeatureFlagsForUser({}),
    enabled: !!user,
  })

  useEffect(() => {
    if (flagsData?.data) {
      // Process flags and determine enabled state for each
      const newFlags: FeatureFlags = {
        ai_question_generation: false,
        quiz_system: false,
        quiz_timer: false,
      }

      for (const flag of flagsData.data) {
        if (
          flag.key === "ai_question_generation" ||
          flag.key === "quiz_system" ||
          flag.key === "quiz_timer"
        ) {
          // Check if enabled globally, for user, or for user's role
          let enabled = flag.enabled

          if (user) {
            // Check user-specific enablement
            if (flag.enabled_for_users?.includes(user.id)) {
              enabled = true
            }

            // Check role-based enablement
            if (
              user.is_superuser &&
              flag.enabled_for_roles?.includes("superuser")
            ) {
              enabled = true
            }
            if (
              user.is_teacher &&
              flag.enabled_for_roles?.includes("teacher")
            ) {
              enabled = true
            }
          }

          newFlags[flag.key as keyof FeatureFlags] = enabled ?? false
        }
      }

      setFlags(newFlags)
    }
  }, [flagsData, user])

  const isEnabled = (flagKey: string): boolean => {
    return flags[flagKey as keyof FeatureFlags] ?? false
  }

  return (
    <FeatureFlagsContext.Provider value={{ flags, isLoading, isEnabled }}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext)
  if (context === undefined) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    )
  }
  return context
}

export function useFeatureFlag(flagKey: string): boolean {
  const { isEnabled } = useFeatureFlags()
  return isEnabled(flagKey)
}
