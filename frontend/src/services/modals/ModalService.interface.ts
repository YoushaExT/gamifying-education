import type { ComponentType } from "react"

export enum ModalType {
  DIALOG = "dialog",
  ALERT_DIALOG = "alert_dialog",
  CONFIRMATION = "confirmation",
}

export interface IModalProps {
  id: string
  onClose?: () => void
}

export interface ModalEvent {
  id?: string
  modalContent: ComponentType<any>
  modalProps?: Record<string, unknown>
  modalType?: ModalType
  showCloseButton?: boolean
}

export interface IModal
  extends Required<Pick<ModalEvent, "id">>,
    Omit<ModalEvent, "id"> {}

export type ModalRegistry = {
  [modalId: string]: {
    id: string
    component: ComponentType<any>
    type?: ModalType
  }
}

// Confirmation dialog specific
export interface ConfirmationOptions {
  title: string
  description: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}
