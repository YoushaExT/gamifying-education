import type { ComponentType } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { ConfirmationOptions } from "@/services/modals/ModalService.interface"

interface ModalWrapperProps {
  isOpen: boolean
  onClose: () => void
  modalContent: ComponentType<any>
  modalProps?: Record<string, unknown>
  showCloseButton?: boolean
}

export function DialogWrapper({
  isOpen,
  onClose,
  modalContent: ModalContent,
  modalProps,
  showCloseButton = true,
}: ModalWrapperProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={showCloseButton}>
        <ModalContent {...modalProps} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

export function AlertDialogWrapper({
  isOpen,
  onClose,
  modalContent: ModalContent,
  modalProps,
}: ModalWrapperProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <ModalContent {...modalProps} onClose={onClose} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Special confirmation dialog wrapper
export function ConfirmationWrapper({
  isOpen,
  modalProps = {},
}: Omit<ModalWrapperProps, "modalContent" | "onClose">) {
  const {
    title = "",
    description = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    onConfirm = () => {},
    onCancel = () => {},
  } = modalProps as unknown as ConfirmationOptions & {
    onConfirm: () => void
    onCancel: () => void
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              variant === "destructive"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
