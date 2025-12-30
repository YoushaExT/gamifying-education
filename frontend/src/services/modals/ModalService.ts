import EventService, { EVENT_NAMES } from "../events/EventService"
import { modalRegistry } from "./ModalRegistry"
import type {
  ConfirmationOptions,
  ModalEvent,
  ModalType,
} from "./ModalService.interface"

class ModalService {
  /**
   * Open modal by registered ID from modal registry
   */
  openModalById(
    modalId: string,
    modalProps?: Record<string, unknown>,
    modalType?: ModalType,
  ) {
    const config = modalRegistry[modalId]

    if (!config) {
      console.error(`Modal with ID "${modalId}" not found in registry`)
      return
    }

    this.openModal({
      id: modalId,
      modalContent: config.component,
      modalProps,
      modalType: modalType || config.type,
    })
  }

  /**
   * Open modal with direct component (bypasses registry)
   */
  openModal(payload: ModalEvent) {
    const id = payload.id || this.generateId()

    EventService.emitEvent(EVENT_NAMES.MODAL.OPEN, {
      ...payload,
      id,
    })

    return id
  }

  /**
   * Close modal by ID
   */
  closeModal(id: string) {
    EventService.emitEvent(EVENT_NAMES.MODAL.CLOSE, { id })
  }

  /**
   * Promise-based confirmation dialog
   * Returns true if confirmed, false if cancelled
   */
  confirm(options: ConfirmationOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const modalId = this.generateId()

      this.openModal({
        id: modalId,
        modalContent: () => null, // Handled by ConfirmationWrapper
        modalType: "confirmation" as any,
        modalProps: {
          ...options,
          onConfirm: () => {
            this.closeModal(modalId)
            resolve(true)
          },
          onCancel: () => {
            this.closeModal(modalId)
            resolve(false)
          },
        },
      })
    })
  }

  private generateId(): string {
    return `modal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}

export default new ModalService()
