import { Loader2 } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReject: (reason: string) => Promise<void>
  isSubmitting: boolean
}

export function RejectDialog({
  open,
  onOpenChange,
  onReject,
  isSubmitting,
}: RejectDialogProps) {
  const reasonId = useId()
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a rejection reason")
      return
    }

    try {
      await onReject(reason)
      setReason("")
      setError("")
    } catch (_err) {
      setError("Failed to reject question. Please try again.")
    }
  }

  const handleCancel = () => {
    setReason("")
    setError("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Question</DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this question. This will help
            improve future generations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor={reasonId}>
            Rejection Reason <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id={reasonId}
            placeholder="e.g., Question is too ambiguous, incorrect answer, poor code formatting..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError("")
            }}
            rows={4}
            disabled={isSubmitting}
            className={error ? "border-red-500" : ""}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              "Reject Question"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
