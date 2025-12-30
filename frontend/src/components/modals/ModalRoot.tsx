import { useEffect, useState } from "react"
import EventService, { EVENT_NAMES } from "@/services/events/EventService"
import ModalService from "@/services/modals/ModalService"
import type { IModal } from "@/services/modals/ModalService.interface"
import { ModalType } from "@/services/modals/ModalService.interface"
import {
  AlertDialogWrapper,
  ConfirmationWrapper,
  DialogWrapper,
} from "./ModalWrappers"

export function ModalRoot() {
  const [modals, setModals] = useState<IModal[]>([])

  useEffect(() => {
    const handleOpen = (data: any) => {
      setModals((prev) => [...prev, data])
    }

    const handleClose = (data: { id: string }) => {
      setModals((prev) => prev.filter((modal) => modal.id !== data.id))
    }

    EventService.addListener(EVENT_NAMES.MODAL.OPEN, handleOpen)
    EventService.addListener(EVENT_NAMES.MODAL.CLOSE, handleClose)

    return () => {
      EventService.removeListener(EVENT_NAMES.MODAL.OPEN, handleOpen)
      EventService.removeListener(EVENT_NAMES.MODAL.CLOSE, handleClose)
    }
  }, [])

  return (
    <>
      {modals.map((modal) => {
        const { id, modalContent, modalProps, modalType, showCloseButton } =
          modal
        const handleClose = () => ModalService.closeModal(id)

        // Choose wrapper based on type
        if (
          modalType === ModalType.CONFIRMATION ||
          modalType === ("confirmation" as any)
        ) {
          return (
            <ConfirmationWrapper
              key={id}
              isOpen={true}
              modalProps={modalProps}
            />
          )
        }

        if (modalType === ModalType.ALERT_DIALOG) {
          return (
            <AlertDialogWrapper
              key={id}
              isOpen={true}
              onClose={handleClose}
              modalContent={modalContent}
              modalProps={{ ...modalProps, id }}
            />
          )
        }

        // Default to Dialog
        return (
          <DialogWrapper
            key={id}
            isOpen={true}
            onClose={handleClose}
            modalContent={modalContent}
            modalProps={{ ...modalProps, id }}
            showCloseButton={showCloseButton}
          />
        )
      })}
    </>
  )
}
