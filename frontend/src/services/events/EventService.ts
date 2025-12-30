type EventListener = (data: any) => void

class EventService {
  private listeners: Map<string, Set<EventListener>> = new Map()

  addListener(eventName: string, listener: EventListener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set())
    }
    this.listeners.get(eventName)!.add(listener)
  }

  removeListener(eventName: string, listener: EventListener) {
    this.listeners.get(eventName)?.delete(listener)
  }

  emitEvent(eventName: string, data: any) {
    this.listeners.get(eventName)?.forEach((listener) => {
      listener(data)
    })
  }
}

export default new EventService()

export const EVENT_NAMES = {
  MODAL: {
    OPEN: "modal:open",
    CLOSE: "modal:close",
  },
}
