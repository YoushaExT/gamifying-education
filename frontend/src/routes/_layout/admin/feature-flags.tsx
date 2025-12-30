import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Shield, ToggleLeft, ToggleRight } from "lucide-react"
import { useState } from "react"
import { FeatureFlagsService } from "@/client"
import type { FeatureFlagPublic } from "@/client/types.gen"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

export const Route = createFileRoute("/_layout/admin/feature-flags")({
  component: FeatureFlagsPage,
})

function FeatureFlagsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [editingFlag, setEditingFlag] = useState<string | null>(null)
  const [localFlags, setLocalFlags] = useState<
    Record<string, FeatureFlagPublic>
  >({})

  // Fetch all feature flags (admin view)
  const { data: flagsData, isLoading } = useQuery({
    queryKey: ["featureFlagsAdmin"],
    queryFn: () => FeatureFlagsService.listAllFeatureFlags({}),
  })

  // Update feature flag mutation
  const updateFlagMutation = useMutation({
    mutationFn: async ({
      flagKey,
      updates,
    }: {
      flagKey: string
      updates: {
        enabled?: boolean
        enabled_for_roles?: string[]
      }
    }) => {
      return FeatureFlagsService.updateFlag({
        flagKey,
        requestBody: updates,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featureFlagsAdmin"] })
      queryClient.invalidateQueries({ queryKey: ["featureFlags"] })
      toast({
        title: "Success",
        description: "Feature flag updated successfully",
      })
      setEditingFlag(null)
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feature flag",
        variant: "destructive",
      })
    },
  })

  const handleToggleGlobal = (flag: FeatureFlagPublic) => {
    updateFlagMutation.mutate({
      flagKey: flag.key,
      updates: {
        enabled: !flag.enabled,
      },
    })
  }

  const handleToggleRole = (flag: FeatureFlagPublic, role: string) => {
    const currentRoles = flag.enabled_for_roles || []
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role]

    // Update local state for immediate feedback
    setLocalFlags((prev) => ({
      ...prev,
      [flag.key]: {
        ...flag,
        enabled_for_roles: newRoles,
      },
    }))
  }

  const handleSaveRoles = (flag: FeatureFlagPublic) => {
    const localFlag = localFlags[flag.key]
    if (localFlag) {
      updateFlagMutation.mutate({
        flagKey: flag.key,
        updates: {
          enabled_for_roles: localFlag.enabled_for_roles,
        },
      })
    }
  }

  const handleCancelEdit = (flagKey: string) => {
    setLocalFlags((prev) => {
      const newFlags = { ...prev }
      delete newFlags[flagKey]
      return newFlags
    })
    setEditingFlag(null)
  }

  const getDisplayFlag = (flag: FeatureFlagPublic): FeatureFlagPublic => {
    return localFlags[flag.key] || flag
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading feature flags...</div>
      </div>
    )
  }

  const flags = flagsData?.data || []

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Feature Flags Management</h1>
          <p className="text-muted-foreground">
            Control feature availability across the platform
          </p>
        </div>
      </div>

      {flags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No feature flags configured</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>
              Enable or disable features globally or for specific roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Feature</TableHead>
                  <TableHead className="w-[120px]">Global Status</TableHead>
                  <TableHead>Enabled For Roles</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => {
                  const displayFlag = getDisplayFlag(flag)
                  const isEditing = editingFlag === flag.key
                  const hasChanges = !!localFlags[flag.key]

                  return (
                    <TableRow key={flag.key}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{flag.name}</div>
                          {flag.description && (
                            <div className="text-sm text-muted-foreground">
                              {flag.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground font-mono">
                            Key: {flag.key}
                          </div>
                          {flag.env_var_name && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              Env: {flag.env_var_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={displayFlag.enabled}
                            onCheckedChange={() => handleToggleGlobal(flag)}
                            disabled={updateFlagMutation.isPending}
                          />
                          <span className="text-sm">
                            {displayFlag.enabled ? (
                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                <ToggleRight className="h-4 w-4" />
                                Enabled
                              </span>
                            ) : (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <ToggleLeft className="h-4 w-4" />
                                Disabled
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`${flag.key}-superuser`}
                                checked={displayFlag.enabled_for_roles?.includes(
                                  "superuser",
                                )}
                                onCheckedChange={() => {
                                  if (!isEditing) setEditingFlag(flag.key)
                                  handleToggleRole(displayFlag, "superuser")
                                }}
                                disabled={updateFlagMutation.isPending}
                              />
                              <Label
                                htmlFor={`${flag.key}-superuser`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Superuser
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`${flag.key}-teacher`}
                                checked={displayFlag.enabled_for_roles?.includes(
                                  "teacher",
                                )}
                                onCheckedChange={() => {
                                  if (!isEditing) setEditingFlag(flag.key)
                                  handleToggleRole(displayFlag, "teacher")
                                }}
                                disabled={updateFlagMutation.isPending}
                              />
                              <Label
                                htmlFor={`${flag.key}-teacher`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Teacher
                              </Label>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasChanges && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleSaveRoles(flag)}
                              disabled={updateFlagMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelEdit(flag.key)}
                              disabled={updateFlagMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100">
            How Feature Flags Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>Priority Order:</strong> Environment Variable &gt;
            User-Specific &gt; Role-Specific &gt; Global
          </p>
          <p>
            <strong>Global:</strong> When enabled, the feature is available to
            all users (unless restricted by other settings)
          </p>
          <p>
            <strong>Role-Based:</strong> When roles are selected, only users
            with those roles can access the feature
          </p>
          <p>
            <strong>Environment Override:</strong> If an environment variable is
            set (shown in blue), it takes precedence over database settings
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default FeatureFlagsPage
