import type { ModalRegistry } from "./ModalService.interface"

// Import modal components here as needed
// import { ExampleModal } from '@/components/modals/ExampleModal'

export const MODAL_IDS = {
  // Add modal IDs here as needed
  // EXAMPLE: 'example-modal',
} as const

export const modalRegistry: ModalRegistry = {
  // Register modals here
  // [MODAL_IDS.EXAMPLE]: {
  //   id: MODAL_IDS.EXAMPLE,
  //   component: ExampleModal,
  //   type: ModalType.DIALOG,
  // },
}
