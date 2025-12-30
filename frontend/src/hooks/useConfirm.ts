import { useCallback } from "react"
import ModalService from "@/services/modals/ModalService"
import type { ConfirmationOptions } from "@/services/modals/ModalService.interface"

export function useConfirm() {
  const confirm = useCallback(
    async (options: ConfirmationOptions): Promise<boolean> => {
      return ModalService.confirm(options)
    },
    [],
  )

  return { confirm }
}
