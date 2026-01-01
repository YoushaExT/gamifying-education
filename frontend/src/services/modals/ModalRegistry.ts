import { EditQuestionModal } from "@/components/Questions/EditQuestionModal"
import { PreviewQuestionModal } from "@/components/Questions/PreviewQuestionModal"
import type { ModalRegistry } from "./ModalService.interface"
import { ModalType } from "./ModalService.interface"

export const MODAL_IDS = {
  EDIT_QUESTION: "edit-question",
  PREVIEW_QUESTION: "preview-question",
} as const

export const modalRegistry: ModalRegistry = {
  [MODAL_IDS.EDIT_QUESTION]: {
    id: MODAL_IDS.EDIT_QUESTION,
    component: EditQuestionModal,
    type: ModalType.DIALOG,
  },
  [MODAL_IDS.PREVIEW_QUESTION]: {
    id: MODAL_IDS.PREVIEW_QUESTION,
    component: PreviewQuestionModal,
    type: ModalType.DIALOG,
  },
}
